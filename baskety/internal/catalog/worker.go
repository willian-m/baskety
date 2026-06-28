package catalog

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

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

	// Reflect the purchase in inventory by adding a batch. The item is the one the
	// scan item was explicitly linked to, an existing item with the same name, or
	// a newly created item in the household's default inventory — so receipts of
	// brand-new products still populate inventory.
	if txn.Quantity != nil && *txn.Quantity > 0 {
		itemID, rerr := w.resolveInventoryItemID(ctx, txn.HouseholdID, refs)
		if rerr != nil {
			return fmt.Errorf("process purchase transaction: resolve inventory item: %w", rerr)
		}
		if itemID != nil {
			// Guard against soft-deleted items: the worker bypasses the inventory
			// service layer, so we re-check state here. The transaction is already
			// committed, so a soft-deleted item is logged and skipped rather than
			// failing the job. (Freshly created items never hit these branches.)
			item, ierr := w.inventoryRepo.GetItem(ctx, *itemID)
			switch {
			case errors.Is(ierr, inventory.ErrNotFound):
				slog.Warn("skipping inventory batch: item not found",
					"inventory_item_id", itemID, "transaction_id", txnID)
			case ierr != nil:
				return fmt.Errorf("process purchase transaction: get inventory item: %w", ierr)
			case item.DeletedAt != nil:
				slog.Warn("skipping inventory batch: item is soft-deleted",
					"inventory_item_id", itemID, "transaction_id", txnID)
			default:
				if _, err := w.inventoryRepo.AddBatch(ctx, *itemID, *txn.Quantity, nil, nil); err != nil {
					return fmt.Errorf("process purchase transaction: add inventory batch: %w", err)
				}
			}
		}
	}

	return nil
}

// resolveInventoryItemID determines which inventory item a purchase maps to:
//  1. the scan item's explicit link, if any;
//  2. an existing item in the household's default inventory with the same name
//     (case-insensitive), mirroring the catalog/store upsert-by-name approach;
//  3. otherwise a newly created item in that default inventory.
//
// It returns nil (skipping the batch) only when there is nothing to name the
// item or the household has no inventory yet.
func (w *ProcessPurchaseTransactionWorker) resolveInventoryItemID(ctx context.Context, householdID uuid.UUID, refs *scanItemRefs) (*uuid.UUID, error) {
	if refs.inventoryItemID != nil {
		return refs.inventoryItemID, nil
	}
	if refs.parsedName == nil || strings.TrimSpace(*refs.parsedName) == "" {
		return nil, nil
	}
	name := strings.TrimSpace(*refs.parsedName)

	invs, err := w.inventoryRepo.ListInventories(ctx, householdID)
	if err != nil {
		return nil, err
	}
	if len(invs) == 0 {
		slog.Warn("skipping inventory item creation: household has no inventory", "household_id", householdID)
		return nil, nil
	}
	// Oldest inventory = the default, matching the web client's active-inventory
	// fallback (inventories are listed created_at ASC).
	inv := invs[0]

	items, err := w.inventoryRepo.ListItems(ctx, inv.ID)
	if err != nil {
		return nil, err
	}
	for _, it := range items {
		if strings.EqualFold(it.Name, name) {
			id := it.ID
			return &id, nil
		}
	}

	unit := ""
	if refs.parsedUnit != nil {
		unit = *refs.parsedUnit
	}
	created, err := w.inventoryRepo.CreateItem(ctx, inv.ID, name, "", unit, 0, nil)
	if err != nil {
		return nil, err
	}
	return &created.ID, nil
}

// loadScanItemRefs reads only the receipt_scan_item columns the worker needs,
// via a direct pool query (sqlc has no single-item read for scan items).
func (w *ProcessPurchaseTransactionWorker) loadScanItemRefs(ctx context.Context, scanItemID uuid.UUID) (*scanItemRefs, error) {
	const q = `SELECT
		COALESCE(corrected_name, parsed_name),
		COALESCE(corrected_brand, parsed_brand),
		COALESCE(corrected_unit, parsed_unit),
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
