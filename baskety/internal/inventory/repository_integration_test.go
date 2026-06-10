package inventory_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/inventory"
	"github.com/willian-m/baskety/internal/testutil"
)

// seedHousehold inserts a user + household and returns the household ID.
func seedHousehold(ctx context.Context, t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	var userID uuid.UUID
	err := pool.QueryRow(ctx,
		`INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
		uuid.NewString()+"@example.com", "Test User", "hash",
	).Scan(&userID)
	require.NoError(t, err)

	var householdID uuid.UUID
	err = pool.QueryRow(ctx,
		`INSERT INTO households (name, created_by) VALUES ($1, $2) RETURNING id`,
		"Test Household", userID,
	).Scan(&householdID)
	require.NoError(t, err)
	return householdID
}

func TestIntegration_SoftDeleteIntegrity(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := inventory.NewPgRepository(pool)

	householdID := seedHousehold(ctx, t, pool)

	inv, err := repo.CreateInventory(ctx, householdID, "Pantry", nil)
	require.NoError(t, err)

	item, err := repo.CreateItem(ctx, inv.ID, "Milk", "Dairy", "L", 2.0, nil)
	require.NoError(t, err)

	batch, err := repo.AddBatch(ctx, item.ID, 1.5, nil, nil)
	require.NoError(t, err)

	// Soft-delete the item.
	require.NoError(t, repo.SoftDeleteItem(ctx, item.ID))

	// Repository still reads the row for internal integrity (soft delete is an
	// UPDATE setting deleted_at, not a hard DELETE).
	got, err := repo.GetItem(ctx, item.ID)
	require.NoError(t, err)
	assert.Equal(t, item.ID, got.ID)
	require.NotNil(t, got.DeletedAt, "deleted_at should be set")

	// But the service layer makes soft-deleted items invisible: GetItem returns
	// ErrNotFound, so the item is gone through every API path.
	svc := inventory.NewService(repo)
	_, err = svc.GetItem(ctx, item.ID, householdID)
	require.ErrorIs(t, err, inventory.ErrNotFound, "soft-deleted item must be invisible via service GetItem")

	// ListItems excludes soft-deleted items.
	items, err := repo.ListItems(ctx, inv.ID)
	require.NoError(t, err)
	for _, it := range items {
		assert.NotEqual(t, item.ID, it.ID, "soft-deleted item must not appear in list")
	}

	// Task 4.7 integrity check: soft-deleting an item must not orphan or cascade
	// to related rows. Note there is NO direct FK from inventory_items to
	// purchase_transactions in the schema, so there is nothing to seed/test on
	// that chain directly; the meaningful invariant is that the item's batches
	// survive the soft-delete UPDATE (it does not cascade-delete batches or
	// trigger any unexpected behavior on related tables). Only soft-delete is
	// exposed through the repository/service — there is no hard-delete path for
	// items — so the batch must always survive.
	gotBatch, err := repo.GetBatch(ctx, batch.ID)
	require.NoError(t, err)
	assert.Equal(t, batch.ID, gotBatch.ID, "batch must survive item soft-delete (no cascade)")
}

func TestIntegration_BatchQuantityAggregation(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := inventory.NewPgRepository(pool)

	householdID := seedHousehold(ctx, t, pool)

	inv, err := repo.CreateInventory(ctx, householdID, "Pantry", nil)
	require.NoError(t, err)

	item, err := repo.CreateItem(ctx, inv.ID, "Rice", "Grains", "kg", 10.0, nil)
	require.NoError(t, err)

	_, err = repo.AddBatch(ctx, item.ID, 2.0, nil, nil)
	require.NoError(t, err)
	_, err = repo.AddBatch(ctx, item.ID, 3.0, nil, nil)
	require.NoError(t, err)
	emptied, err := repo.AddBatch(ctx, item.ID, 1.5, nil, nil)
	require.NoError(t, err)

	// Mark one batch emptied; it should be excluded from the total.
	require.NoError(t, repo.MarkBatchEmptied(ctx, emptied.ID))

	qty, err := repo.GetItemQuantity(ctx, item.ID)
	require.NoError(t, err)
	assert.InDelta(t, 5.0, qty, 0.0001)

	// Task 4.8: the effective quantity must match through the service layer too.
	svc := inventory.NewService(repo)
	svcQty, err := svc.GetEffectiveQuantity(ctx, item.ID, householdID)
	require.NoError(t, err)
	assert.InDelta(t, 5.0, svcQty, 0.0001, "service effective quantity must match repo aggregation")

	// Active batch list should also exclude the emptied batch.
	active, err := repo.ListActiveBatches(ctx, item.ID)
	require.NoError(t, err)
	assert.Len(t, active, 2)
}
