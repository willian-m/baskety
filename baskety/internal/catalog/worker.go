package catalog

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/willian-m/baskety/internal/inventory"
)

// JobProcessPurchaseTransaction is the job type key for enriching a purchase
// transaction with store/catalog references and updating inventory.
const JobProcessPurchaseTransaction = "process_purchase_transaction"

// ProcessPurchaseTransactionArgs is the payload for the job.
type ProcessPurchaseTransactionArgs struct {
	TransactionID string `json:"transaction_id"`
}

// Kind reports the job kind (River-compatible signature for an easy future swap).
func (ProcessPurchaseTransactionArgs) Kind() string { return JobProcessPurchaseTransaction }

// scanItemRefs holds the small slice of receipt_scan_item data the worker needs.
type scanItemRefs struct {
	parsedName      *string
	parsedBrand     *string
	parsedUnit      *string
	parsedStoreName *string
	inventoryItemID *uuid.UUID
}

// ProcessPurchaseTransactionWorker enriches a committed purchase transaction:
// it upserts the store and catalog entry derived from the linked receipt scan
// item, links them back onto the transaction, and adds an inventory batch when
// the scan item maps to a known inventory item.
type ProcessPurchaseTransactionWorker struct {
	repo          Repository
	inventoryRepo inventory.Repository
	pool          *pgxpool.Pool
}

func NewProcessPurchaseTransactionWorker(repo Repository, inventoryRepo inventory.Repository, pool *pgxpool.Pool) *ProcessPurchaseTransactionWorker {
	return &ProcessPurchaseTransactionWorker{repo: repo, inventoryRepo: inventoryRepo, pool: pool}
}

// HandleJob is the JobHandler entrypoint for the in-process queue.
func (w *ProcessPurchaseTransactionWorker) HandleJob(ctx context.Context, payload any) error {
	args, ok := payload.(ProcessPurchaseTransactionArgs)
	if !ok {
		return fmt.Errorf("process purchase transaction: unexpected payload type %T", payload)
	}
	return w.Work(ctx, args)
}

func (w *ProcessPurchaseTransactionWorker) Work(ctx context.Context, args ProcessPurchaseTransactionArgs) error {
	txnID, err := uuid.Parse(args.TransactionID)
	if err != nil {
		return fmt.Errorf("process purchase transaction: invalid transaction id: %w", err)
	}

	txn, err := w.repo.GetPurchaseTransaction(ctx, txnID)
	if err != nil {
		return fmt.Errorf("process purchase transaction: fetch: %w", err)
	}

	// Without a linked scan item there is nothing to enrich.
	if txn.ReceiptScanItemID == nil {
		return nil
	}

	refs, err := w.loadScanItemRefs(ctx, *txn.ReceiptScanItemID)
	if err != nil {
		return fmt.Errorf("process purchase transaction: load scan item: %w", err)
	}

	var storeID *uuid.UUID
	if refs.parsedStoreName != nil && *refs.parsedStoreName != "" {
		store, serr := w.repo.UpsertStore(ctx, *refs.parsedStoreName, nil, nil)
		if serr != nil {
			return fmt.Errorf("process purchase transaction: upsert store: %w", serr)
		}
		storeID = &store.ID
	}

	var catalogEntryID *uuid.UUID
	if refs.parsedName != nil && *refs.parsedName != "" {
		hid := txn.HouseholdID
		entry, cerr := w.repo.UpsertCatalogEntry(ctx, &hid, *refs.parsedName, refs.parsedBrand, refs.parsedUnit, nil, "private")
		if cerr != nil {
			return fmt.Errorf("process purchase transaction: upsert catalog entry: %w", cerr)
		}
		catalogEntryID = &entry.ID
	}

	if err := w.repo.UpdatePurchaseTransactionRefs(ctx, txnID, storeID, catalogEntryID); err != nil {
		return fmt.Errorf("process purchase transaction: update refs: %w", err)
	}

	// Add a batch to the mapped inventory item, when present. Guard against
	// soft-deleted items: the worker bypasses the inventory service layer, so we
	// re-check the item state here. The purchase transaction is already
	// committed, so a soft-deleted item is logged and skipped rather than failing
	// the job.
	if refs.inventoryItemID != nil && txn.Quantity != nil && *txn.Quantity > 0 {
		item, ierr := w.inventoryRepo.GetItem(ctx, *refs.inventoryItemID)
		switch {
		case errors.Is(ierr, inventory.ErrNotFound):
			slog.Warn("skipping inventory batch: item not found",
				"inventory_item_id", refs.inventoryItemID, "transaction_id", txnID)
		case ierr != nil:
			return fmt.Errorf("process purchase transaction: get inventory item: %w", ierr)
		case item.DeletedAt != nil:
			slog.Warn("skipping inventory batch: item is soft-deleted",
				"inventory_item_id", refs.inventoryItemID, "transaction_id", txnID)
		default:
			if _, err := w.inventoryRepo.AddBatch(ctx, *refs.inventoryItemID, *txn.Quantity, nil, nil); err != nil {
				return fmt.Errorf("process purchase transaction: add inventory batch: %w", err)
			}
		}
	}

	return nil
}

// loadScanItemRefs reads only the receipt_scan_item columns the worker needs,
// via a direct pool query (sqlc has no single-item read for scan items).
func (w *ProcessPurchaseTransactionWorker) loadScanItemRefs(ctx context.Context, scanItemID uuid.UUID) (*scanItemRefs, error) {
	const q = `SELECT
		COALESCE(corrected_name, parsed_name),
		COALESCE(corrected_brand, parsed_brand),
		parsed_unit,
		COALESCE(corrected_store_name, parsed_store_name),
		inventory_item_id
		FROM receipt_scan_items WHERE id = $1`
	var (
		name, brand, unit, store *string
		invItem                  pgtype.UUID
	)
	err := w.pool.QueryRow(ctx, q, pgtype.UUID{Bytes: scanItemID, Valid: true}).Scan(&name, &brand, &unit, &store, &invItem)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("scan item: %w", ErrNotFound)
		}
		return nil, err
	}
	refs := &scanItemRefs{
		parsedName:      name,
		parsedBrand:     brand,
		parsedUnit:      unit,
		parsedStoreName: store,
	}
	if invItem.Valid {
		u := uuid.UUID(invItem.Bytes)
		refs.inventoryItemID = &u
	}
	return refs, nil
}
