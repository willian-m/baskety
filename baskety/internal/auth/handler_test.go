package auth_test

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
)

type mockService struct {
	registerFn func(ctx context.Context, req auth.RegisterRequest) (*auth.UserResponse, error)
	loginFn    func(ctx context.Context, req auth.LoginRequest) (*auth.AuthResponse, error)
	logoutFn   func(ctx context.Context, sessionID uuid.UUID) error
}

func (m *mockService) Register(ctx context.Context, req auth.RegisterRequest) (*auth.UserResponse, error) {
	return m.registerFn(ctx, req)
}
func (m *mockService) Login(ctx context.Context, req auth.LoginRequest) (*auth.AuthResponse, error) {
	return m.loginFn(ctx, req)
}
func (m *mockService) Logout(ctx context.Context, sessionID uuid.UUID) error {
	return m.logoutFn(ctx, sessionID)
}

func setupRouter(svc auth.ServiceIface) *chi.Mux {
	r := chi.NewRouter()
	h := auth.NewHandler(svc)
	auth.RegisterRoutes(r, h)
	return r
}

func TestHandleRegister_Success(t *testing.T) {
	svc := &mockService{
		registerFn: func(_ context.Context, req auth.RegisterRequest) (*auth.UserResponse, error) {
			return &auth.UserResponse{ID: uuid.New().String(), Email: req.Email, Name: req.Name}, nil
		},
	}
	r := setupRouter(svc)
	body, _ := json.Marshal(auth.RegisterRequest{Email: "a@b.com", Name: "Alice", Password: "secret"})
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp["data"])
}

func TestHandleRegister_EmailTaken(t *testing.T) {
	svc := &mockService{
		registerFn: func(_ context.Context, _ auth.RegisterRequest) (*auth.UserResponse, error) {
			return nil, auth.ErrEmailTaken
		},
	}
	r := setupRouter(svc)
	body, _ := json.Marshal(auth.RegisterRequest{Email: "a@b.com", Name: "Alice", Password: "secret"})
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestHandleLogin_Success(t *testing.T) {
	svc := &mockService{
		loginFn: func(_ context.Context, _ auth.LoginRequest) (*auth.AuthResponse, error) {
			return &auth.AuthResponse{Token: "mytoken"}, nil
		},
	}
	r := setupRouter(svc)
	body, _ := json.Marshal(auth.LoginRequest{Email: "a@b.com", Password: "secret"})
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	data, ok := resp["data"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "mytoken", data["token"])
}

func TestHandleLogin_InvalidCredentials(t *testing.T) {
	svc := &mockService{
		loginFn: func(_ context.Context, _ auth.LoginRequest) (*auth.AuthResponse, error) {
			return nil, auth.ErrInvalidCredentials
		},
	}
	r := setupRouter(svc)
	body, _ := json.Marshal(auth.LoginRequest{Email: "a@b.com", Password: "wrong"})
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestHandleLogout_Success(t *testing.T) {
	sessionID := uuid.New()
	svc := &mockService{
		logoutFn: func(_ context.Context, id uuid.UUID) error {
			assert.Equal(t, sessionID, id)
			return nil
		},
	}
	r := setupRouter(svc)
	req := httptest.NewRequest(http.MethodDelete, "/session", nil)
	ctx := context.WithValue(req.Context(), auth.SessionIDContextKey, sessionID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestHandleLogout_Unauthorized(t *testing.T) {
	svc := &mockService{}
	r := setupRouter(svc)
	req := httptest.NewRequest(http.MethodDelete, "/session", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}
