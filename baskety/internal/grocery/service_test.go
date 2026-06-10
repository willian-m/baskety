package grocery_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/grocery"
	"github.com/willian-m/baskety/internal/inventory"
)

// --- mock Repository ---

type mockRepo struct {
	createListFn       func(ctx context.Context, inventoryID uuid.UUID, name string, createdBy uuid.UUID) (*grocery.GroceryList, error)
	getListFn          func(ctx context.Context, id uuid.UUID) (*grocery.GroceryList, error)
	listByInventoryFn  func(ctx context.Context, inventoryID uuid.UUID) ([]*grocery.GroceryList, error)
	updateListStatusFn func(ctx context.Context, id uuid.UUID, status string, completedAt *time.Time) (*grocery.GroceryList, error)
	archiveListFn      func(ctx context.Context, id uuid.UUID) error
	addItemFn          func(ctx context.Context, listID uuid.UUID, invItemID *uuid.UUID, name string, qty float64, unit string, notes *string, sortOrder int) (*grocery.GroceryListItem, error)
	getItemFn          func(ctx context.Context, id uuid.UUID) (*grocery.GroceryListItem, error)
	listItemsFn        func(ctx context.Context, listID uuid.UUID) ([]*grocery.GroceryListItem, error)
	updateItemStatusFn func(ctx context.Context, id uuid.UUID, status string) (*grocery.GroceryListItem, error)
	reorderItemFn      func(ctx context.Context, id uuid.UUID, sortOrder int) error
	deleteItemFn       func(ctx context.Context, id uuid.UUID) error
}

func (m *mockRepo) CreateList(ctx context.Context, inventoryID uuid.UUID, name string, createdBy uuid.UUID) (*grocery.GroceryList, error) {
	return m.createListFn(ctx, inventoryID, name, createdBy)
}
func (m *mockRepo) GetList(ctx context.Context, id uuid.UUID) (*grocery.GroceryList, error) {
	return m.getListFn(ctx, id)
}
func (m *mockRepo) ListByInventory(ctx context.Context, inventoryID uuid.UUID) ([]*grocery.GroceryList, error) {
	return m.listByInventoryFn(ctx, inventoryID)
}
func (m *mockRepo) UpdateListStatus(ctx context.Context, id uuid.UUID, status string, completedAt *time.Time) (*grocery.GroceryList, error) {
	return m.updateListStatusFn(ctx, id, status, completedAt)
}
func (m *mockRepo) ArchiveList(ctx context.Context, id uuid.UUID) error {
	return m.archiveListFn(ctx, id)
}
func (m *mockRepo) AddItem(ctx context.Context, listID uuid.UUID, invItemID *uuid.UUID, name string, qty float64, unit string, notes *string, sortOrder int) (*grocery.GroceryListItem, error) {
	return m.addItemFn(ctx, listID, invItemID, name, qty, unit, notes, sortOrder)
}
func (m *mockRepo) GetItem(ctx context.Context, id uuid.UUID) (*grocery.GroceryListItem, error) {
	return m.getItemFn(ctx, id)
}
func (m *mockRepo) ListItems(ctx context.Context, listID uuid.UUID) ([]*grocery.GroceryListItem, error) {
	return m.listItemsFn(ctx, listID)
}
func (m *mockRepo) UpdateItemStatus(ctx context.Context, id uuid.UUID, status string) (*grocery.GroceryListItem, error) {
	return m.updateItemStatusFn(ctx, id, status)
}
func (m *mockRepo) ReorderItem(ctx context.Context, id uuid.UUID, sortOrder int) error {
	return m.reorderItemFn(ctx, id, sortOrder)
}
func (m *mockRepo) DeleteItem(ctx context.Context, id uuid.UUID) error {
	return m.deleteItemFn(ctx, id)
}

// --- mock inventory.ServiceIface ---

type mockInventory struct {
	getInventoryFn    func(ctx context.Context, id, householdID uuid.UUID) (*inventory.InventoryResponse, error)
	listItemsFn       func(ctx context.Context, inventoryID, householdID uuid.UUID) ([]*inventory.ItemResponse, error)
	getEffectiveQtyFn func(ctx context.Context, itemID, householdID uuid.UUID) (float64, error)
}

func (m *mockInventory) CreateInventory(ctx context.Context, householdID uuid.UUID, req inventory.CreateInventoryRequest) (*inventory.InventoryResponse, error) {
	return nil, nil
}
func (m *mockInventory) GetInventory(ctx context.Context, id, householdID uuid.UUID) (*inventory.InventoryResponse, error) {
	return m.getInventoryFn(ctx, id, householdID)
}
func (m *mockInventory) ListInventories(ctx context.Context, householdID uuid.UUID) ([]*inventory.InventoryResponse, error) {
	return nil, nil
}
func (m *mockInventory) UpdateInventory(ctx context.Context, id, householdID uuid.UUID, req inventory.UpdateInventoryRequest) (*inventory.InventoryResponse, error) {
	return nil, nil
}
func (m *mockInventory) DeleteInventory(ctx context.Context, id, householdID uuid.UUID) error {
	return nil
}
func (m *mockInventory) CreateItem(ctx context.Context, inventoryID, householdID uuid.UUID, req inventory.CreateItemRequest) (*inventory.ItemResponse, error) {
	return nil, nil
}
func (m *mockInventory) GetItem(ctx context.Context, id, householdID uuid.UUID) (*inventory.ItemResponse, error) {
	return nil, nil
}
func (m *mockInventory) ListItems(ctx context.Context, inventoryID, householdID uuid.UUID) ([]*inventory.ItemResponse, error) {
	return m.listItemsFn(ctx, inventoryID, householdID)
}
func (m *mockInventory) UpdateItem(ctx context.Context, id, householdID uuid.UUID, req inventory.UpdateItemRequest) (*inventory.ItemResponse, error) {
	return nil, nil
}
func (m *mockInventory) DeleteItem(ctx context.Context, id, householdID uuid.UUID) error {
	return nil
}
func (m *mockInventory) AddBatch(ctx context.Context, itemID, householdID uuid.UUID, req inventory.AddBatchRequest) (*inventory.BatchResponse, error) {
	return nil, nil
}
func (m *mockInventory) ListActiveBatches(ctx context.Context, itemID, householdID uuid.UUID) ([]*inventory.BatchResponse, error) {
	return nil, nil
}
func (m *mockInventory) MarkBatchEmptied(ctx context.Context, batchID, householdID uuid.UUID) error {
	return nil
}
func (m *mockInventory) GetEffectiveQuantity(ctx context.Context, itemID, householdID uuid.UUID) (float64, error) {
	return m.getEffectiveQtyFn(ctx, itemID, householdID)
}

func okInventory(householdID uuid.UUID) *mockInventory {
	return &mockInventory{
		getInventoryFn: func(_ context.Context, id, hid uuid.UUID) (*inventory.InventoryResponse, error) {
			return &inventory.InventoryResponse{ID: id.String(), HouseholdID: hid.String()}, nil
		},
	}
}

// --- tests ---

func TestCreateList(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	userID := uuid.New()
	repo := &mockRepo{
		createListFn: func(_ context.Context, inventoryID uuid.UUID, name string, createdBy uuid.UUID) (*grocery.GroceryList, error) {
			return &grocery.GroceryList{ID: uuid.New(), InventoryID: inventoryID, Name: name, Status: "active", CreatedByUserID: createdBy}, nil
		},
	}
	svc := grocery.NewService(repo, okInventory(hID))
	resp, err := svc.CreateList(context.Background(), invID, hID, userID, grocery.CreateListRequest{Name: "Weekly"})
	require.NoError(t, err)
	assert.Equal(t, "Weekly", resp.Name)
	assert.Equal(t, "active", resp.Status)
	assert.Equal(t, userID.String(), resp.CreatedByUserID)
}

func TestCreateList_WrongHousehold(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	inv := &mockInventory{
		getInventoryFn: func(_ context.Context, _, _ uuid.UUID) (*inventory.InventoryResponse, error) {
			return nil, inventory.ErrNotFound
		},
	}
	svc := grocery.NewService(&mockRepo{}, inv)
	_, err := svc.CreateList(context.Background(), invID, hID, uuid.New(), grocery.CreateListRequest{Name: "X"})
	assert.ErrorIs(t, err, grocery.ErrNotFound)
}

func TestCompleteList(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	listID := uuid.New()
	repo := &mockRepo{
		getListFn: func(_ context.Context, id uuid.UUID) (*grocery.GroceryList, error) {
			return &grocery.GroceryList{ID: id, InventoryID: invID, Status: "active"}, nil
		},
		updateListStatusFn: func(_ context.Context, id uuid.UUID, status string, completedAt *time.Time) (*grocery.GroceryList, error) {
			require.NotNil(t, completedAt)
			return &grocery.GroceryList{ID: id, InventoryID: invID, Status: status, CompletedAt: completedAt}, nil
		},
	}
	svc := grocery.NewService(repo, okInventory(hID))
	resp, err := svc.CompleteList(context.Background(), listID, hID)
	require.NoError(t, err)
	assert.Equal(t, "completed", resp.Status)
	assert.NotNil(t, resp.CompletedAt)
}

func TestAddItem(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	listID := uuid.New()
	repo := &mockRepo{
		getListFn: func(_ context.Context, id uuid.UUID) (*grocery.GroceryList, error) {
			return &grocery.GroceryList{ID: id, InventoryID: invID, Status: "active"}, nil
		},
		addItemFn: func(_ context.Context, lID uuid.UUID, _ *uuid.UUID, name string, qty float64, unit string, _ *string, sortOrder int) (*grocery.GroceryListItem, error) {
			return &grocery.GroceryListItem{ID: uuid.New(), GroceryListID: lID, Name: name, Quantity: qty, Unit: unit, Status: "pending"}, nil
		},
	}
	svc := grocery.NewService(repo, okInventory(hID))
	resp, err := svc.AddItem(context.Background(), listID, hID, grocery.AddItemRequest{Name: "Eggs", Quantity: 12, Unit: "ct"})
	require.NoError(t, err)
	assert.Equal(t, "Eggs", resp.Name)
	assert.Equal(t, 12.0, resp.Quantity)
}

func TestAddItem_WrongHousehold(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	listID := uuid.New()
	repo := &mockRepo{
		getListFn: func(_ context.Context, id uuid.UUID) (*grocery.GroceryList, error) {
			return &grocery.GroceryList{ID: id, InventoryID: invID, Status: "active"}, nil
		},
	}
	inv := &mockInventory{
		getInventoryFn: func(_ context.Context, _, _ uuid.UUID) (*inventory.InventoryResponse, error) {
			return nil, inventory.ErrNotFound
		},
	}
	svc := grocery.NewService(repo, inv)
	_, err := svc.AddItem(context.Background(), listID, hID, grocery.AddItemRequest{Name: "Eggs"})
	assert.ErrorIs(t, err, grocery.ErrNotFound)
}

func TestAutoGenerate_BelowTarget(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	itemID := uuid.New()
	added := 0
	repo := &mockRepo{
		createListFn: func(_ context.Context, inventoryID uuid.UUID, name string, createdBy uuid.UUID) (*grocery.GroceryList, error) {
			return &grocery.GroceryList{ID: uuid.New(), InventoryID: inventoryID, Name: name, Status: "active"}, nil
		},
		addItemFn: func(_ context.Context, _ uuid.UUID, invItemID *uuid.UUID, name string, qty float64, _ string, _ *string, _ int) (*grocery.GroceryListItem, error) {
			added++
			require.NotNil(t, invItemID)
			assert.Equal(t, itemID, *invItemID)
			assert.Equal(t, "Milk", name)
			assert.InDelta(t, 3.0, qty, 0.0001) // target 5 - effective 2
			return &grocery.GroceryListItem{ID: uuid.New(), Name: name, Quantity: qty}, nil
		},
	}
	inv := okInventory(hID)
	inv.listItemsFn = func(_ context.Context, _, _ uuid.UUID) ([]*inventory.ItemResponse, error) {
		return []*inventory.ItemResponse{{ID: itemID.String(), Name: "Milk", Unit: "L", TargetQuantity: 5}}, nil
	}
	inv.getEffectiveQtyFn = func(_ context.Context, _, _ uuid.UUID) (float64, error) {
		return 2, nil
	}
	svc := grocery.NewService(repo, inv)
	resp, err := svc.AutoGenerate(context.Background(), invID, hID, uuid.New(), grocery.AutoGenerateRequest{})
	require.NoError(t, err)
	assert.NotEmpty(t, resp.ID)
	assert.Equal(t, 1, added)
}

func TestAutoGenerate_AtOrAboveTarget(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	itemID := uuid.New()
	added := 0
	repo := &mockRepo{
		createListFn: func(_ context.Context, inventoryID uuid.UUID, name string, createdBy uuid.UUID) (*grocery.GroceryList, error) {
			return &grocery.GroceryList{ID: uuid.New(), InventoryID: inventoryID, Name: name, Status: "active"}, nil
		},
		addItemFn: func(_ context.Context, _ uuid.UUID, _ *uuid.UUID, _ string, _ float64, _ string, _ *string, _ int) (*grocery.GroceryListItem, error) {
			added++
			return &grocery.GroceryListItem{ID: uuid.New()}, nil
		},
	}
	inv := okInventory(hID)
	inv.listItemsFn = func(_ context.Context, _, _ uuid.UUID) ([]*inventory.ItemResponse, error) {
		return []*inventory.ItemResponse{{ID: itemID.String(), Name: "Milk", TargetQuantity: 5}}, nil
	}
	inv.getEffectiveQtyFn = func(_ context.Context, _, _ uuid.UUID) (float64, error) {
		return 5, nil
	}
	svc := grocery.NewService(repo, inv)
	_, err := svc.AutoGenerate(context.Background(), invID, hID, uuid.New(), grocery.AutoGenerateRequest{})
	require.NoError(t, err)
	assert.Equal(t, 0, added)
}

func TestAutoGenerate_EmptyInventory(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	added := 0
	repo := &mockRepo{
		createListFn: func(_ context.Context, inventoryID uuid.UUID, name string, createdBy uuid.UUID) (*grocery.GroceryList, error) {
			return &grocery.GroceryList{ID: uuid.New(), InventoryID: inventoryID, Name: name, Status: "active"}, nil
		},
		addItemFn: func(_ context.Context, _ uuid.UUID, _ *uuid.UUID, _ string, _ float64, _ string, _ *string, _ int) (*grocery.GroceryListItem, error) {
			added++
			return &grocery.GroceryListItem{ID: uuid.New()}, nil
		},
	}
	inv := okInventory(hID)
	inv.listItemsFn = func(_ context.Context, _, _ uuid.UUID) ([]*inventory.ItemResponse, error) {
		return []*inventory.ItemResponse{}, nil
	}
	svc := grocery.NewService(repo, inv)
	resp, err := svc.AutoGenerate(context.Background(), invID, hID, uuid.New(), grocery.AutoGenerateRequest{})
	require.NoError(t, err)
	assert.NotEmpty(t, resp.ID)
	assert.Equal(t, 0, added)
}

func TestAutoGenerate_Mixed(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	belowID := uuid.New()
	atTargetID := uuid.New()
	added := 0
	repo := &mockRepo{
		createListFn: func(_ context.Context, inventoryID uuid.UUID, name string, createdBy uuid.UUID) (*grocery.GroceryList, error) {
			return &grocery.GroceryList{ID: uuid.New(), InventoryID: inventoryID, Name: name, Status: "active"}, nil
		},
		addItemFn: func(_ context.Context, _ uuid.UUID, invItemID *uuid.UUID, name string, qty float64, _ string, _ *string, _ int) (*grocery.GroceryListItem, error) {
			added++
			require.NotNil(t, invItemID)
			assert.Equal(t, belowID, *invItemID)
			assert.Equal(t, "Bread", name)
			assert.InDelta(t, 3.0, qty, 0.0001) // target 5 - effective 2
			return &grocery.GroceryListItem{ID: uuid.New(), Name: name, Quantity: qty}, nil
		},
	}
	inv := okInventory(hID)
	inv.listItemsFn = func(_ context.Context, _, _ uuid.UUID) ([]*inventory.ItemResponse, error) {
		return []*inventory.ItemResponse{
			{ID: belowID.String(), Name: "Bread", TargetQuantity: 5},
			{ID: atTargetID.String(), Name: "Rice", TargetQuantity: 3},
		}, nil
	}
	inv.getEffectiveQtyFn = func(_ context.Context, itemID, _ uuid.UUID) (float64, error) {
		if itemID == belowID {
			return 2, nil
		}
		return 3, nil
	}
	svc := grocery.NewService(repo, inv)
	resp, err := svc.AutoGenerate(context.Background(), invID, hID, uuid.New(), grocery.AutoGenerateRequest{})
	require.NoError(t, err)
	assert.NotEmpty(t, resp.ID)
	assert.Equal(t, 1, added)
}

func TestAutoGenerate_WrongHousehold(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	createCalled := 0
	repo := &mockRepo{
		createListFn: func(_ context.Context, inventoryID uuid.UUID, name string, createdBy uuid.UUID) (*grocery.GroceryList, error) {
			createCalled++
			return &grocery.GroceryList{ID: uuid.New(), InventoryID: inventoryID, Name: name, Status: "active"}, nil
		},
	}
	inv := &mockInventory{
		getInventoryFn: func(_ context.Context, _, _ uuid.UUID) (*inventory.InventoryResponse, error) {
			return nil, inventory.ErrNotFound
		},
	}
	svc := grocery.NewService(repo, inv)
	_, err := svc.AutoGenerate(context.Background(), invID, hID, uuid.New(), grocery.AutoGenerateRequest{})
	assert.ErrorIs(t, err, grocery.ErrNotFound)
	assert.Equal(t, 0, createCalled)
}

func TestAssertItemScope_CrossListRejection(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	listID := uuid.New()
	otherListID := uuid.New()
	itemID := uuid.New()
	repo := &mockRepo{
		getItemFn: func(_ context.Context, id uuid.UUID) (*grocery.GroceryListItem, error) {
			return &grocery.GroceryListItem{ID: id, GroceryListID: otherListID, Name: "Stray"}, nil
		},
		getListFn: func(_ context.Context, id uuid.UUID) (*grocery.GroceryList, error) {
			return &grocery.GroceryList{ID: id, InventoryID: invID, Status: "active"}, nil
		},
	}
	svc := grocery.NewService(repo, okInventory(hID))
	_, err := svc.GetItem(context.Background(), itemID, listID, hID)
	assert.ErrorIs(t, err, grocery.ErrNotFound)
}
