package catalog_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/catalog"
	"github.com/willian-m/baskety/internal/inventory"
	"github.com/willian-m/baskety/internal/testutil"
)

// seedInventory creates an inventory for the household and returns its ID.
func seedInventory(ctx context.Context, t *testing.T, pool *pgxpool.Pool, householdID uuid.UUID) uuid.UUID {
	t.Helper()
	var invID uuid.UUID
	require.NoError(t, pool.QueryRow(ctx,
		`INSERT INTO inventories (household_id, name) VALUES ($1, $2) RETURNING id`,
		householdID, "Pantry").Scan(&invID))
	return invID
}

// seedScanItemTransaction creates a receipt scan + (optionally linked) scan item
// + purchase transaction referencing it, and returns the transaction ID. It
// mirrors what receipt.CommitScan produces.
func seedScanItemTransaction(
	ctx context.Context, t *testing.T, pool *pgxpool.Pool,
	householdID uuid.UUID, name string, quantity float64, unit string, invItemID *uuid.UUID,
) uuid.UUID {
	t.Helper()
	var createdBy uuid.UUID
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT created_by FROM households WHERE id = $1`, householdID).Scan(&createdBy))

	var scanID uuid.UUID
	require.NoError(t, pool.QueryRow(ctx,
		`INSERT INTO receipt_scans (household_id, raw_image_path, status, created_by_user_id)
		 VALUES ($1, '/uploads/x.jpg', 'committed', $2) RETURNING id`,
		householdID, createdBy).Scan(&scanID))

	var itemID uuid.UUID
	require.NoError(t, pool.QueryRow(ctx,
		`INSERT INTO receipt_scan_items (receipt_scan_id, raw_text, parsed_name, parsed_quantity, parsed_unit, status, inventory_item_id)
		 VALUES ($1, $2, $3, $4, $5, 'accepted', $6) RETURNING id`,
		scanID, name, name, quantity, unit, invItemID).Scan(&itemID))

	var txID uuid.UUID
	require.NoError(t, pool.QueryRow(ctx,
		`INSERT INTO purchase_transactions (household_id, receipt_scan_item_id, currency, quantity, purchased_at)
		 VALUES ($1, $2, 'BRL', $3, $4) RETURNING id`,
		householdID, itemID, quantity, time.Now()).Scan(&txID))
	return txID
}

func newWorker(pool *pgxpool.Pool) *catalog.ProcessPurchaseTransactionWorker {
	return catalog.NewProcessPurchaseTransactionWorker(
		catalog.NewPgRepository(pool), inventory.NewPgRepository(pool), pool)
}

// A committed purchase for a product NOT yet in inventory must create a new
// inventory item (in the household's default inventory) and add a batch, so the
// inventory reflects the receipt.
func TestIntegration_PurchaseCreatesNewInventoryItem(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)

	householdID := seedHousehold(ctx, t, pool)
	invID := seedInventory(ctx, t, pool, householdID)
	invRepo := inventory.NewPgRepository(pool)

	txID := seedScanItemTransaction(ctx, t, pool, householdID, "Iogurte", 2, "ea", nil)

	require.NoError(t, newWorker(pool).Work(ctx,
		catalog.ProcessPurchaseTransactionArgs{TransactionID: txID.String()}))

	items, err := invRepo.ListItems(ctx, invID)
	require.NoError(t, err)
	var found *inventory.InventoryItem
	for _, it := range items {
		if it.Name == "Iogurte" {
			found = it
		}
	}
	require.NotNil(t, found, "a new inventory item should be created from the purchase")
	assert.Equal(t, 2.0, found.StoredQuantity, "the purchased quantity should be added as a batch")
}

// A purchase whose name matches an existing inventory item must add a batch to
// that item rather than creating a duplicate.
func TestIntegration_PurchaseMatchesExistingInventoryItemByName(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)

	householdID := seedHousehold(ctx, t, pool)
	invID := seedInventory(ctx, t, pool, householdID)
	invRepo := inventory.NewPgRepository(pool)

	existing, err := invRepo.CreateItem(ctx, invID, "Leite", "", "L", 0, nil)
	require.NoError(t, err)

	// Different case to exercise case-insensitive matching.
	txID := seedScanItemTransaction(ctx, t, pool, householdID, "leite", 3, "L", nil)
	require.NoError(t, newWorker(pool).Work(ctx,
		catalog.ProcessPurchaseTransactionArgs{TransactionID: txID.String()}))

	items, err := invRepo.ListItems(ctx, invID)
	require.NoError(t, err)
	count := 0
	for _, it := range items {
		if it.Name == "Leite" {
			count++
		}
	}
	assert.Equal(t, 1, count, "must reuse the existing item, not create a duplicate")

	qty, err := invRepo.GetItemQuantity(ctx, existing.ID)
	require.NoError(t, err)
	assert.Equal(t, 3.0, qty, "the batch should be added to the existing item")
}
