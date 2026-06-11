package grocery_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/grocery"
	"github.com/willian-m/baskety/internal/inventory"
	"github.com/willian-m/baskety/internal/testutil"
)

// seedHousehold inserts a user + household and returns both IDs.
func seedHousehold(ctx context.Context, t *testing.T, pool *pgxpool.Pool) (userID, householdID uuid.UUID) {
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
	return
}

func TestIntegration_Grocery_CRUDList(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)

	userID, householdID := seedHousehold(ctx, t, pool)

	invRepo := inventory.NewPgRepository(pool)
	inv, err := invRepo.CreateInventory(ctx, householdID, "Pantry", nil)
	require.NoError(t, err)

	repo := grocery.NewPgRepository(pool)

	// CreateList
	list, err := repo.CreateList(ctx, inv.ID, "Weekly Shopping", userID)
	require.NoError(t, err)
	assert.Equal(t, "Weekly Shopping", list.Name)
	assert.Equal(t, "active", list.Status)
	assert.Equal(t, inv.ID, list.InventoryID)
	assert.Equal(t, userID, list.CreatedByUserID)

	// GetList
	got, err := repo.GetList(ctx, list.ID)
	require.NoError(t, err)
	assert.Equal(t, list.ID, got.ID)
	assert.Equal(t, list.Name, got.Name)

	// ListByInventory
	lists, err := repo.ListByInventory(ctx, inv.ID)
	require.NoError(t, err)
	assert.Len(t, lists, 1)
	assert.Equal(t, list.ID, lists[0].ID)

	// UpdateListStatus — mark as completed
	now := time.Now().UTC()
	updated, err := repo.UpdateListStatus(ctx, list.ID, "completed", &now)
	require.NoError(t, err)
	assert.Equal(t, "completed", updated.Status)
	require.NotNil(t, updated.CompletedAt)

	// ArchiveList
	require.NoError(t, repo.ArchiveList(ctx, list.ID))
	archived, err := repo.GetList(ctx, list.ID)
	require.NoError(t, err)
	assert.Equal(t, "archived", archived.Status)
}

func TestIntegration_Grocery_ItemManagement(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)

	userID, householdID := seedHousehold(ctx, t, pool)

	invRepo := inventory.NewPgRepository(pool)
	inv, err := invRepo.CreateInventory(ctx, householdID, "Pantry", nil)
	require.NoError(t, err)

	repo := grocery.NewPgRepository(pool)
	list, err := repo.CreateList(ctx, inv.ID, "Test List", userID)
	require.NoError(t, err)

	notes := "organic preferred"

	// AddItem — with inventory item reference
	invItem, err := invRepo.CreateItem(ctx, inv.ID, "Milk", "Dairy", "L", 4.0, nil)
	require.NoError(t, err)
	invItemID := invItem.ID

	item, err := repo.AddItem(ctx, list.ID, &invItemID, "Milk", 2.0, "L", &notes, 0)
	require.NoError(t, err)
	assert.Equal(t, "Milk", item.Name)
	assert.InDelta(t, 2.0, item.Quantity, 0.0001)
	assert.Equal(t, "L", item.Unit)
	assert.Equal(t, "pending", item.Status)
	assert.Equal(t, 0, item.SortOrder)
	require.NotNil(t, item.InventoryItemID)
	assert.Equal(t, invItemID, *item.InventoryItemID)

	// AddItem — without inventory item reference
	item2, err := repo.AddItem(ctx, list.ID, nil, "Bread", 1.0, "unit", nil, 1)
	require.NoError(t, err)
	assert.Nil(t, item2.InventoryItemID)

	// GetItem
	got, err := repo.GetItem(ctx, item.ID)
	require.NoError(t, err)
	assert.Equal(t, item.ID, got.ID)
	assert.Equal(t, "Milk", got.Name)

	// ListItems
	items, err := repo.ListItems(ctx, list.ID)
	require.NoError(t, err)
	assert.Len(t, items, 2)

	// UpdateItemStatus
	updated, err := repo.UpdateItemStatus(ctx, item.ID, "bought")
	require.NoError(t, err)
	assert.Equal(t, "bought", updated.Status)

	// ReorderItem
	require.NoError(t, repo.ReorderItem(ctx, item.ID, 5))
	reordered, err := repo.GetItem(ctx, item.ID)
	require.NoError(t, err)
	assert.Equal(t, 5, reordered.SortOrder)

	// DeleteItem
	require.NoError(t, repo.DeleteItem(ctx, item2.ID))
	remaining, err := repo.ListItems(ctx, list.ID)
	require.NoError(t, err)
	assert.Len(t, remaining, 1)
	assert.Equal(t, item.ID, remaining[0].ID)
}

func TestIntegration_Grocery_AutoGenerationQueryCorrectness(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)

	userID, householdID := seedHousehold(ctx, t, pool)

	invRepo := inventory.NewPgRepository(pool)
	invSvc := inventory.NewService(invRepo)

	inv, err := invRepo.CreateInventory(ctx, householdID, "Pantry", nil)
	require.NoError(t, err)

	// item1: target=5, batch=2 → shortfall=3
	item1, err := invRepo.CreateItem(ctx, inv.ID, "Milk", "Dairy", "L", 5.0, nil)
	require.NoError(t, err)
	_, err = invRepo.AddBatch(ctx, item1.ID, 2.0, nil, nil)
	require.NoError(t, err)

	// item2: target=3, batch=3 → no shortfall (exactly at target)
	item2, err := invRepo.CreateItem(ctx, inv.ID, "Eggs", "Dairy", "unit", 3.0, nil)
	require.NoError(t, err)
	_, err = invRepo.AddBatch(ctx, item2.ID, 3.0, nil, nil)
	require.NoError(t, err)

	// item3: target=2, no batches → shortfall=2
	item3, err := invRepo.CreateItem(ctx, inv.ID, "Bread", "Bakery", "unit", 2.0, nil)
	require.NoError(t, err)

	// item4: target=1, batch=0.5 → shortfall=0.5
	item4, err := invRepo.CreateItem(ctx, inv.ID, "Butter", "Dairy", "kg", 1.0, nil)
	require.NoError(t, err)
	_, err = invRepo.AddBatch(ctx, item4.ID, 0.5, nil, nil)
	require.NoError(t, err)

	// item5: target=4, batches=2+3=5 → no shortfall (above target)
	item5, err := invRepo.CreateItem(ctx, inv.ID, "Rice", "Grains", "kg", 4.0, nil)
	require.NoError(t, err)
	_, err = invRepo.AddBatch(ctx, item5.ID, 2.0, nil, nil)
	require.NoError(t, err)
	_, err = invRepo.AddBatch(ctx, item5.ID, 3.0, nil, nil)
	require.NoError(t, err)

	// item6: target=0 with batch → no shortfall (target is zero)
	item6, err := invRepo.CreateItem(ctx, inv.ID, "Salt", "Condiments", "g", 0.0, nil)
	require.NoError(t, err)
	_, err = invRepo.AddBatch(ctx, item6.ID, 100.0, nil, nil)
	require.NoError(t, err)

	groceryRepo := grocery.NewPgRepository(pool)
	grocerySvc := grocery.NewService(groceryRepo, invSvc)

	listResp, err := grocerySvc.AutoGenerate(ctx, inv.ID, householdID, userID, grocery.AutoGenerateRequest{})
	require.NoError(t, err)
	require.NotNil(t, listResp)
	assert.Contains(t, listResp.Name, "Auto-generated")

	// Fetch items on the generated list.
	generatedList, err := groceryRepo.GetList(ctx, uuid.MustParse(listResp.ID))
	require.NoError(t, err)
	items, err := groceryRepo.ListItems(ctx, generatedList.ID)
	require.NoError(t, err)

	// Build a map of inventoryItemID → quantity for easy assertions.
	type entry struct{ qty float64 }
	byItemID := map[uuid.UUID]entry{}
	for _, it := range items {
		require.NotNil(t, it.InventoryItemID, "auto-generated item must reference an inventory item")
		byItemID[*it.InventoryItemID] = entry{qty: it.Quantity}
	}

	// item1 and item3 and item4 must appear; item2, item5, item6 must not.
	assert.Len(t, items, 3, "only items with shortfall should be generated")

	// item1: shortfall = 5 - 2 = 3
	e1, ok := byItemID[item1.ID]
	assert.True(t, ok, "Milk (item1) must be in the generated list")
	assert.InDelta(t, 3.0, e1.qty, 0.0001, "Milk shortfall should be 3")

	// item3: shortfall = 2 - 0 = 2
	e3, ok := byItemID[item3.ID]
	assert.True(t, ok, "Bread (item3) must be in the generated list")
	assert.InDelta(t, 2.0, e3.qty, 0.0001, "Bread shortfall should be 2")

	// item4: shortfall = 1 - 0.5 = 0.5
	e4, ok := byItemID[item4.ID]
	assert.True(t, ok, "Butter (item4) must be in the generated list")
	assert.InDelta(t, 0.5, e4.qty, 0.0001, "Butter shortfall should be 0.5")

	// items at/above target must NOT appear
	_, has2 := byItemID[item2.ID]
	assert.False(t, has2, "Eggs (item2, at target) must NOT be in the generated list")
	_, has5 := byItemID[item5.ID]
	assert.False(t, has5, "Rice (item5, above target) must NOT be in the generated list")
	_, has6 := byItemID[item6.ID]
	assert.False(t, has6, "Salt (item6, target=0) must NOT be in the generated list")
}

// TestIntegration_Grocery_AutoGenerate_EmptyInventory verifies that AutoGenerate
// on an inventory with no items produces an empty list (not an error).
func TestIntegration_Grocery_AutoGenerate_EmptyInventory(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)

	userID, householdID := seedHousehold(ctx, t, pool)

	invRepo := inventory.NewPgRepository(pool)
	invSvc := inventory.NewService(invRepo)

	inv, err := invRepo.CreateInventory(ctx, householdID, "Empty Pantry", nil)
	require.NoError(t, err)

	groceryRepo := grocery.NewPgRepository(pool)
	grocerySvc := grocery.NewService(groceryRepo, invSvc)

	listResp, err := grocerySvc.AutoGenerate(ctx, inv.ID, householdID, userID, grocery.AutoGenerateRequest{})
	require.NoError(t, err)
	require.NotNil(t, listResp)

	generatedList, err := groceryRepo.GetList(ctx, uuid.MustParse(listResp.ID))
	require.NoError(t, err)

	items, err := groceryRepo.ListItems(ctx, generatedList.ID)
	require.NoError(t, err)
	assert.Empty(t, items, "empty inventory should produce a list with no items")
}

// TestIntegration_Grocery_AutoGenerate_AllStocked verifies that AutoGenerate
// on a fully-stocked inventory produces a list with no items.
func TestIntegration_Grocery_AutoGenerate_AllStocked(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)

	userID, householdID := seedHousehold(ctx, t, pool)

	invRepo := inventory.NewPgRepository(pool)
	invSvc := inventory.NewService(invRepo)

	inv, err := invRepo.CreateInventory(ctx, householdID, "Full Pantry", nil)
	require.NoError(t, err)

	for i := range 3 {
		item, err := invRepo.CreateItem(ctx, inv.ID, fmt.Sprintf("Item%d", i), "Cat", "unit", 2.0, nil)
		require.NoError(t, err)
		_, err = invRepo.AddBatch(ctx, item.ID, 5.0, nil, nil) // well above target
		require.NoError(t, err)
	}

	groceryRepo := grocery.NewPgRepository(pool)
	grocerySvc := grocery.NewService(groceryRepo, invSvc)

	listResp, err := grocerySvc.AutoGenerate(ctx, inv.ID, householdID, userID, grocery.AutoGenerateRequest{})
	require.NoError(t, err)
	require.NotNil(t, listResp)

	generatedList, err := groceryRepo.GetList(ctx, uuid.MustParse(listResp.ID))
	require.NoError(t, err)

	items, err := groceryRepo.ListItems(ctx, generatedList.ID)
	require.NoError(t, err)
	assert.Empty(t, items, "fully-stocked inventory should produce a list with no items")
}
