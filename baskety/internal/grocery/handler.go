package grocery

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

// --- lists ---

func (h *Handler) HandleCreateList(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	uid, ok := userFromCtx(w, r)
	if !ok {
		return
	}
	invID, ok := parseParam(w, r, "inventoryID", "inventory ID")
	if !ok {
		return
	}
	var req CreateListRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.CreateList(r.Context(), invID, hid, uid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": resp})
}

func (h *Handler) HandleListByInventory(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	invID, ok := parseParam(w, r, "inventoryID", "inventory ID")
	if !ok {
		return
	}
	resp, err := h.svc.ListByInventory(r.Context(), invID, hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleGetList(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	listID, ok := parseParam(w, r, "listID", "list ID")
	if !ok {
		return
	}
	resp, err := h.svc.GetList(r.Context(), listID, hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleCompleteList(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	listID, ok := parseParam(w, r, "listID", "list ID")
	if !ok {
		return
	}
	resp, err := h.svc.CompleteList(r.Context(), listID, hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleArchiveList(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	listID, ok := parseParam(w, r, "listID", "list ID")
	if !ok {
		return
	}
	if err := h.svc.ArchiveList(r.Context(), listID, hid); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "archived"}})
}

func (h *Handler) HandleRenameList(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	listID, ok := parseParam(w, r, "listID", "list ID")
	if !ok {
		return
	}
	var req RenameListRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.RenameList(r.Context(), listID, hid, req.Name)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleDeleteList(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	listID, ok := parseParam(w, r, "listID", "list ID")
	if !ok {
		return
	}
	if err := h.svc.DeleteList(r.Context(), listID, hid); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) HandleAutoGenerate(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	uid, ok := userFromCtx(w, r)
	if !ok {
		return
	}
	invID, ok := parseParam(w, r, "inventoryID", "inventory ID")
	if !ok {
		return
	}
	var req AutoGenerateRequest
	// Body is optional; ignore decode errors for empty body.
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}
	resp, err := h.svc.AutoGenerate(r.Context(), invID, hid, uid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": resp})
}

// --- items ---

func (h *Handler) HandleAddItem(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	listID, ok := parseParam(w, r, "listID", "list ID")
	if !ok {
		return
	}
	var req AddItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.AddItem(r.Context(), listID, hid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": resp})
}

func (h *Handler) HandleListItems(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	listID, ok := parseParam(w, r, "listID", "list ID")
	if !ok {
		return
	}
	resp, err := h.svc.ListItems(r.Context(), listID, hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleUpdateItemStatus(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	listID, ok := parseParam(w, r, "listID", "list ID")
	if !ok {
		return
	}
	itemID, ok := parseParam(w, r, "itemID", "item ID")
	if !ok {
		return
	}
	var req UpdateItemStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.UpdateItemStatus(r.Context(), itemID, listID, hid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleReorderItem(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	listID, ok := parseParam(w, r, "listID", "list ID")
	if !ok {
		return
	}
	itemID, ok := parseParam(w, r, "itemID", "item ID")
	if !ok {
		return
	}
	var req ReorderItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if err := h.svc.ReorderItem(r.Context(), itemID, listID, hid, req); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]int{"sort_order": req.SortOrder}})
}

func (h *Handler) HandleDeleteItem(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	listID, ok := parseParam(w, r, "listID", "list ID")
	if !ok {
		return
	}
	itemID, ok := parseParam(w, r, "itemID", "item ID")
	if !ok {
		return
	}
	if err := h.svc.DeleteItem(r.Context(), itemID, listID, hid); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
