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

func TestIntegration_Receipt_ScanStatusTransitions(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := receipt.NewPgRepository(pool)

	householdID, userID := seedHousehold(ctx, t, pool)

	scan, err := repo.CreateScan(ctx, householdID, nil, "/uploads/receipt.jpg", userID)
	require.NoError(t, err)
	require.Equal(t, receipt.StatusUploading, scan.Status)

	// uploading → ocr_processing
	scan, err = repo.UpdateScanStatus(ctx, scan.ID, receipt.StatusOCRProcessing, nil)
	require.NoError(t, err)
	assert.Equal(t, receipt.StatusOCRProcessing, scan.Status)

	// Verify via GetScan
	fetched, err := repo.GetScan(ctx, scan.ID)
	require.NoError(t, err)
	assert.Equal(t, receipt.StatusOCRProcessing, fetched.Status)

	// ocr_processing → llm_processing
	scan, err = repo.UpdateScanStatus(ctx, scan.ID, receipt.StatusLLMProcessing, nil)
	require.NoError(t, err)
	assert.Equal(t, receipt.StatusLLMProcessing, scan.Status)

	// llm_processing → pending_review
	scan, err = repo.UpdateScanStatus(ctx, scan.ID, receipt.StatusPendingReview, nil)
	require.NoError(t, err)
	assert.Equal(t, receipt.StatusPendingReview, scan.Status)

	// pending_review → committed
	scan, err = repo.UpdateScanStatus(ctx, scan.ID, receipt.StatusCommitted, nil)
	require.NoError(t, err)
	assert.Equal(t, receipt.StatusCommitted, scan.Status)

	// Verify committed status is persisted
	fetched, err = repo.GetScan(ctx, scan.ID)
	require.NoError(t, err)
	assert.Equal(t, receipt.StatusCommitted, fetched.Status)
	assert.Nil(t, fetched.ErrorMessage)

	// Test transition to failed with an error message
	scan2, err := repo.CreateScan(ctx, householdID, nil, "/uploads/bad.jpg", userID)
	require.NoError(t, err)

	errMsg := "OCR service unavailable"
	failed, err := repo.UpdateScanStatus(ctx, scan2.ID, receipt.StatusFailed, &errMsg)
	require.NoError(t, err)
	assert.Equal(t, receipt.StatusFailed, failed.Status)
	require.NotNil(t, failed.ErrorMessage)
	assert.Equal(t, errMsg, *failed.ErrorMessage)

	// Verify error message is stored in DB
	fetched2, err := repo.GetScan(ctx, scan2.ID)
	require.NoError(t, err)
	assert.Equal(t, receipt.StatusFailed, fetched2.Status)
	require.NotNil(t, fetched2.ErrorMessage)
	assert.Equal(t, errMsg, *fetched2.ErrorMessage)
}

func TestIntegration_Receipt_ItemStatusTransitions(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := receipt.NewPgRepository(pool)

	householdID, userID := seedHousehold(ctx, t, pool)

	scan, err := repo.CreateScan(ctx, householdID, nil, "/uploads/receipt2.jpg", userID)
	require.NoError(t, err)

	makeName := func(s string) *string { return &s }
	makeQty := func(f float64) *float64 { return &f }
	makePrice := func(i int64) *int64 { return &i }
	makeCur := func(s string) *string { return &s }

	itemA, err := repo.CreateScanItem(ctx, scan.ID, receipt.ParsedLineItem{
		RawText:          "MILK 1.99",
		ParsedName:       makeName("Milk"),
		ParsedQuantity:   makeQty(1.0),
		ParsedPriceMinor: makePrice(199),
		ParsedCurrency:   makeCur("USD"),
	})
	require.NoError(t, err)
	assert.Equal(t, receipt.ItemStatusPending, itemA.Status)

	itemB, err := repo.CreateScanItem(ctx, scan.ID, receipt.ParsedLineItem{
		RawText:          "BREAD 2.50",
		ParsedName:       makeName("Bread"),
		ParsedQuantity:   makeQty(1.0),
		ParsedPriceMinor: makePrice(250),
		ParsedCurrency:   makeCur("USD"),
	})
	require.NoError(t, err)
	assert.Equal(t, receipt.ItemStatusPending, itemB.Status)

	itemC, err := repo.CreateScanItem(ctx, scan.ID, receipt.ParsedLineItem{
		RawText:          "BUTTER 3.00",
		ParsedName:       makeName("Butter"),
		ParsedQuantity:   makeQty(1.0),
		ParsedPriceMinor: makePrice(300),
		ParsedCurrency:   makeCur("USD"),
	})
	require.NoError(t, err)
	assert.Equal(t, receipt.ItemStatusPending, itemC.Status)

	// pending → accepted
	updatedA, err := repo.UpdateScanItem(ctx, itemA.ID, receipt.UpdateScanItemRequest{Status: receipt.ItemStatusAccepted})
	require.NoError(t, err)
	assert.Equal(t, receipt.ItemStatusAccepted, updatedA.Status)

	// pending → rejected
	updatedB, err := repo.UpdateScanItem(ctx, itemB.ID, receipt.UpdateScanItemRequest{Status: receipt.ItemStatusRejected})
	require.NoError(t, err)
	assert.Equal(t, receipt.ItemStatusRejected, updatedB.Status)

	// pending → corrected
	correctedQty := 2.0
	correctedPrice := int64(580)
	correctedCur := "USD"
	updatedC, err := repo.UpdateScanItem(ctx, itemC.ID, receipt.UpdateScanItemRequest{
		Status:              receipt.ItemStatusCorrected,
		CorrectedQuantity:   &correctedQty,
		CorrectedPriceMinor: &correctedPrice,
		CorrectedCurrency:   &correctedCur,
	})
	require.NoError(t, err)
	assert.Equal(t, receipt.ItemStatusCorrected, updatedC.Status)
	require.NotNil(t, updatedC.CorrectedQuantity)
	assert.Equal(t, correctedQty, *updatedC.CorrectedQuantity)
	require.NotNil(t, updatedC.CorrectedPriceMinor)
	assert.Equal(t, correctedPrice, *updatedC.CorrectedPriceMinor)

	// Verify all statuses persisted via ListScanItems
	items, err := repo.ListScanItems(ctx, scan.ID)
	require.NoError(t, err)
	require.Len(t, items, 3)

	statusByID := make(map[string]string, 3)
	for _, it := range items {
		statusByID[it.ID.String()] = it.Status
	}
	assert.Equal(t, receipt.ItemStatusAccepted, statusByID[itemA.ID.String()])
	assert.Equal(t, receipt.ItemStatusRejected, statusByID[itemB.ID.String()])
	assert.Equal(t, receipt.ItemStatusCorrected, statusByID[itemC.ID.String()])
}

func TestIntegration_Receipt_CommitFlow(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := receipt.NewPgRepository(pool)

	householdID, userID := seedHousehold(ctx, t, pool)

	scan, err := repo.CreateScan(ctx, householdID, nil, "/uploads/receipt3.jpg", userID)
	require.NoError(t, err)

	makeName := func(s string) *string { return &s }
	makeQty := func(f float64) *float64 { return &f }
	makePrice := func(i int64) *int64 { return &i }
	makeCur := func(s string) *string { return &s }

	item1, err := repo.CreateScanItem(ctx, scan.ID, receipt.ParsedLineItem{
		RawText:          "EGGS 3.49",
		ParsedName:       makeName("Eggs"),
		ParsedQuantity:   makeQty(1.0),
		ParsedPriceMinor: makePrice(349),
		ParsedCurrency:   makeCur("USD"),
	})
	require.NoError(t, err)

	item2, err := repo.CreateScanItem(ctx, scan.ID, receipt.ParsedLineItem{
		RawText:          "CHEESE 4.99",
		ParsedName:       makeName("Cheese"),
		ParsedQuantity:   makeQty(1.0),
		ParsedPriceMinor: makePrice(499),
		ParsedCurrency:   makeCur("USD"),
	})
	require.NoError(t, err)

	// Accept both items
	_, err = repo.UpdateScanItem(ctx, item1.ID, receipt.UpdateScanItemRequest{Status: receipt.ItemStatusAccepted})
	require.NoError(t, err)
	_, err = repo.UpdateScanItem(ctx, item2.ID, receipt.UpdateScanItemRequest{Status: receipt.ItemStatusAccepted})
	require.NoError(t, err)

	purchasedAt := time.Now()

	// Create purchase transactions for both items
	tx1, err := repo.CreatePurchaseTransaction(ctx, householdID, item1.ID, purchasedAt)
	require.NoError(t, err)
	require.NotNil(t, tx1)
	assert.Equal(t, householdID, tx1.HouseholdID)
	require.NotNil(t, tx1.ReceiptScanItemID)
	assert.Equal(t, item1.ID, *tx1.ReceiptScanItemID)

	tx2, err := repo.CreatePurchaseTransaction(ctx, householdID, item2.ID, purchasedAt)
	require.NoError(t, err)
	require.NotNil(t, tx2)
	assert.Equal(t, householdID, tx2.HouseholdID)
	require.NotNil(t, tx2.ReceiptScanItemID)
	assert.Equal(t, item2.ID, *tx2.ReceiptScanItemID)

	// Verify transactions exist and link back to scan items
	var tx1Exists, tx2Exists bool
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM purchase_transactions WHERE id = $1 AND receipt_scan_item_id = $2)`,
		pgUUID(tx1.ID), pgUUID(item1.ID)).Scan(&tx1Exists))
	assert.True(t, tx1Exists, "transaction 1 must exist and link to scan item 1")

	require.NoError(t, pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM purchase_transactions WHERE id = $1 AND receipt_scan_item_id = $2)`,
		pgUUID(tx2.ID), pgUUID(item2.ID)).Scan(&tx2Exists))
	assert.True(t, tx2Exists, "transaction 2 must exist and link to scan item 2")

	// Mark scan as committed
	committed, err := repo.UpdateScanStatus(ctx, scan.ID, receipt.StatusCommitted, nil)
	require.NoError(t, err)
	assert.Equal(t, receipt.StatusCommitted, committed.Status)

	// Verify committed status is persisted
	fetched, err := repo.GetScan(ctx, scan.ID)
	require.NoError(t, err)
	assert.Equal(t, receipt.StatusCommitted, fetched.Status)
}
