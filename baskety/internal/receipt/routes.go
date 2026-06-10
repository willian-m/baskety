package receipt

import "github.com/go-chi/chi/v5"

// RegisterRoutes mounts receipt routes. The caller must apply auth + household
// scope middleware to the router before calling this.
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Post("/", h.HandleUploadScan)
	r.Get("/", h.HandleListScans)
	r.Get("/{scanID}", h.HandleGetScan)
	r.Get("/{scanID}/items", h.HandleGetScanItems)
	r.Put("/{scanID}/items/{itemID}", h.HandleUpdateScanItem)
	r.Post("/{scanID}/commit", h.HandleCommitScan)
}
