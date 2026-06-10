// Package share provides the unauthenticated share-token endpoints.
package share

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/willian-m/baskety/internal/household"
	"github.com/willian-m/baskety/internal/inventory"
)

// InventoryView is the read-only response returned for a valid share token.
type InventoryView struct {
	InventoryID string                    `json:"inventory_id"`
	Items       []*inventory.ItemResponse `json:"items"`
}

// Handler handles share-token based public endpoints.
type Handler struct {
	householdRepo household.Repository
	inventoryRepo inventory.Repository
}

// NewHandler creates a new share Handler.
func NewHandler(householdRepo household.Repository, inventoryRepo inventory.Repository) *Handler {
	return &Handler{householdRepo: householdRepo, inventoryRepo: inventoryRepo}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// HandleGetInventoryByShareToken handles GET /api/v1/share/:token/inventory.
// This is a public (unauthenticated) endpoint.
func (h *Handler) HandleGetInventoryByShareToken(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing token"})
		return
	}

	link, err := h.householdRepo.FindShareLinkByToken(r.Context(), token)
	if err != nil {
		if errors.Is(err, household.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	// Revoked?
	if link.RevokedAt != nil {
		writeJSON(w, http.StatusGone, map[string]string{"error": "share link has been revoked"})
		return
	}

	// Expired?
	if link.ExpiresAt != nil && time.Now().After(*link.ExpiresAt) {
		writeJSON(w, http.StatusGone, map[string]string{"error": "share link has expired"})
		return
	}

	items, err := h.inventoryRepo.ListItems(r.Context(), link.InventoryID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	// Filter soft-deleted items and map to ItemResponse.
	out := make([]*inventory.ItemResponse, 0, len(items))
	for _, item := range items {
		if item.DeletedAt != nil {
			continue
		}
		out = append(out, &inventory.ItemResponse{
			ID:             item.ID.String(),
			InventoryID:    uuid.UUID(item.InventoryID).String(),
			Name:           item.Name,
			Category:       item.Category,
			Unit:           item.Unit,
			TargetQuantity: item.TargetQuantity,
			Notes:          item.Notes,
			CreatedAt:      item.CreatedAt,
			UpdatedAt:      item.UpdatedAt,
		})
	}

	view := &InventoryView{
		InventoryID: link.InventoryID.String(),
		Items:       out,
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": view})
}

// RegisterRoutes registers public share-token routes onto the given router.
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/{token}/inventory", h.HandleGetInventoryByShareToken)
}
