package inventory

import "github.com/go-chi/chi/v5"

// RegisterRoutes mounts inventory routes. The caller must apply auth + household
// scope middleware to the router before calling this.
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Post("/", h.HandleCreateInventory)
	r.Get("/", h.HandleListInventories)
	r.Get("/{inventoryID}", h.HandleGetInventory)
	r.Put("/{inventoryID}", h.HandleUpdateInventory)
	r.Delete("/{inventoryID}", h.HandleDeleteInventory)

	r.Post("/{inventoryID}/items", h.HandleCreateItem)
	r.Get("/{inventoryID}/items", h.HandleListItems)
	r.Get("/{inventoryID}/items/{itemID}", h.HandleGetItem)
	r.Put("/{inventoryID}/items/{itemID}", h.HandleUpdateItem)
	r.Delete("/{inventoryID}/items/{itemID}", h.HandleDeleteItem)

	r.Post("/{inventoryID}/items/{itemID}/batches", h.HandleAddBatch)
	r.Get("/{inventoryID}/items/{itemID}/batches", h.HandleListActiveBatches)
	r.Post("/{inventoryID}/items/{itemID}/batches/{batchID}/empty", h.HandleMarkBatchEmptied)
}
