package receipt_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/auth"
	"github.com/willian-m/baskety/internal/household"
	"github.com/willian-m/baskety/internal/receipt"
)

type mockService struct {
	uploadScanFn     func(ctx context.Context, householdID, userID uuid.UUID, groceryListID *uuid.UUID, filename string, r io.Reader) (*receipt.ScanResponse, error)
	getScanFn        func(ctx context.Context, id, householdID uuid.UUID) (*receipt.ScanResponse, error)
	listScansFn      func(ctx context.Context, householdID uuid.UUID) ([]*receipt.ScanResponse, error)
	getScanItemsFn   func(ctx context.Context, scanID, householdID uuid.UUID) ([]*receipt.ScanItemResponse, error)
	updateScanItemFn func(ctx context.Context, itemID, scanID, householdID uuid.UUID, req receipt.UpdateScanItemRequest) (*receipt.ScanItemResponse, error)
	commitScanFn     func(ctx context.Context, scanID, householdID uuid.UUID, req receipt.CommitScanRequest) (*receipt.ScanResponse, error)
}

func (m *mockService) UploadScan(ctx context.Context, householdID, userID uuid.UUID, groceryListID *uuid.UUID, filename string, r io.Reader) (*receipt.ScanResponse, error) {
	return m.uploadScanFn(ctx, householdID, userID, groceryListID, filename, r)
}
func (m *mockService) GetScan(ctx context.Context, id, householdID uuid.UUID) (*receipt.ScanResponse, error) {
	return m.getScanFn(ctx, id, householdID)
}
func (m *mockService) ListScans(ctx context.Context, householdID uuid.UUID) ([]*receipt.ScanResponse, error) {
	return m.listScansFn(ctx, householdID)
}
func (m *mockService) GetScanItems(ctx context.Context, scanID, householdID uuid.UUID) ([]*receipt.ScanItemResponse, error) {
	return m.getScanItemsFn(ctx, scanID, householdID)
}
func (m *mockService) UpdateScanItem(ctx context.Context, itemID, scanID, householdID uuid.UUID, req receipt.UpdateScanItemRequest) (*receipt.ScanItemResponse, error) {
	return m.updateScanItemFn(ctx, itemID, scanID, householdID, req)
}
func (m *mockService) CommitScan(ctx context.Context, scanID, householdID uuid.UUID, req receipt.CommitScanRequest) (*receipt.ScanResponse, error) {
	return m.commitScanFn(ctx, scanID, householdID, req)
}

func setupRouter(svc receipt.ServiceIface, householdID, userID uuid.UUID) *chi.Mux {
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := context.WithValue(req.Context(), household.HouseholdIDKey, householdID)
			ctx = context.WithValue(ctx, auth.UserIDKey, userID)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	h := receipt.NewHandler(svc)
	receipt.RegisterRoutes(r, h)
	return r
}

func fakeScanResponse() *receipt.ScanResponse {
	return &receipt.ScanResponse{
		ID:          uuid.New().String(),
		HouseholdID: uuid.New().String(),
		Status:      "pending_processing",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

func TestHandleUploadScan_HappyPath(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		uploadScanFn: func(_ context.Context, _, _ uuid.UUID, _ *uuid.UUID, _ string, _ io.Reader) (*receipt.ScanResponse, error) {
			return fakeScanResponse(), nil
		},
	}
	r := setupRouter(svc, hID, uID)

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile("image", "receipt.jpg")
	require.NoError(t, err)
	_, err = fw.Write([]byte("fake-image-data"))
	require.NoError(t, err)
	mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandleUploadScan_MissingImageField(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{}
	r := setupRouter(svc, hID, uID)

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleListScans_HappyPath(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		listScansFn: func(_ context.Context, _ uuid.UUID) ([]*receipt.ScanResponse, error) {
			return []*receipt.ScanResponse{fakeScanResponse()}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp["data"])
}

func TestHandleGetScan_HappyPath(t *testing.T) {
	hID, uID, scanID := uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		getScanFn: func(_ context.Context, _, _ uuid.UUID) (*receipt.ScanResponse, error) {
			return fakeScanResponse(), nil
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/"+scanID.String(), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleGetScan_NotFound(t *testing.T) {
	hID, uID, scanID := uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		getScanFn: func(_ context.Context, _, _ uuid.UUID) (*receipt.ScanResponse, error) {
			return nil, receipt.ErrNotFound
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/"+scanID.String(), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleGetScanItems_HappyPath(t *testing.T) {
	hID, uID, scanID := uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		getScanItemsFn: func(_ context.Context, _, _ uuid.UUID) ([]*receipt.ScanItemResponse, error) {
			return []*receipt.ScanItemResponse{{ID: uuid.New().String(), Status: "pending"}}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/"+scanID.String()+"/items", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleGetScanItems_NotFound(t *testing.T) {
	hID, uID, scanID := uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		getScanItemsFn: func(_ context.Context, _, _ uuid.UUID) ([]*receipt.ScanItemResponse, error) {
			return nil, receipt.ErrNotFound
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/"+scanID.String()+"/items", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleUpdateScanItem_HappyPath(t *testing.T) {
	hID, uID, scanID, itemID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		updateScanItemFn: func(_ context.Context, _, _, _ uuid.UUID, req receipt.UpdateScanItemRequest) (*receipt.ScanItemResponse, error) {
			return &receipt.ScanItemResponse{ID: itemID.String(), Status: req.Status}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(receipt.UpdateScanItemRequest{Status: "accepted"})
	req := httptest.NewRequest(http.MethodPut, "/"+scanID.String()+"/items/"+itemID.String(), bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleUpdateScanItem_InvalidJSON(t *testing.T) {
	hID, uID, scanID, itemID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodPut, "/"+scanID.String()+"/items/"+itemID.String(), bytes.NewReader([]byte("not-json")))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleCommitScan_HappyPath(t *testing.T) {
	hID, uID, scanID := uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		commitScanFn: func(_ context.Context, _, _ uuid.UUID, _ receipt.CommitScanRequest) (*receipt.ScanResponse, error) {
			s := fakeScanResponse()
			s.Status = "committed"
			return s, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(receipt.CommitScanRequest{PurchasedAt: time.Now()})
	req := httptest.NewRequest(http.MethodPost, "/"+scanID.String()+"/commit", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleCommitScan_NotFound(t *testing.T) {
	hID, uID, scanID := uuid.New(), uuid.New(), uuid.New()
	svc := &mockService{
		commitScanFn: func(_ context.Context, _, _ uuid.UUID, _ receipt.CommitScanRequest) (*receipt.ScanResponse, error) {
			return nil, receipt.ErrNotFound
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(receipt.CommitScanRequest{PurchasedAt: time.Now()})
	req := httptest.NewRequest(http.MethodPost, "/"+scanID.String()+"/commit", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}
