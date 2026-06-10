package receipt

import (
	"context"
	"encoding/json"
	"fmt"

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
	repo Repository
	ocr  OCRProvider
	llm  LLMProvider
}

func NewProcessReceiptScanWorker(repo Repository, ocr OCRProvider, llm LLMProvider) *ProcessReceiptScanWorker {
	return &ProcessReceiptScanWorker{repo: repo, ocr: ocr, llm: llm}
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
	items, err := w.llm.ParseReceipt(ctx, text)
	if err != nil {
		return fail("llm", err)
	}
	for _, it := range items {
		if _, err := w.repo.CreateScanItem(ctx, scanID, it); err != nil {
			return fail("persist line item", err)
		}
	}

	// 3. Record the LLM result and move to pending_review.
	// The LLMProvider interface does not expose the true raw response, so we
	// store the JSON re-encoding of the parsed items. This is self-consistent
	// and far more useful for debugging than a summary string.
	llmResult, err := json.Marshal(items)
	if err != nil {
		return fail("encode_llm_result", err)
	}
	if _, err := w.repo.SetLLMResult(ctx, scanID, string(llmResult)); err != nil {
		return fail("persist_llm", err)
	}
	if _, err := w.repo.UpdateScanStatus(ctx, scanID, StatusPendingReview, nil); err != nil {
		return fmt.Errorf("process receipt scan: set pending_review: %w", err)
	}
	return nil
}
