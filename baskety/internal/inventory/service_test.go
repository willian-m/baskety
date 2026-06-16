package inventory_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/inventory"
)

type mockRepo struct {
	createInventoryFn   func(ctx context.Context, householdID uuid.UUID, name string, description *string) (*inventory.Inventory, error)
	getInventoryFn      func(ctx context.Context, id uuid.UUID) (*inventory.Inventory, error)
	listInventoriesFn   func(ctx context.Context, householdID uuid.UUID) ([]*inventory.Inventory, error)
	updateInventoryFn   func(ctx context.Context, id uuid.UUID, name string, description *string) (*inventory.Inventory, error)
	deleteInventoryFn   func(ctx context.Context, id uuid.UUID) error
	createItemFn        func(ctx context.Context, inventoryID uuid.UUID, name, category, unit string, target float64, notes *string) (*inventory.InventoryItem, error)
	getItemFn           func(ctx context.Context, id uuid.UUID) (*inventory.InventoryItem, error)
	listItemsFn         func(ctx context.Context, inventoryID uuid.UUID) ([]*inventory.InventoryItem, error)
	updateItemFn        func(ctx context.Context, id uuid.UUID, name, category, unit string, target float64, notes *string) (*inventory.InventoryItem, error)
	softDeleteItemFn    func(ctx context.Context, id uuid.UUID) error
	getItemQuantityFn   func(ctx context.Context, itemID uuid.UUID) (float64, error)
	addBatchFn          func(ctx context.Context, itemID uuid.UUID, quantity float64, expiresAt *time.Time, notes *string) (*inventory.InventoryBatch, error)
	getBatchFn          func(ctx context.Context, id uuid.UUID) (*inventory.InventoryBatch, error)
	listActiveBatchesFn func(ctx context.Context, itemID uuid.UUID) ([]*inventory.InventoryBatch, error)
	markBatchEmptiedFn  func(ctx context.Context, id uuid.UUID) error
	deleteBatchFn       func(ctx context.Context, id uuid.UUID) error
	patchBatchFn        func(ctx context.Context, id, itemID uuid.UUID, quantity float64, expiresAt *time.Time, notes *string) (*inventory.InventoryBatch, error)
}

func (m *mockRepo) CreateInventory(ctx context.Context, householdID uuid.UUID, name string, description *string) (*inventory.Inventory, error) {
	return m.createInventoryFn(ctx, householdID, name, description)
}
func (m *mockRepo) GetInventory(ctx context.Context, id uuid.UUID) (*inventory.Inventory, error) {
	return m.getInventoryFn(ctx, id)
}
func (m *mockRepo) ListInventories(ctx context.Context, householdID uuid.UUID) ([]*inventory.Inventory, error) {
	return m.listInventoriesFn(ctx, householdID)
}
func (m *mockRepo) UpdateInventory(ctx context.Context, id uuid.UUID, name string, description *string) (*inventory.Inventory, error) {
	return m.updateInventoryFn(ctx, id, name, description)
}
func (m *mockRepo) DeleteInventory(ctx context.Context, id uuid.UUID) error {
	return m.deleteInventoryFn(ctx, id)
}
func (m *mockRepo) CreateItem(ctx context.Context, inventoryID uuid.UUID, name, category, unit string, target float64, notes *string) (*inventory.InventoryItem, error) {
	return m.createItemFn(ctx, inventoryID, name, category, unit, target, notes)
}
func (m *mockRepo) GetItem(ctx context.Context, id uuid.UUID) (*inventory.InventoryItem, error) {
	return m.getItemFn(ctx, id)
}
func (m *mockRepo) ListItems(ctx context.Context, inventoryID uuid.UUID) ([]*inventory.InventoryItem, error) {
	return m.listItemsFn(ctx, inventoryID)
}
func (m *mockRepo) UpdateItem(ctx context.Context, id uuid.UUID, name, category, unit string, target float64, notes *string) (*inventory.InventoryItem, error) {
	return m.updateItemFn(ctx, id, name, category, unit, target, notes)
}
func (m *mockRepo) SoftDeleteItem(ctx context.Context, id uuid.UUID) error {
	return m.softDeleteItemFn(ctx, id)
}
func (m *mockRepo) GetItemQuantity(ctx context.Context, itemID uuid.UUID) (float64, error) {
	return m.getItemQuantityFn(ctx, itemID)
}
func (m *mockRepo) AddBatch(ctx context.Context, itemID uuid.UUID, quantity float64, expiresAt *time.Time, notes *string) (*inventory.InventoryBatch, error) {
	return m.addBatchFn(ctx, itemID, quantity, expiresAt, notes)
}
func (m *mockRepo) GetBatch(ctx context.Context, id uuid.UUID) (*inventory.InventoryBatch, error) {
	return m.getBatchFn(ctx, id)
}
func (m *mockRepo) ListActiveBatches(ctx context.Context, itemID uuid.UUID) ([]*inventory.InventoryBatch, error) {
	return m.listActiveBatchesFn(ctx, itemID)
}
func (m *mockRepo) MarkBatchEmptied(ctx context.Context, id uuid.UUID) error {
	return m.markBatchEmptiedFn(ctx, id)
}
func (m *mockRepo) DeleteBatch(ctx context.Context, id uuid.UUID) error {
	return m.deleteBatchFn(ctx, id)
}
func (m *mockRepo) PatchBatch(ctx context.Context, id, itemID uuid.UUID, quantity float64, expiresAt *time.Time, notes *string) (*inventory.InventoryBatch, error) {
	return m.patchBatchFn(ctx, id, itemID, quantity, expiresAt, notes)
}

func TestCreateInventory_Success(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	repo := &mockRepo{
		createInventoryFn: func(_ context.Context, householdID uuid.UUID, name string, _ *string) (*inventory.Inventory, error) {
			assert.Equal(t, hID, householdID)
			return &inventory.Inventory{ID: invID, HouseholdID: householdID, Name: name, CreatedAt: time.Now()}, nil
		},
	}
	svc := inventory.NewService(repo)
	resp, err := svc.CreateInventory(context.Background(), hID, inventory.CreateInventoryRequest{Name: "Pantry"})
	require.NoError(t, err)
	assert.Equal(t, "Pantry", resp.Name)
	assert.Equal(t, invID.String(), resp.ID)
}

func TestGetInventory_WrongHousehold(t *testing.T) {
	invID := uuid.New()
	ownerHID := uuid.New()
	otherHID := uuid.New()
	repo := &mockRepo{
		getInventoryFn: func(_ context.Context, id uuid.UUID) (*inventory.Inventory, error) {
			return &inventory.Inventory{ID: id, HouseholdID: ownerHID, Name: "Pantry"}, nil
		},
	}
	svc := inventory.NewService(repo)
	_, err := svc.GetInventory(context.Background(), invID, otherHID)
	assert.ErrorIs(t, err, inventory.ErrNotFound)
}

func TestDeleteItem_SoftDeletesWithScope(t *testing.T) {
	itemID := uuid.New()
	invID := uuid.New()
	hID := uuid.New()
	deleted := false
	repo := &mockRepo{
		getItemFn: func(_ context.Context, id uuid.UUID) (*inventory.InventoryItem, error) {
			return &inventory.InventoryItem{ID: id, InventoryID: invID}, nil
		},
		getInventoryFn: func(_ context.Context, id uuid.UUID) (*inventory.Inventory, error) {
			return &inventory.Inventory{ID: id, HouseholdID: hID}, nil
		},
		softDeleteItemFn: func(_ context.Context, id uuid.UUID) error {
			assert.Equal(t, itemID, id)
			deleted = true
			return nil
		},
	}
	svc := inventory.NewService(repo)
	require.NoError(t, svc.DeleteItem(context.Background(), itemID, hID))
	assert.True(t, deleted)
}

func TestDeleteItem_WrongHousehold(t *testing.T) {
	itemID := uuid.New()
	invID := uuid.New()
	repo := &mockRepo{
		getItemFn: func(_ context.Context, id uuid.UUID) (*inventory.InventoryItem, error) {
			return &inventory.InventoryItem{ID: id, InventoryID: invID}, nil
		},
		getInventoryFn: func(_ context.Context, id uuid.UUID) (*inventory.Inventory, error) {
			return &inventory.Inventory{ID: id, HouseholdID: uuid.New()}, nil
		},
		softDeleteItemFn: func(_ context.Context, _ uuid.UUID) error {
			t.Fatal("soft delete should not be called for wrong household")
			return nil
		},
	}
	svc := inventory.NewService(repo)
	err := svc.DeleteItem(context.Background(), itemID, uuid.New())
	assert.ErrorIs(t, err, inventory.ErrNotFound)
}

func TestGetEffectiveQuantity_SumsActiveBatches(t *testing.T) {
	itemID := uuid.New()
	invID := uuid.New()
	hID := uuid.New()
	repo := &mockRepo{
		getItemFn: func(_ context.Context, id uuid.UUID) (*inventory.InventoryItem, error) {
			return &inventory.InventoryItem{ID: id, InventoryID: invID}, nil
		},
		getInventoryFn: func(_ context.Context, id uuid.UUID) (*inventory.Inventory, error) {
			return &inventory.Inventory{ID: id, HouseholdID: hID}, nil
		},
		getItemQuantityFn: func(_ context.Context, id uuid.UUID) (float64, error) {
			assert.Equal(t, itemID, id)
			return 5.0, nil
		},
	}
	svc := inventory.NewService(repo)
	qty, err := svc.GetEffectiveQuantity(context.Background(), itemID, hID)
	require.NoError(t, err)
	assert.Equal(t, 5.0, qty)
}

func TestGetInventory_RepoNotFound(t *testing.T) {
	repo := &mockRepo{
		getInventoryFn: func(_ context.Context, _ uuid.UUID) (*inventory.Inventory, error) {
			return nil, fmt.Errorf("wrap: %w", inventory.ErrNotFound)
		},
	}
	svc := inventory.NewService(repo)
	_, err := svc.GetInventory(context.Background(), uuid.New(), uuid.New())
	assert.ErrorIs(t, err, inventory.ErrNotFound)
}

func TestCreateItem_UniqueViolation_ReturnsErrInvalidInput(t *testing.T) {
	invID := uuid.New()
	hID := uuid.New()
	pgUniqueErr := &pgconn.PgError{Code: "23505"}
	repo := &mockRepo{
		getInventoryFn: func(_ context.Context, id uuid.UUID) (*inventory.Inventory, error) {
			return &inventory.Inventory{ID: id, HouseholdID: hID}, nil
		},
		createItemFn: func(_ context.Context, _ uuid.UUID, _, _, _ string, _ float64, _ *string) (*inventory.InventoryItem, error) {
			return nil, pgUniqueErr
		},
	}
	svc := inventory.NewService(repo)
	_, err := svc.CreateItem(context.Background(), invID, hID, inventory.CreateItemRequest{Name: "Milk"})
	require.Error(t, err)
	assert.ErrorIs(t, err, inventory.ErrInvalidInput)
	assert.Contains(t, err.Error(), "already exists")
}

func TestDeleteBatch(t *testing.T) {
	batchID := uuid.New()
	itemID := uuid.New()
	invID := uuid.New()
	hID := uuid.New()

	okScaffold := func(deleteFn func(ctx context.Context, id uuid.UUID) error) *mockRepo {
		return &mockRepo{
			getBatchFn: func(_ context.Context, id uuid.UUID) (*inventory.InventoryBatch, error) {
				return &inventory.InventoryBatch{ID: id, ItemID: itemID}, nil
			},
			getItemFn: func(_ context.Context, id uuid.UUID) (*inventory.InventoryItem, error) {
				return &inventory.InventoryItem{ID: id, InventoryID: invID}, nil
			},
			getInventoryFn: func(_ context.Context, id uuid.UUID) (*inventory.Inventory, error) {
				return &inventory.Inventory{ID: id, HouseholdID: hID}, nil
			},
			deleteBatchFn: deleteFn,
		}
	}

	t.Run("success", func(t *testing.T) {
		deleted := false
		repo := okScaffold(func(_ context.Context, id uuid.UUID) error {
			assert.Equal(t, batchID, id)
			deleted = true
			return nil
		})
		svc := inventory.NewService(repo)
		require.NoError(t, svc.DeleteBatch(context.Background(), batchID, hID))
		assert.True(t, deleted)
	})

	t.Run("wrong household returns not found", func(t *testing.T) {
		repo := okScaffold(func(_ context.Context, _ uuid.UUID) error {
			t.Fatal("delete should not be called for wrong household")
			return nil
		})
		svc := inventory.NewService(repo)
		err := svc.DeleteBatch(context.Background(), batchID, uuid.New())
		assert.ErrorIs(t, err, inventory.ErrNotFound)
	})

	t.Run("batch not found propagates", func(t *testing.T) {
		repo := &mockRepo{
			getBatchFn: func(_ context.Context, _ uuid.UUID) (*inventory.InventoryBatch, error) {
				return nil, fmt.Errorf("wrap: %w", inventory.ErrNotFound)
			},
		}
		svc := inventory.NewService(repo)
		err := svc.DeleteBatch(context.Background(), batchID, hID)
		assert.ErrorIs(t, err, inventory.ErrNotFound)
	})
}

func TestPatchBatch(t *testing.T) {
	batchID := uuid.New()
	itemID := uuid.New()
	invID := uuid.New()
	hID := uuid.New()

	baseRepo := func(patchFn func(ctx context.Context, id, iID uuid.UUID, quantity float64, expiresAt *time.Time, notes *string) (*inventory.InventoryBatch, error)) *mockRepo {
		return &mockRepo{
			getItemFn: func(_ context.Context, id uuid.UUID) (*inventory.InventoryItem, error) {
				return &inventory.InventoryItem{ID: id, InventoryID: invID}, nil
			},
			getInventoryFn: func(_ context.Context, id uuid.UUID) (*inventory.Inventory, error) {
				return &inventory.Inventory{ID: id, HouseholdID: hID}, nil
			},
			patchBatchFn: patchFn,
		}
	}

	t.Run("success with non-nil notes", func(t *testing.T) {
		note := "handle with care"
		var capturedNotes *string
		repo := baseRepo(func(_ context.Context, id, iID uuid.UUID, quantity float64, _ *time.Time, notes *string) (*inventory.InventoryBatch, error) {
			assert.Equal(t, batchID, id)
			assert.Equal(t, itemID, iID)
			capturedNotes = notes
			return &inventory.InventoryBatch{ID: id, ItemID: itemID, Quantity: quantity, Notes: notes}, nil
		})
		svc := inventory.NewService(repo)
		req := inventory.PatchBatchRequest{Quantity: 3, Notes: &note}
		resp, err := svc.PatchBatch(context.Background(), batchID, itemID, hID, req)
		require.NoError(t, err)
		require.NotNil(t, capturedNotes)
		assert.Equal(t, "handle with care", *capturedNotes)
		assert.Equal(t, 3.0, resp.Quantity)
	})

	t.Run("success with nil notes", func(t *testing.T) {
		var capturedNotes *string
		notesSet := false
		repo := baseRepo(func(_ context.Context, _, _ uuid.UUID, quantity float64, _ *time.Time, notes *string) (*inventory.InventoryBatch, error) {
			capturedNotes = notes
			notesSet = true
			return &inventory.InventoryBatch{Quantity: quantity, Notes: notes}, nil
		})
		svc := inventory.NewService(repo)
		req := inventory.PatchBatchRequest{Quantity: 2, Notes: nil}
		resp, err := svc.PatchBatch(context.Background(), batchID, itemID, hID, req)
		require.NoError(t, err)
		assert.True(t, notesSet)
		assert.Nil(t, capturedNotes)
		assert.Equal(t, 2.0, resp.Quantity)
	})

	t.Run("repo not found propagates", func(t *testing.T) {
		repo := baseRepo(func(_ context.Context, _, _ uuid.UUID, _ float64, _ *time.Time, _ *string) (*inventory.InventoryBatch, error) {
			return nil, fmt.Errorf("batch: %w", inventory.ErrNotFound)
		})
		svc := inventory.NewService(repo)
		_, err := svc.PatchBatch(context.Background(), batchID, itemID, hID, inventory.PatchBatchRequest{Quantity: 1})
		assert.ErrorIs(t, err, inventory.ErrNotFound)
	})
}
