package receipt_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/receipt"
	"github.com/willian-m/baskety/internal/testutil"
)

func seedHousehold(ctx context.Context, t *testing.T, pool *pgxpool.Pool) (householdID, userID uuid.UUID) {
	t.Helper()
	err := pool.QueryRow(ctx,
		`INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
		uuid.NewString()+"@example.com", "Test User", "hash",
	).Scan(&userID)
	require.NoError(t, err)
	err = pool.QueryRow(ctx,
		`INSERT INTO households (name, created_by) VALUES ($1, $2) RETURNING id`,
		"Test Household", userID,
	).Scan(&householdID)
	require.NoError(t, err)
	return householdID, userID
}

func TestIntegration_PurchaseTransactionSurvivesItemSoftDelete(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := receipt.NewPgRepository(pool)

	householdID, userID := seedHousehold(ctx, t, pool)

	// Inventory + inventory_item.
	var inventoryID uuid.UUID
	require.NoError(t, pool.QueryRow(ctx,
		`INSERT INTO inventories (household_id, name) VALUES ($1, $2) RETURNING id`,
		householdID, "Pantry").Scan(&inventoryID))

	var inventoryItemID uuid.UUID
	require.NoError(t, pool.QueryRow(ctx,
		`INSERT INTO inventory_items (inventory_id, name, target_quantity) VALUES ($1, $2, $3) RETURNING id`,
		inventoryID, "Milk", 2.0).Scan(&inventoryItemID))

	// Receipt scan + scan item linked to the inventory item.
	scan, err := repo.CreateScan(ctx, householdID, nil, "/uploads/test.jpg", userID)
	require.NoError(t, err)

	price := int64(199)
	qty := 1.0
	cur := "USD"
	name := "Milk"
	item, err := repo.CreateScanItem(ctx, scan.ID, receipt.ParsedLineItem{
		RawText:          "MILK 1.99",
		ParsedName:       &name,
		ParsedQuantity:   &qty,
		ParsedPriceMinor: &price,
		ParsedCurrency:   &cur,
	})
	require.NoError(t, err)

	// Link the scan item to the inventory item.
	_, err = pool.Exec(ctx,
		`UPDATE receipt_scan_items SET inventory_item_id = $2 WHERE id = $1`,
		pgUUID(item.ID), pgUUID(inventoryItemID))
	require.NoError(t, err)

	// Mark the scan item accepted so it represents a real purchase.
	_, err = repo.UpdateScanItem(ctx, item.ID, receipt.UpdateScanItemRequest{Status: receipt.ItemStatusAccepted})
	require.NoError(t, err)

	// Create purchase transaction referencing the scan item.
	tx, err := repo.CreatePurchaseTransaction(ctx, householdID, item.ID, time.Now())
	require.NoError(t, err)
	require.NotNil(t, tx.ReceiptScanItemID)

	// Soft-delete the inventory item (UPDATE deleted_at, not a hard delete).
	_, err = pool.Exec(ctx, `UPDATE inventory_items SET deleted_at = NOW() WHERE id = $1`, pgUUID(inventoryItemID))
	require.NoError(t, err)

	// 1. The purchase transaction still exists.
	var txExists bool
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM purchase_transactions WHERE id = $1)`, pgUUID(tx.ID)).Scan(&txExists))
	assert.True(t, txExists, "purchase transaction must survive item soft-delete")

	// 2. The scan item still points to the inventory item.
	var linkedItemID pgtype.UUID
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT inventory_item_id FROM receipt_scan_items WHERE id = $1`, pgUUID(item.ID)).Scan(&linkedItemID))
	require.True(t, linkedItemID.Valid, "inventory_item_id link must remain after soft-delete")
	assert.Equal(t, inventoryItemID, uuid.UUID(linkedItemID.Bytes))

	// 3. The inventory item row still exists (soft delete, not hard delete).
	var deletedAt pgtype.Timestamptz
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT deleted_at FROM inventory_items WHERE id = $1`, pgUUID(inventoryItemID)).Scan(&deletedAt))
	assert.True(t, deletedAt.Valid, "row must still exist with deleted_at set")
}

func pgUUID(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}
