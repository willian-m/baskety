package receipt

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/willian-m/baskety/internal/auth"
	"github.com/willian-m/baskety/internal/household"
)

const maxUploadBytes = 10 << 20 // 10MB

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
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthenticated"})
		return uuid.Nil, false
	}
	return uid, true
}

func parseParam(w http.ResponseWriter, r *http.Request, name, label string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid " + label})
		return uuid.Nil, false
	}
	return id, true
}

// HandleUploadScan accepts multipart/form-data with field "image" and optional
// "grocery_list_id".
func (h *Handler) HandleUploadScan(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	uid, ok := userFromCtx(w, r)
	if !ok {
		return
	}

	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid multipart form"})
		return
	}
	file, header, err := r.FormFile("image")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing image field"})
		return
	}
	defer file.Close()

	var groceryListID *uuid.UUID
	if raw := r.FormValue("grocery_list_id"); raw != "" {
		gl, perr := uuid.Parse(raw)
		if perr != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid grocery_list_id"})
			return
		}
		groceryListID = &gl
	}

	resp, err := h.svc.UploadScan(r.Context(), hid, uid, groceryListID, header.Filename, file)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": resp})
}

func (h *Handler) HandleListScans(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	resp, err := h.svc.ListScans(r.Context(), hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleGetScan(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	scanID, ok := parseParam(w, r, "scanID", "scan ID")
	if !ok {
		return
	}
	resp, err := h.svc.GetScan(r.Context(), scanID, hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleGetScanItems(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	scanID, ok := parseParam(w, r, "scanID", "scan ID")
	if !ok {
		return
	}
	resp, err := h.svc.GetScanItems(r.Context(), scanID, hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleUpdateScanItem(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	scanID, ok := parseParam(w, r, "scanID", "scan ID")
	if !ok {
		return
	}
	itemID, ok := parseParam(w, r, "itemID", "item ID")
	if !ok {
		return
	}
	var req UpdateScanItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.UpdateScanItem(r.Context(), itemID, scanID, hid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleCommitScan(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	scanID, ok := parseParam(w, r, "scanID", "scan ID")
	if !ok {
		return
	}
	var req CommitScanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.CommitScan(r.Context(), scanID, hid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}
