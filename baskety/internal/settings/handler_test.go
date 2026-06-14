package settings_test

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
	"github.com/willian-m/baskety/internal/auth"
	"github.com/willian-m/baskety/internal/household"
	"github.com/willian-m/baskety/internal/settings"
)

type mockService struct {
	getHouseholdSettingFn    func(ctx context.Context, householdID uuid.UUID, key string) (*settings.HouseholdSetting, error)
	upsertHouseholdSettingFn func(ctx context.Context, householdID uuid.UUID, key, value string) error
	getUserSettingFn         func(ctx context.Context, userID uuid.UUID, key string) (*settings.UserSetting, error)
	upsertUserSettingFn      func(ctx context.Context, userID uuid.UUID, key, value string) error
	listLLMProvidersFn       func(ctx context.Context, householdID uuid.UUID) ([]*settings.LLMProviderConfig, error)
	createLLMProviderFn      func(ctx context.Context, householdID uuid.UUID, req settings.CreateLLMProviderRequest) (*settings.LLMProviderConfig, error)
	updateLLMProviderFn      func(ctx context.Context, householdID, id uuid.UUID, req settings.UpdateLLMProviderRequest) (*settings.LLMProviderConfig, error)
	deleteLLMProviderFn      func(ctx context.Context, householdID, id uuid.UUID) error
	listOCRProvidersFn       func(ctx context.Context, householdID uuid.UUID) ([]*settings.OCRProviderConfig, error)
	createOCRProviderFn      func(ctx context.Context, householdID uuid.UUID, req settings.CreateOCRProviderRequest) (*settings.OCRProviderConfig, error)
	updateOCRProviderFn      func(ctx context.Context, householdID, id uuid.UUID, req settings.UpdateOCRProviderRequest) (*settings.OCRProviderConfig, error)
	deleteOCRProviderFn      func(ctx context.Context, householdID, id uuid.UUID) error
}

func (m *mockService) GetHouseholdSetting(ctx context.Context, householdID uuid.UUID, key string) (*settings.HouseholdSetting, error) {
	return m.getHouseholdSettingFn(ctx, householdID, key)
}
func (m *mockService) UpsertHouseholdSetting(ctx context.Context, householdID uuid.UUID, key, value string) error {
	return m.upsertHouseholdSettingFn(ctx, householdID, key, value)
}
func (m *mockService) GetUserSetting(ctx context.Context, userID uuid.UUID, key string) (*settings.UserSetting, error) {
	return m.getUserSettingFn(ctx, userID, key)
}
func (m *mockService) UpsertUserSetting(ctx context.Context, userID uuid.UUID, key, value string) error {
	return m.upsertUserSettingFn(ctx, userID, key, value)
}
func (m *mockService) ListLLMProviders(ctx context.Context, householdID uuid.UUID) ([]*settings.LLMProviderConfig, error) {
	return m.listLLMProvidersFn(ctx, householdID)
}
func (m *mockService) CreateLLMProvider(ctx context.Context, householdID uuid.UUID, req settings.CreateLLMProviderRequest) (*settings.LLMProviderConfig, error) {
	return m.createLLMProviderFn(ctx, householdID, req)
}
func (m *mockService) UpdateLLMProvider(ctx context.Context, householdID, id uuid.UUID, req settings.UpdateLLMProviderRequest) (*settings.LLMProviderConfig, error) {
	return m.updateLLMProviderFn(ctx, householdID, id, req)
}
func (m *mockService) DeleteLLMProvider(ctx context.Context, householdID, id uuid.UUID) error {
	return m.deleteLLMProviderFn(ctx, householdID, id)
}
func (m *mockService) ListOCRProviders(ctx context.Context, householdID uuid.UUID) ([]*settings.OCRProviderConfig, error) {
	return m.listOCRProvidersFn(ctx, householdID)
}
func (m *mockService) CreateOCRProvider(ctx context.Context, householdID uuid.UUID, req settings.CreateOCRProviderRequest) (*settings.OCRProviderConfig, error) {
	return m.createOCRProviderFn(ctx, householdID, req)
}
func (m *mockService) UpdateOCRProvider(ctx context.Context, householdID, id uuid.UUID, req settings.UpdateOCRProviderRequest) (*settings.OCRProviderConfig, error) {
	return m.updateOCRProviderFn(ctx, householdID, id, req)
}
func (m *mockService) DeleteOCRProvider(ctx context.Context, householdID, id uuid.UUID) error {
	return m.deleteOCRProviderFn(ctx, householdID, id)
}

func setupRouter(svc settings.ServiceIface, householdID, userID uuid.UUID) *chi.Mux {
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := context.WithValue(req.Context(), household.HouseholdIDKey, householdID)
			ctx = context.WithValue(ctx, auth.UserIDKey, userID)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	h := settings.NewHandler(svc)
	settings.RegisterRoutes(r, h)
	return r
}

func fakeLLMProvider() *settings.LLMProviderConfig {
	return &settings.LLMProviderConfig{
		ID:        uuid.New(),
		Provider:  "ollama",
		Model:     "llama3",
		IsDefault: true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func fakeOCRProvider() *settings.OCRProviderConfig {
	return &settings.OCRProviderConfig{
		ID:        uuid.New(),
		Provider:  "tesseract",
		IsDefault: false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func TestHandleGetHouseholdSetting(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		getHouseholdSettingFn: func(_ context.Context, _ uuid.UUID, key string) (*settings.HouseholdSetting, error) {
			return &settings.HouseholdSetting{Key: key, Value: "dark", UpdatedAt: time.Now()}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/household/theme", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, "theme", data["key"])
	assert.Equal(t, "dark", data["value"])
}

func TestHandleGetHouseholdSetting_NotFound(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		getHouseholdSettingFn: func(_ context.Context, _ uuid.UUID, _ string) (*settings.HouseholdSetting, error) {
			return nil, settings.ErrNotFound
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/household/missing", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleUpsertHouseholdSetting(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		upsertHouseholdSettingFn: func(_ context.Context, _ uuid.UUID, _, _ string) error {
			return nil
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(settings.UpsertSettingRequest{Value: "dark"})
	req := httptest.NewRequest(http.MethodPut, "/household/theme", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleGetUserSetting(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		getUserSettingFn: func(_ context.Context, _ uuid.UUID, key string) (*settings.UserSetting, error) {
			return &settings.UserSetting{Key: key, Value: "pt-BR", UpdatedAt: time.Now()}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/user/language", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, "pt-BR", data["value"])
}

func TestHandleGetUserSetting_NotFound(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		getUserSettingFn: func(_ context.Context, _ uuid.UUID, _ string) (*settings.UserSetting, error) {
			return nil, settings.ErrNotFound
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/user/missing", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleUpsertUserSetting(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		upsertUserSettingFn: func(_ context.Context, _ uuid.UUID, _, _ string) error {
			return nil
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(settings.UpsertSettingRequest{Value: "pt-BR"})
	req := httptest.NewRequest(http.MethodPut, "/user/language", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleListLLMProviders(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		listLLMProvidersFn: func(_ context.Context, _ uuid.UUID) ([]*settings.LLMProviderConfig, error) {
			return []*settings.LLMProviderConfig{fakeLLMProvider()}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/providers/llm", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp["data"])
}

func TestHandleCreateLLMProvider(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		createLLMProviderFn: func(_ context.Context, _ uuid.UUID, req settings.CreateLLMProviderRequest) (*settings.LLMProviderConfig, error) {
			return &settings.LLMProviderConfig{ID: uuid.New(), Provider: req.Provider, Model: req.Model, IsDefault: req.IsDefault, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(settings.CreateLLMProviderRequest{Provider: "ollama", Model: "llama3", IsDefault: true})
	req := httptest.NewRequest(http.MethodPost, "/providers/llm", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandleUpdateLLMProvider(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	id := uuid.New()
	svc := &mockService{
		updateLLMProviderFn: func(_ context.Context, _, gotID uuid.UUID, req settings.UpdateLLMProviderRequest) (*settings.LLMProviderConfig, error) {
			assert.Equal(t, id, gotID)
			return &settings.LLMProviderConfig{ID: gotID, Provider: req.Provider, Model: req.Model, IsDefault: req.IsDefault, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(settings.UpdateLLMProviderRequest{Provider: "openai", Model: "gpt-4o", IsDefault: true})
	req := httptest.NewRequest(http.MethodPatch, "/providers/llm/"+id.String(), bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, "openai", data["provider"])
	assert.Equal(t, "gpt-4o", data["model"])
}

func TestHandleUpdateLLMProvider_InvalidUUID(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(settings.UpdateLLMProviderRequest{Provider: "openai", Model: "gpt-4o"})
	req := httptest.NewRequest(http.MethodPatch, "/providers/llm/not-a-uuid", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleUpdateLLMProvider_BadJSON(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodPatch, "/providers/llm/"+uuid.New().String(), bytes.NewReader([]byte("{not json")))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleUpdateLLMProvider_NotFound(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		updateLLMProviderFn: func(_ context.Context, _, _ uuid.UUID, _ settings.UpdateLLMProviderRequest) (*settings.LLMProviderConfig, error) {
			return nil, settings.ErrNotFound
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(settings.UpdateLLMProviderRequest{Provider: "openai", Model: "gpt-4o"})
	req := httptest.NewRequest(http.MethodPatch, "/providers/llm/"+uuid.New().String(), bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleDeleteLLMProvider(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	id := uuid.New()
	svc := &mockService{
		deleteLLMProviderFn: func(_ context.Context, _, gotID uuid.UUID) error {
			assert.Equal(t, id, gotID)
			return nil
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodDelete, "/providers/llm/"+id.String(), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestHandleDeleteLLMProvider_InvalidUUID(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodDelete, "/providers/llm/not-a-uuid", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleDeleteLLMProvider_NotFound(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		deleteLLMProviderFn: func(_ context.Context, _, _ uuid.UUID) error {
			return settings.ErrNotFound
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodDelete, "/providers/llm/"+uuid.New().String(), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleUpdateOCRProvider(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	id := uuid.New()
	svc := &mockService{
		updateOCRProviderFn: func(_ context.Context, _, gotID uuid.UUID, req settings.UpdateOCRProviderRequest) (*settings.OCRProviderConfig, error) {
			assert.Equal(t, id, gotID)
			return &settings.OCRProviderConfig{ID: gotID, Provider: req.Provider, IsDefault: req.IsDefault, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(settings.UpdateOCRProviderRequest{Provider: "easyocr", IsDefault: true})
	req := httptest.NewRequest(http.MethodPatch, "/providers/ocr/"+id.String(), bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, "easyocr", data["provider"])
}

func TestHandleUpdateOCRProvider_InvalidUUID(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(settings.UpdateOCRProviderRequest{Provider: "easyocr"})
	req := httptest.NewRequest(http.MethodPatch, "/providers/ocr/not-a-uuid", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleUpdateOCRProvider_BadJSON(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodPatch, "/providers/ocr/"+uuid.New().String(), bytes.NewReader([]byte("{not json")))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleUpdateOCRProvider_NotFound(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		updateOCRProviderFn: func(_ context.Context, _, _ uuid.UUID, _ settings.UpdateOCRProviderRequest) (*settings.OCRProviderConfig, error) {
			return nil, settings.ErrNotFound
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(settings.UpdateOCRProviderRequest{Provider: "easyocr"})
	req := httptest.NewRequest(http.MethodPatch, "/providers/ocr/"+uuid.New().String(), bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleDeleteOCRProvider(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	id := uuid.New()
	svc := &mockService{
		deleteOCRProviderFn: func(_ context.Context, _, gotID uuid.UUID) error {
			assert.Equal(t, id, gotID)
			return nil
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodDelete, "/providers/ocr/"+id.String(), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestHandleDeleteOCRProvider_InvalidUUID(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodDelete, "/providers/ocr/not-a-uuid", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleDeleteOCRProvider_NotFound(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		deleteOCRProviderFn: func(_ context.Context, _, _ uuid.UUID) error {
			return settings.ErrNotFound
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodDelete, "/providers/ocr/"+uuid.New().String(), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleListOCRProviders(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		listOCRProvidersFn: func(_ context.Context, _ uuid.UUID) ([]*settings.OCRProviderConfig, error) {
			return []*settings.OCRProviderConfig{fakeOCRProvider()}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	req := httptest.NewRequest(http.MethodGet, "/providers/ocr", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp["data"])
}

func TestHandleCreateOCRProvider(t *testing.T) {
	hID, uID := uuid.New(), uuid.New()
	svc := &mockService{
		createOCRProviderFn: func(_ context.Context, _ uuid.UUID, req settings.CreateOCRProviderRequest) (*settings.OCRProviderConfig, error) {
			return &settings.OCRProviderConfig{ID: uuid.New(), Provider: req.Provider, IsDefault: req.IsDefault, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
		},
	}
	r := setupRouter(svc, hID, uID)
	body, _ := json.Marshal(settings.CreateOCRProviderRequest{Provider: "tesseract", IsDefault: true})
	req := httptest.NewRequest(http.MethodPost, "/providers/ocr", bytes.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}
