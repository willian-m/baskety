package catalog

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/google/uuid"
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

func (h *Handler) HandleListStores(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	resp, err := h.svc.ListStores(r.Context(), hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleCreateStore(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	var req CreateStoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.CreateStore(r.Context(), hid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": resp})
}

func (h *Handler) HandleListCatalogEntries(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	resp, err := h.svc.ListCatalogEntries(r.Context(), hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleCreateCatalogEntry(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	var req CreateCatalogEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.CreateCatalogEntry(r.Context(), hid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": resp})
}

func (h *Handler) HandleListTransactions(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	resp, err := h.svc.ListTransactions(r.Context(), hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}
