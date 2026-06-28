package receipt

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
)

// JobProcessReceiptScan is the job type key for receipt processing.
const JobProcessReceiptScan = "process_receipt_scan"

// ProcessReceiptScanArgs is the payload for a receipt-processing job.
//
// The Sprint 6 spec targets River, where this would carry a Kind() method and be
// dispatched via river.Job[ProcessReceiptScanArgs]. With the in-process queue we
// pass the same struct as the payload and key on JobProcessReceiptScan.
type ProcessReceiptScanArgs struct {
	ScanID string `json:"scan_id"`
}

// Kind reports the job kind (River-compatible signature for an easy future swap).
func (ProcessReceiptScanArgs) Kind() string { return JobProcessReceiptScan }

// ProcessReceiptScanWorker runs the OCR -> LLM -> pending_review pipeline.
type ProcessReceiptScanWorker struct {
	repo        Repository
	ocr         OCRProvider
	llmResolver LLMProviderResolver
	inventory   InventoryLookup // optional; when set, parsed items are matched to existing inventory items
}

func NewProcessReceiptScanWorker(repo Repository, ocr OCRProvider, llmResolver LLMProviderResolver, inventory InventoryLookup) *ProcessReceiptScanWorker {
	return &ProcessReceiptScanWorker{repo: repo, ocr: ocr, llmResolver: llmResolver, inventory: inventory}
}

// HandleJob is the JobHandler entrypoint for the in-process queue.
func (w *ProcessReceiptScanWorker) HandleJob(ctx context.Context, payload any) error {
	args, ok := payload.(ProcessReceiptScanArgs)
	if !ok {
		return fmt.Errorf("process receipt scan: unexpected payload type %T", payload)
	}
	return w.Work(ctx, args)
}

// Work executes the processing pipeline for a single scan, recording failures on
// the scan record so the user can see them in the review UI.
func (w *ProcessReceiptScanWorker) Work(ctx context.Context, args ProcessReceiptScanArgs) error {
	scanID, err := uuid.Parse(args.ScanID)
	if err != nil {
		return fmt.Errorf("process receipt scan: invalid scan id: %w", err)
	}

	fail := func(stage string, cause error) error {
		msg := fmt.Sprintf("%s failed: %v", stage, cause)
		if _, uerr := w.repo.UpdateScanStatus(ctx, scanID, StatusFailed, &msg); uerr != nil {
			return fmt.Errorf("process receipt scan: %s and status update failed: %v (cause: %w)", stage, uerr, cause)
		}
		return fmt.Errorf("process receipt scan: %s: %w", stage, cause)
	}

	scan, err := w.repo.GetScan(ctx, scanID)
	if err != nil {
		return fail("fetch", err)
	}

	// 1. OCR
	if _, err := w.repo.UpdateScanStatus(ctx, scanID, StatusOCRProcessing, nil); err != nil {
		return fmt.Errorf("process receipt scan: set ocr_processing: %w", err)
	}
	text, err := w.ocr.ExtractText(ctx, scan.RawImagePath)
	if err != nil {
		return fail("ocr", err)
	}
	if _, err := w.repo.SetOCRResult(ctx, scanID, text); err != nil {
		return fail("persist_ocr", err)
	}

	// 2. LLM
	llmProvider, err := w.llmResolver(ctx, scan.HouseholdID)
	if err != nil {
		return fail("resolve_llm", err)
	}
	items, rawLLMResponse, err := llmProvider.ParseReceipt(ctx, text)
	if err != nil {
		return fail("llm", err)
	}
	created := make([]*ReceiptScanItem, 0, len(items))
	for _, it := range items {
		ci, err := w.repo.CreateScanItem(ctx, scanID, it)
		if err != nil {
			return fail("persist line item", err)
		}
		created = append(created, ci)
	}

	// Auto-match each parsed item to an existing inventory item by name. On a
	// match we link the item and force its unit to the inventory item's stored
	// unit (kept separately from the receipt's parsed_unit). This is only a
	// suggestion: status stays "pending" so the mandatory review step remains.
	w.matchInventory(ctx, scan.HouseholdID, created)

	// 3. Store the raw LLM response and move to pending_review.
	if _, err := w.repo.SetLLMResult(ctx, scanID, rawLLMResponse); err != nil {
		return fail("persist_llm", err)
	}
	if _, err := w.repo.UpdateScanStatus(ctx, scanID, StatusPendingReview, nil); err != nil {
		return fmt.Errorf("process receipt scan: set pending_review: %w", err)
	}
	return nil
}

// matchInventory links scan items whose parsed name matches an existing
// inventory item (case-insensitive) and forces the matched item's unit. Failures
// are logged, not fatal: matching is a convenience and must never block review.
func (w *ProcessReceiptScanWorker) matchInventory(ctx context.Context, householdID uuid.UUID, items []*ReceiptScanItem) {
	if w.inventory == nil {
		return
	}
	refs, err := w.inventory.HouseholdItems(ctx, householdID)
	if err != nil {
		slog.Warn("receipt inventory match: load household items", "household_id", householdID, "error", err)
		return
	}
	if len(refs) == 0 {
		return
	}
	byName := make(map[string]InventoryItemRef, len(refs))
	for _, ref := range refs {
		byName[normalizeName(ref.Name)] = ref
	}
	for _, it := range items {
		if it.ParsedName == nil {
			continue
		}
		ref, ok := byName[normalizeName(*it.ParsedName)]
		if !ok {
			continue
		}
		var unit *string
		if ref.Unit != "" {
			u := ref.Unit
			unit = &u
		}
		if err := w.repo.LinkScanItemToInventory(ctx, it.ID, ref.ID, unit); err != nil {
			slog.Warn("receipt inventory match: link item", "scan_item_id", it.ID, "error", err)
		}
	}
}

// normalizeName folds case and trims surrounding space for name matching,
// consistent with the case-insensitive matching used elsewhere (catalog upsert).
func normalizeName(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}
