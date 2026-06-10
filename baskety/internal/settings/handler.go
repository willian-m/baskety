package settings

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/willian-m/baskety/internal/auth"
	"github.com/willian-m/baskety/internal/household"
)

type Handler struct {
	svc ServiceIface
}

func NewHandler(svc ServiceIface) *Handler {
	return &Handler{svc: svc}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	case errors.Is(err, ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
	case errors.Is(err, ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}
}

func householdFromCtx(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	hid, ok := household.GetHouseholdID(r.Context())
	if !ok {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "no household available"})
		return uuid.Nil, false
	}
	return hid, true
}

func userFromCtx(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	uid, ok := auth.GetUserID(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return uuid.Nil, false
	}
	return uid, true
}

// --- household settings ---

func (h *Handler) HandleGetHouseholdSetting(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	key := chi.URLParam(r, "key")
	setting, err := h.svc.GetHouseholdSetting(r.Context(), hid, key)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": SettingResponse{
		Key: setting.Key, Value: setting.Value, UpdatedAt: setting.UpdatedAt,
	}})
}

func (h *Handler) HandleUpsertHouseholdSetting(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	key := chi.URLParam(r, "key")
	var req UpsertSettingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if err := h.svc.UpsertHouseholdSetting(r.Context(), hid, key, req.Value); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": SettingResponse{Key: key, Value: req.Value}})
}

// --- user settings ---

func (h *Handler) HandleGetUserSetting(w http.ResponseWriter, r *http.Request) {
	uid, ok := userFromCtx(w, r)
	if !ok {
		return
	}
	key := chi.URLParam(r, "key")
	setting, err := h.svc.GetUserSetting(r.Context(), uid, key)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": SettingResponse{
		Key: setting.Key, Value: setting.Value, UpdatedAt: setting.UpdatedAt,
	}})
}

func (h *Handler) HandleUpsertUserSetting(w http.ResponseWriter, r *http.Request) {
	uid, ok := userFromCtx(w, r)
	if !ok {
		return
	}
	key := chi.URLParam(r, "key")
	var req UpsertSettingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if err := h.svc.UpsertUserSetting(r.Context(), uid, key, req.Value); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": SettingResponse{Key: key, Value: req.Value}})
}

// --- LLM providers ---

func (h *Handler) HandleListLLMProviders(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	providers, err := h.svc.ListLLMProviders(r.Context(), hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	out := make([]LLMProviderResponse, len(providers))
	for i, p := range providers {
		out[i] = toLLMProviderResponse(p)
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": out})
}

func (h *Handler) HandleCreateLLMProvider(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	var req CreateLLMProviderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	p, err := h.svc.CreateLLMProvider(r.Context(), hid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": toLLMProviderResponse(p)})
}

// --- OCR providers ---

func (h *Handler) HandleListOCRProviders(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	providers, err := h.svc.ListOCRProviders(r.Context(), hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	out := make([]OCRProviderResponse, len(providers))
	for i, p := range providers {
		out[i] = toOCRProviderResponse(p)
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": out})
}

func (h *Handler) HandleCreateOCRProvider(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	var req CreateOCRProviderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	p, err := h.svc.CreateOCRProvider(r.Context(), hid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": toOCRProviderResponse(p)})
}

// --- mappers (omit secrets) ---

func hidPtrStr(id *uuid.UUID) *string {
	if id == nil {
		return nil
	}
	s := id.String()
	return &s
}

func toLLMProviderResponse(p *LLMProviderConfig) LLMProviderResponse {
	return LLMProviderResponse{
		ID:          p.ID.String(),
		HouseholdID: hidPtrStr(p.HouseholdID),
		Provider:    p.Provider,
		Model:       p.Model,
		EndpointURL: p.EndpointURL,
		HasAPIKey:   p.APIKeyEncrypted != nil,
		IsDefault:   p.IsDefault,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
	}
}

func toOCRProviderResponse(p *OCRProviderConfig) OCRProviderResponse {
	return OCRProviderResponse{
		ID:          p.ID.String(),
		HouseholdID: hidPtrStr(p.HouseholdID),
		Provider:    p.Provider,
		EndpointURL: p.EndpointURL,
		HasAPIKey:   p.APIKeyEncrypted != nil,
		ExtraConfig: p.ExtraConfig,
		IsDefault:   p.IsDefault,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
	}
}
