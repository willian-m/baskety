package household_test

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
	"github.com/willian-m/baskety/internal/household"
)

type mockService struct {
	createHouseholdFn func(ctx context.Context, name string, createdBy uuid.UUID) (*household.HouseholdResponse, error)
	getHouseholdFn    func(ctx context.Context, id uuid.UUID, requestingUserID uuid.UUID) (*household.HouseholdResponse, error)
	listHouseholdsFn  func(ctx context.Context, userID uuid.UUID) ([]household.HouseholdResponse, error)
	addMemberFn       func(ctx context.Context, householdID, invitedByUserID uuid.UUID, req household.AddMemberRequest) (*household.MemberResponse, error)
	removeMemberFn    func(ctx context.Context, householdID, userID uuid.UUID) error
	createShareLinkFn func(ctx context.Context, req household.CreateShareLinkRequest, createdByUserID uuid.UUID) (*household.ShareLinkResponse, error)
}

func (m *mockService) CreateHousehold(ctx context.Context, name string, createdBy uuid.UUID) (*household.HouseholdResponse, error) {
	return m.createHouseholdFn(ctx, name, createdBy)
}
func (m *mockService) GetHousehold(ctx context.Context, id uuid.UUID, requestingUserID uuid.UUID) (*household.HouseholdResponse, error) {
	return m.getHouseholdFn(ctx, id, requestingUserID)
}
func (m *mockService) ListHouseholds(ctx context.Context, userID uuid.UUID) ([]household.HouseholdResponse, error) {
	return m.listHouseholdsFn(ctx, userID)
}
func (m *mockService) AddMember(ctx context.Context, householdID, invitedByUserID uuid.UUID, req household.AddMemberRequest) (*household.MemberResponse, error) {
	return m.addMemberFn(ctx, householdID, invitedByUserID, req)
}
func (m *mockService) RemoveMember(ctx context.Context, householdID, userID uuid.UUID) error {
	return m.removeMemberFn(ctx, householdID, userID)
}
func (m *mockService) CreateShareLink(ctx context.Context, req household.CreateShareLinkRequest, createdByUserID uuid.UUID) (*household.ShareLinkResponse, error) {
	return m.createShareLinkFn(ctx, req, createdByUserID)
}

func setupRouter(svc household.ServiceIface) *chi.Mux {
	r := chi.NewRouter()
	h := household.NewHandler(svc)
	household.RegisterRoutes(r, h)
	return r
}

func withUserID(req *http.Request, id uuid.UUID) *http.Request {
	ctx := context.WithValue(req.Context(), auth.UserIDKey, id)
	return req.WithContext(ctx)
}

func TestHandleListHouseholds(t *testing.T) {
	userID := uuid.New()
	svc := &mockService{
		listHouseholdsFn: func(_ context.Context, _ uuid.UUID) ([]household.HouseholdResponse, error) {
			return []household.HouseholdResponse{{ID: uuid.New().String(), Name: "H1"}}, nil
		},
	}
	r := setupRouter(svc)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = withUserID(req, userID)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp["data"])
}

func TestHandleCreateHousehold(t *testing.T) {
	userID := uuid.New()
	svc := &mockService{
		createHouseholdFn: func(_ context.Context, name string, _ uuid.UUID) (*household.HouseholdResponse, error) {
			return &household.HouseholdResponse{ID: uuid.New().String(), Name: name}, nil
		},
	}
	r := setupRouter(svc)
	body, _ := json.Marshal(household.CreateHouseholdRequest{Name: "My House"})
	req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withUserID(req, userID)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandleGetHousehold(t *testing.T) {
	hID := uuid.New()
	userID := uuid.New()
	svc := &mockService{
		getHouseholdFn: func(_ context.Context, id uuid.UUID, _ uuid.UUID) (*household.HouseholdResponse, error) {
			return &household.HouseholdResponse{ID: id.String(), Name: "H1"}, nil
		},
	}
	r := setupRouter(svc)
	req := httptest.NewRequest(http.MethodGet, "/"+hID.String(), nil)
	req = withUserID(req, userID)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleGetHousehold_NotFound(t *testing.T) {
	userID := uuid.New()
	svc := &mockService{
		getHouseholdFn: func(_ context.Context, _ uuid.UUID, _ uuid.UUID) (*household.HouseholdResponse, error) {
			return nil, household.ErrNotFound
		},
	}
	r := setupRouter(svc)
	req := httptest.NewRequest(http.MethodGet, "/"+uuid.New().String(), nil)
	req = withUserID(req, userID)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleAddMember(t *testing.T) {
	hID := uuid.New()
	userID := uuid.New()
	svc := &mockService{
		addMemberFn: func(_ context.Context, _, _ uuid.UUID, req household.AddMemberRequest) (*household.MemberResponse, error) {
			return &household.MemberResponse{UserID: req.UserID, Role: req.Role}, nil
		},
	}
	r := setupRouter(svc)
	body, _ := json.Marshal(household.AddMemberRequest{UserID: uuid.New().String(), Role: "member"})
	req := httptest.NewRequest(http.MethodPost, "/"+hID.String()+"/members", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withUserID(req, userID)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandleRemoveMember(t *testing.T) {
	hID := uuid.New()
	memberID := uuid.New()
	svc := &mockService{
		removeMemberFn: func(_ context.Context, _, _ uuid.UUID) error { return nil },
	}
	r := setupRouter(svc)
	req := httptest.NewRequest(http.MethodDelete, "/"+hID.String()+"/members/"+memberID.String(), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestHandleCreateShareLink(t *testing.T) {
	invID := uuid.New()
	userID := uuid.New()
	svc := &mockService{
		createShareLinkFn: func(_ context.Context, _ household.CreateShareLinkRequest, _ uuid.UUID) (*household.ShareLinkResponse, error) {
			return &household.ShareLinkResponse{ID: uuid.New().String(), Token: "tok123"}, nil
		},
	}
	r := setupRouter(svc)
	body, _ := json.Marshal(household.CreateShareLinkRequest{InventoryID: invID.String()})
	req := httptest.NewRequest(http.MethodPost, "/"+uuid.New().String()+"/share-links", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withUserID(req, userID)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}
