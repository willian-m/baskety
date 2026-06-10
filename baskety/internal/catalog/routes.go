package catalog

import "github.com/go-chi/chi/v5"

// RegisterRoutes mounts catalog routes. The caller must apply auth + household
// scope middleware to the router before calling this.
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/stores", h.HandleListStores)
	r.Post("/stores", h.HandleCreateStore)
	r.Get("/entries", h.HandleListCatalogEntries)
	r.Post("/entries", h.HandleCreateCatalogEntry)
	r.Get("/transactions", h.HandleListTransactions)
}
