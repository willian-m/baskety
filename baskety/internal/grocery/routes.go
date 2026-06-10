package grocery

import "github.com/go-chi/chi/v5"

// RegisterRoutes mounts grocery routes onto a router that is already scoped under
// /inventories (i.e. paths begin with /{inventoryID}/lists). The caller must apply
// auth + household scope middleware before calling this.
//
// chi matches static path segments before wildcards within the same router, so
// registering /{inventoryID}/lists/auto-generate alongside /{inventoryID}/lists/{listID}
// resolves "auto-generate" to the static route, not a listID.
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Post("/{inventoryID}/lists", h.HandleCreateList)
	r.Get("/{inventoryID}/lists", h.HandleListByInventory)
	r.Post("/{inventoryID}/lists/auto-generate", h.HandleAutoGenerate)

	r.Get("/{inventoryID}/lists/{listID}", h.HandleGetList)
	r.Post("/{inventoryID}/lists/{listID}/complete", h.HandleCompleteList)
	r.Post("/{inventoryID}/lists/{listID}/archive", h.HandleArchiveList)

	r.Post("/{inventoryID}/lists/{listID}/items", h.HandleAddItem)
	r.Get("/{inventoryID}/lists/{listID}/items", h.HandleListItems)
	r.Put("/{inventoryID}/lists/{listID}/items/{itemID}/status", h.HandleUpdateItemStatus)
	r.Put("/{inventoryID}/lists/{listID}/items/{itemID}/order", h.HandleReorderItem)
	r.Delete("/{inventoryID}/lists/{listID}/items/{itemID}", h.HandleDeleteItem)
}
