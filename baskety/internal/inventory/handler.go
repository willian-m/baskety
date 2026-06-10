package inventory

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
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

func parseParam(w http.ResponseWriter, r *http.Request, name, label string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid " + label})
		return uuid.Nil, false
	}
	return id, true
}

// --- inventories ---

func (h *Handler) HandleCreateInventory(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	var req CreateInventoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.CreateInventory(r.Context(), hid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": resp})
}

func (h *Handler) HandleListInventories(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	resp, err := h.svc.ListInventories(r.Context(), hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleGetInventory(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	id, ok := parseParam(w, r, "inventoryID", "inventory ID")
	if !ok {
		return
	}
	resp, err := h.svc.GetInventory(r.Context(), id, hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleUpdateInventory(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	id, ok := parseParam(w, r, "inventoryID", "inventory ID")
	if !ok {
		return
	}
	var req UpdateInventoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.UpdateInventory(r.Context(), id, hid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleDeleteInventory(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	id, ok := parseParam(w, r, "inventoryID", "inventory ID")
	if !ok {
		return
	}
	if err := h.svc.DeleteInventory(r.Context(), id, hid); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- items ---

func (h *Handler) HandleCreateItem(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	invID, ok := parseParam(w, r, "inventoryID", "inventory ID")
	if !ok {
		return
	}
	var req CreateItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.CreateItem(r.Context(), invID, hid, req)
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
	invID, ok := parseParam(w, r, "inventoryID", "inventory ID")
	if !ok {
		return
	}
	resp, err := h.svc.ListItems(r.Context(), invID, hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleGetItem(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	itemID, ok := parseParam(w, r, "itemID", "item ID")
	if !ok {
		return
	}
	resp, err := h.svc.GetItem(r.Context(), itemID, hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleUpdateItem(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	itemID, ok := parseParam(w, r, "itemID", "item ID")
	if !ok {
		return
	}
	var req UpdateItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.UpdateItem(r.Context(), itemID, hid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleDeleteItem(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	itemID, ok := parseParam(w, r, "itemID", "item ID")
	if !ok {
		return
	}
	if err := h.svc.DeleteItem(r.Context(), itemID, hid); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- batches ---

func (h *Handler) HandleAddBatch(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	itemID, ok := parseParam(w, r, "itemID", "item ID")
	if !ok {
		return
	}
	var req AddBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.AddBatch(r.Context(), itemID, hid, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": resp})
}

func (h *Handler) HandleListActiveBatches(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	itemID, ok := parseParam(w, r, "itemID", "item ID")
	if !ok {
		return
	}
	resp, err := h.svc.ListActiveBatches(r.Context(), itemID, hid)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleMarkBatchEmptied(w http.ResponseWriter, r *http.Request) {
	hid, ok := householdFromCtx(w, r)
	if !ok {
		return
	}
	batchID, ok := parseParam(w, r, "batchID", "batch ID")
	if !ok {
		return
	}
	if err := h.svc.MarkBatchEmptied(r.Context(), batchID, hid); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "emptied"}})
}
