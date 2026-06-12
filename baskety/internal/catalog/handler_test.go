package catalog_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/catalog"
	"github.com/willian-m/baskety/internal/household"
)

type mockService struct {
	createStoreFn        func(ctx context.Context, householdID uuid.UUID, req catalog.CreateStoreRequest) (*catalog.StoreResponse, error)
	listStoresFn         func(ctx context.Context, householdID uuid.UUID) ([]*catalog.StoreResponse, error)
	createCatalogEntryFn func(ctx context.Context, householdID uuid.UUID, req catalog.CreateCatalogEntryRequest) (*catalog.CatalogEntryResponse, error)
	listCatalogEntriesFn func(ctx context.Context, householdID uuid.UUID) ([]*catalog.CatalogEntryResponse, error)
	listTransactionsFn   func(ctx context.Context, householdID uuid.UUID, catalogEntryID *uuid.UUID) ([]*catalog.TransactionResponse, error)
}

func (m *mockService) CreateStore(ctx context.Context, householdID uuid.UUID, req catalog.CreateStoreRequest) (*catalog.StoreResponse, error) {
	return m.createStoreFn(ctx, householdID, req)
}
func (m *mockService) ListStores(ctx context.Context, householdID uuid.UUID) ([]*catalog.StoreResponse, error) {
	return m.listStoresFn(ctx, householdID)
}
func (m *mockService) CreateCatalogEntry(ctx context.Context, householdID uuid.UUID, req catalog.CreateCatalogEntryRequest) (*catalog.CatalogEntryResponse, error) {
	return m.createCatalogEntryFn(ctx, householdID, req)
}
func (m *mockService) ListCatalogEntries(ctx context.Context, householdID uuid.UUID) ([]*catalog.CatalogEntryResponse, error) {
	return m.listCatalogEntriesFn(ctx, householdID)
}
func (m *mockService) ListTransactions(ctx context.Context, householdID uuid.UUID, catalogEntryID *uuid.UUID) ([]*catalog.TransactionResponse, error) {
	return m.listTransactionsFn(ctx, householdID, catalogEntryID)
}

func setupRouter(svc catalog.ServiceIface, householdID uuid.UUID) *chi.Mux {
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := context.WithValue(req.Context(), household.HouseholdIDKey, householdID)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	h := catalog.NewHandler(svc)
	catalog.RegisterRoutes(r, h)
	return r
}

func fakeStore() *catalog.StoreResponse {
	return &catalog.StoreResponse{ID: uuid.New().String(), Name: "Test Store", CreatedAt: time.Now(), UpdatedAt: time.Now()}
}

func fakeEntry() *catalog.CatalogEntryResponse {
	return &catalog.CatalogEntryResponse{ID: uuid.New().String(), Name: "Test Product", Scope: "private", CreatedAt: time.Now(), UpdatedAt: time.Now()}
}

func fakeTxn() *catalog.TransactionResponse {
	return &catalog.TransactionResponse{ID: uuid.New().String(), HouseholdID: uuid.New().String(), Currency: "USD", PurchasedAt: time.Now(), CreatedAt: time.Now()}
}

func TestHandleListStores(t *testing.T) {
	hID := uuid.New()
	svc := &mockService{
		listStoresFn: func(_ context.Context, _ uuid.UUID) ([]*catalog.StoreResponse, error) {
			return []*catalog.StoreResponse{fakeStore()}, nil
		},
	}
	r := setupRouter(svc, hID)
	req := httptest.NewRequest(http.MethodGet, "/stores", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp["data"])
}

func TestHandleCreateStore(t *testing.T) {
	hID := uuid.New()
	svc := &mockService{
		createStoreFn: func(_ context.Context, _ uuid.UUID, req catalog.CreateStoreRequest) (*catalog.StoreResponse, error) {
			return &catalog.StoreResponse{ID: uuid.New().String(), Name: req.Name, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
		},
	}
	r := setupRouter(svc, hID)
	body, _ := json.Marshal(catalog.CreateStoreRequest{Name: "Whole Foods"})
	req := httptest.NewRequest(http.MethodPost, "/stores", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandleCreateStore_InvalidJSON(t *testing.T) {
	hID := uuid.New()
	svc := &mockService{}
	r := setupRouter(svc, hID)
	req := httptest.NewRequest(http.MethodPost, "/stores", bytes.NewReader([]byte("not-json")))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleListCatalogEntries(t *testing.T) {
	hID := uuid.New()
	svc := &mockService{
		listCatalogEntriesFn: func(_ context.Context, _ uuid.UUID) ([]*catalog.CatalogEntryResponse, error) {
			return []*catalog.CatalogEntryResponse{fakeEntry()}, nil
		},
	}
	r := setupRouter(svc, hID)
	req := httptest.NewRequest(http.MethodGet, "/entries", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp["data"])
}

func TestHandleCreateCatalogEntry(t *testing.T) {
	hID := uuid.New()
	svc := &mockService{
		createCatalogEntryFn: func(_ context.Context, _ uuid.UUID, req catalog.CreateCatalogEntryRequest) (*catalog.CatalogEntryResponse, error) {
			return &catalog.CatalogEntryResponse{ID: uuid.New().String(), Name: req.Name, Scope: "private", CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
		},
	}
	r := setupRouter(svc, hID)
	body, _ := json.Marshal(catalog.CreateCatalogEntryRequest{Name: "Rice", Scope: "private"})
	req := httptest.NewRequest(http.MethodPost, "/entries", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandleListTransactions(t *testing.T) {
	hID := uuid.New()
	svc := &mockService{
		listTransactionsFn: func(_ context.Context, _ uuid.UUID, catEntryID *uuid.UUID) ([]*catalog.TransactionResponse, error) {
			assert.Nil(t, catEntryID)
			return []*catalog.TransactionResponse{fakeTxn()}, nil
		},
	}
	r := setupRouter(svc, hID)
	req := httptest.NewRequest(http.MethodGet, "/transactions", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleListTransactions_WithCatalogEntryID(t *testing.T) {
	hID := uuid.New()
	entryID := uuid.New()
	var capturedEntryID *uuid.UUID
	svc := &mockService{
		listTransactionsFn: func(_ context.Context, _ uuid.UUID, catEntryID *uuid.UUID) ([]*catalog.TransactionResponse, error) {
			capturedEntryID = catEntryID
			return []*catalog.TransactionResponse{fakeTxn()}, nil
		},
	}
	r := setupRouter(svc, hID)
	req := httptest.NewRequest(http.MethodGet, "/transactions?catalog_entry_id="+entryID.String(), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	require.NotNil(t, capturedEntryID)
	assert.Equal(t, entryID, *capturedEntryID)
}

func TestHandleListTransactions_InvalidCatalogEntryID(t *testing.T) {
	hID := uuid.New()
	svc := &mockService{}
	r := setupRouter(svc, hID)
	req := httptest.NewRequest(http.MethodGet, "/transactions?catalog_entry_id=not-a-uuid", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}
