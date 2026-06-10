package grocery_test

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
	"github.com/willian-m/baskety/internal/auth"
	"github.com/willian-m/baskety/internal/grocery"
	"github.com/willian-m/baskety/internal/household"
)

type mockService struct {
	createListFn       func(ctx context.Context, inventoryID, householdID, userID uuid.UUID, req grocery.CreateListRequest) (*grocery.ListResponse, error)
	getListFn          func(ctx context.Context, id, householdID uuid.UUID) (*grocery.ListResponse, error)
	listByInventoryFn  func(ctx context.Context, inventoryID, householdID uuid.UUID) ([]*grocery.ListResponse, error)
	completeListFn     func(ctx context.Context, id, householdID uuid.UUID) (*grocery.ListResponse, error)
	archiveListFn      func(ctx context.Context, id, householdID uuid.UUID) error
	addItemFn          func(ctx context.Context, listID, householdID uuid.UUID, req grocery.AddItemRequest) (*grocery.ItemResponse, error)
	getItemFn          func(ctx context.Context, itemID, listID, householdID uuid.UUID) (*grocery.ItemResponse, error)
	listItemsFn        func(ctx context.Context, listID, householdID uuid.UUID) ([]*grocery.ItemResponse, error)
	updateItemStatusFn func(ctx context.Context, itemID, listID, householdID uuid.UUID, req grocery.UpdateItemStatusRequest) (*grocery.ItemResponse, error)
	reorderItemFn      func(ctx context.Context, itemID, listID, householdID uuid.UUID, req grocery.ReorderItemRequest) error
	deleteItemFn       func(ctx context.Context, itemID, listID, householdID uuid.UUID) error
	autoGenerateFn     func(ctx context.Context, inventoryID, householdID, userID uuid.UUID, req grocery.AutoGenerateRequest) (*grocery.ListResponse, error)
}

func (m *mockService) CreateList(ctx context.Context, inventoryID, householdID, userID uuid.UUID, req grocery.CreateListRequest) (*grocery.ListResponse, error) {
	return m.createListFn(ctx, inventoryID, householdID, userID, req)
}
func (m *mockService) GetList(ctx context.Context, id, householdID uuid.UUID) (*grocery.ListResponse, error) {
	return m.getListFn(ctx, id, householdID)
}
func (m *mockService) ListByInventory(ctx context.Context, inventoryID, householdID uuid.UUID) ([]*grocery.ListResponse, error) {
	return m.listByInventoryFn(ctx, inventoryID, householdID)
}
func (m *mockService) CompleteList(ctx context.Context, id, householdID uuid.UUID) (*grocery.ListResponse, error) {
	return m.completeListFn(ctx, id, householdID)
}
func (m *mockService) ArchiveList(ctx context.Context, id, householdID uuid.UUID) error {
	return m.archiveListFn(ctx, id, householdID)
}
func (m *mockService) AddItem(ctx context.Context, listID, householdID uuid.UUID, req grocery.AddItemRequest) (*grocery.ItemResponse, error) {
	return m.addItemFn(ctx, listID, householdID, req)
}
func (m *mockService) GetItem(ctx context.Context, itemID, listID, householdID uuid.UUID) (*grocery.ItemResponse, error) {
	return m.getItemFn(ctx, itemID, listID, householdID)
}
func (m *mockService) ListItems(ctx context.Context, listID, householdID uuid.UUID) ([]*grocery.ItemResponse, error) {
	return m.listItemsFn(ctx, listID, householdID)
}
func (m *mockService) UpdateItemStatus(ctx context.Context, itemID, listID, householdID uuid.UUID, req grocery.UpdateItemStatusRequest) (*grocery.ItemResponse, error) {
	return m.updateItemStatusFn(ctx, itemID, listID, householdID, req)
}
func (m *mockService) ReorderItem(ctx context.Context, itemID, listID, householdID uuid.UUID, req grocery.ReorderItemRequest) error {
	return m.reorderItemFn(ctx, itemID, listID, householdID, req)
}
func (m *mockService) DeleteItem(ctx context.Context, itemID, listID, householdID uuid.UUID) error {
	return m.deleteItemFn(ctx, itemID, listID, householdID)
}
func (m *mockService) AutoGenerate(ctx context.Context, inventoryID, householdID, userID uuid.UUID, req grocery.AutoGenerateRequest) (*grocery.ListResponse, error) {
	return m.autoGenerateFn(ctx, inventoryID, householdID, userID, req)
}

func setupRouter(svc grocery.ServiceIface, householdID, userID uuid.UUID) *chi.Mux {
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := context.WithValue(req.Context(), household.HouseholdIDKey, householdID)
			ctx = context.WithValue(ctx, auth.UserIDKey, userID)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	h := grocery.NewHandler(svc)
	grocery.RegisterRoutes(r, h)
	return r
}

func TestHandleCreateList(t *testing.T) {
	hID, uID, invID := uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		createListFn: func(_ context.Context, _, _, _ uuid.UUID, req grocery.CreateListRequest) (*grocery.ListResponse, error) {
			return &grocery.ListResponse{ID: uuid.New().String(), Name: req.Name, Status: "active"}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(grocery.CreateListRequest{Name: "Weekly"})
	req := httptest.NewRequest(http.MethodPost, "/"+invID.String()+"/lists", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandleListByInventory(t *testing.T) {
	hID, uID, invID := uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		listByInventoryFn: func(_ context.Context, _, _ uuid.UUID) ([]*grocery.ListResponse, error) {
			return []*grocery.ListResponse{{ID: uuid.New().String(), Name: "L"}}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/"+invID.String()+"/lists", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp["data"])
}

func TestHandleCompleteList(t *testing.T) {
	hID, uID, invID, listID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		completeListFn: func(_ context.Context, _, _ uuid.UUID) (*grocery.ListResponse, error) {
			return &grocery.ListResponse{ID: listID.String(), Status: "completed"}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodPost, "/"+invID.String()+"/lists/"+listID.String()+"/complete", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleAddItem(t *testing.T) {
	hID, uID, invID, listID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		addItemFn: func(_ context.Context, _, _ uuid.UUID, req grocery.AddItemRequest) (*grocery.ItemResponse, error) {
			return &grocery.ItemResponse{ID: uuid.New().String(), Name: req.Name, Status: "pending"}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(grocery.AddItemRequest{Name: "Eggs", Quantity: 12})
	req := httptest.NewRequest(http.MethodPost, "/"+invID.String()+"/lists/"+listID.String()+"/items", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandleAutoGenerate(t *testing.T) {
	hID, uID, invID := uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		autoGenerateFn: func(_ context.Context, _, _, _ uuid.UUID, _ grocery.AutoGenerateRequest) (*grocery.ListResponse, error) {
			return &grocery.ListResponse{ID: uuid.New().String(), Name: "Auto-generated", Status: "active"}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodPost, "/"+invID.String()+"/lists/auto-generate", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandleGetList_NotFound(t *testing.T) {
	hID, uID, invID, listID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		getListFn: func(_ context.Context, _, _ uuid.UUID) (*grocery.ListResponse, error) {
			return nil, grocery.ErrNotFound
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/"+invID.String()+"/lists/"+listID.String(), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}
