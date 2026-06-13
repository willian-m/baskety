package inventory_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/household"
	"github.com/willian-m/baskety/internal/inventory"
)

type mockService struct {
	createInventoryFn   func(ctx context.Context, householdID uuid.UUID, req inventory.CreateInventoryRequest) (*inventory.InventoryResponse, error)
	getInventoryFn      func(ctx context.Context, id, householdID uuid.UUID) (*inventory.InventoryResponse, error)
	listInventoriesFn   func(ctx context.Context, householdID uuid.UUID) ([]*inventory.InventoryResponse, error)
	updateInventoryFn   func(ctx context.Context, id, householdID uuid.UUID, req inventory.UpdateInventoryRequest) (*inventory.InventoryResponse, error)
	deleteInventoryFn   func(ctx context.Context, id, householdID uuid.UUID) error
	createItemFn        func(ctx context.Context, inventoryID, householdID uuid.UUID, req inventory.CreateItemRequest) (*inventory.ItemResponse, error)
	getItemFn           func(ctx context.Context, id, householdID uuid.UUID) (*inventory.ItemResponse, error)
	listItemsFn         func(ctx context.Context, inventoryID, householdID uuid.UUID) ([]*inventory.ItemResponse, error)
	updateItemFn        func(ctx context.Context, id, householdID uuid.UUID, req inventory.UpdateItemRequest) (*inventory.ItemResponse, error)
	deleteItemFn        func(ctx context.Context, id, householdID uuid.UUID) error
	addBatchFn          func(ctx context.Context, itemID, householdID uuid.UUID, req inventory.AddBatchRequest) (*inventory.BatchResponse, error)
	listActiveBatchesFn func(ctx context.Context, itemID, householdID uuid.UUID) ([]*inventory.BatchResponse, error)
	markBatchEmptiedFn  func(ctx context.Context, batchID, householdID uuid.UUID) error
	getEffectiveQtyFn   func(ctx context.Context, itemID, householdID uuid.UUID) (float64, error)
}

func (m *mockService) CreateInventory(ctx context.Context, householdID uuid.UUID, req inventory.CreateInventoryRequest) (*inventory.InventoryResponse, error) {
	return m.createInventoryFn(ctx, householdID, req)
}
func (m *mockService) GetInventory(ctx context.Context, id, householdID uuid.UUID) (*inventory.InventoryResponse, error) {
	return m.getInventoryFn(ctx, id, householdID)
}
func (m *mockService) ListInventories(ctx context.Context, householdID uuid.UUID) ([]*inventory.InventoryResponse, error) {
	return m.listInventoriesFn(ctx, householdID)
}
func (m *mockService) UpdateInventory(ctx context.Context, id, householdID uuid.UUID, req inventory.UpdateInventoryRequest) (*inventory.InventoryResponse, error) {
	return m.updateInventoryFn(ctx, id, householdID, req)
}
func (m *mockService) DeleteInventory(ctx context.Context, id, householdID uuid.UUID) error {
	return m.deleteInventoryFn(ctx, id, householdID)
}
func (m *mockService) CreateItem(ctx context.Context, inventoryID, householdID uuid.UUID, req inventory.CreateItemRequest) (*inventory.ItemResponse, error) {
	return m.createItemFn(ctx, inventoryID, householdID, req)
}
func (m *mockService) GetItem(ctx context.Context, id, householdID uuid.UUID) (*inventory.ItemResponse, error) {
	return m.getItemFn(ctx, id, householdID)
}
func (m *mockService) ListItems(ctx context.Context, inventoryID, householdID uuid.UUID) ([]*inventory.ItemResponse, error) {
	return m.listItemsFn(ctx, inventoryID, householdID)
}
func (m *mockService) UpdateItem(ctx context.Context, id, householdID uuid.UUID, req inventory.UpdateItemRequest) (*inventory.ItemResponse, error) {
	return m.updateItemFn(ctx, id, householdID, req)
}
func (m *mockService) DeleteItem(ctx context.Context, id, householdID uuid.UUID) error {
	return m.deleteItemFn(ctx, id, householdID)
}
func (m *mockService) AddBatch(ctx context.Context, itemID, householdID uuid.UUID, req inventory.AddBatchRequest) (*inventory.BatchResponse, error) {
	return m.addBatchFn(ctx, itemID, householdID, req)
}
func (m *mockService) ListActiveBatches(ctx context.Context, itemID, householdID uuid.UUID) ([]*inventory.BatchResponse, error) {
	return m.listActiveBatchesFn(ctx, itemID, householdID)
}
func (m *mockService) MarkBatchEmptied(ctx context.Context, batchID, householdID uuid.UUID) error {
	return m.markBatchEmptiedFn(ctx, batchID, householdID)
}
func (m *mockService) GetEffectiveQuantity(ctx context.Context, itemID, householdID uuid.UUID) (float64, error) {
	return m.getEffectiveQtyFn(ctx, itemID, householdID)
}

func setupRouter(svc inventory.ServiceIface, householdID uuid.UUID) *chi.Mux {
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := context.WithValue(req.Context(), household.HouseholdIDKey, householdID)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	h := inventory.NewHandler(svc)
	inventory.RegisterRoutes(r, h)
	return r
}

func TestHandleCreateInventory(t *testing.T) {
	hID := uuid.New()
	svc := &mockService{
		createInventoryFn: func(_ context.Context, _ uuid.UUID, req inventory.CreateInventoryRequest) (*inventory.InventoryResponse, error) {
			return &inventory.InventoryResponse{ID: uuid.New().String(), Name: req.Name}, nil
		},
	}
	r := setupRouter(svc, hID)
	body, _ := json.Marshal(inventory.CreateInventoryRequest{Name: "Pantry"})
	req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandleListInventories(t *testing.T) {
	hID := uuid.New()
	svc := &mockService{
		listInventoriesFn: func(_ context.Context, _ uuid.UUID) ([]*inventory.InventoryResponse, error) {
			return []*inventory.InventoryResponse{{ID: uuid.New().String(), Name: "P"}}, nil
		},
	}
	r := setupRouter(svc, hID)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp["data"])
}

func TestHandleGetInventory_NotFound(t *testing.T) {
	hID := uuid.New()
	svc := &mockService{
		getInventoryFn: func(_ context.Context, _, _ uuid.UUID) (*inventory.InventoryResponse, error) {
			return nil, inventory.ErrNotFound
		},
	}
	r := setupRouter(svc, hID)
	req := httptest.NewRequest(http.MethodGet, "/"+uuid.New().String(), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleListItems(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	itemID := uuid.New()
	svc := &mockService{
		listItemsFn: func(_ context.Context, _, _ uuid.UUID) ([]*inventory.ItemResponse, error) {
			return []*inventory.ItemResponse{
				{
					ID:             itemID.String(),
					InventoryID:    invID.String(),
					Name:           "Milk",
					Category:       "Dairy",
					Unit:           "L",
					TargetQuantity: 4,
					StoredQuantity: 2.5,
					BatchCount:     1,
				},
			}, nil
		},
	}
	r := setupRouter(svc, hID)
	req := httptest.NewRequest(http.MethodGet, "/"+invID.String()+"/items", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	data, ok := resp["data"].([]any)
	require.True(t, ok, "data should be an array")
	require.Len(t, data, 1)
	item := data[0].(map[string]any)
	assert.Equal(t, 2.5, item["stored_quantity"])
	assert.Equal(t, float64(1), item["batch_count"])
}

func TestHandleCreateItem(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	svc := &mockService{
		createItemFn: func(_ context.Context, _, _ uuid.UUID, req inventory.CreateItemRequest) (*inventory.ItemResponse, error) {
			return &inventory.ItemResponse{ID: uuid.New().String(), Name: req.Name}, nil
		},
	}
	r := setupRouter(svc, hID)
	body, _ := json.Marshal(inventory.CreateItemRequest{Name: "Milk", TargetQuantity: 2})
	req := httptest.NewRequest(http.MethodPost, "/"+invID.String()+"/items", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandleAddBatch(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	itemID := uuid.New()
	svc := &mockService{
		addBatchFn: func(_ context.Context, _, _ uuid.UUID, req inventory.AddBatchRequest) (*inventory.BatchResponse, error) {
			return &inventory.BatchResponse{ID: uuid.New().String(), Quantity: req.Quantity}, nil
		},
	}
	r := setupRouter(svc, hID)
	body, _ := json.Marshal(inventory.AddBatchRequest{Quantity: 3})
	req := httptest.NewRequest(http.MethodPost, "/"+invID.String()+"/items/"+itemID.String()+"/batches", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandleMarkBatchEmptied(t *testing.T) {
	hID := uuid.New()
	invID := uuid.New()
	itemID := uuid.New()
	batchID := uuid.New()
	svc := &mockService{
		markBatchEmptiedFn: func(_ context.Context, _, _ uuid.UUID) error { return nil },
	}
	r := setupRouter(svc, hID)
	req := httptest.NewRequest(http.MethodPost, "/"+invID.String()+"/items/"+itemID.String()+"/batches/"+batchID.String()+"/empty", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}
