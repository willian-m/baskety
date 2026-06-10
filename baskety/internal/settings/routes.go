package settings

import "github.com/go-chi/chi/v5"

// RegisterRoutes mounts settings routes. The caller must apply auth + household
// scope middleware to the router before calling this.
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/household/{key}", h.HandleGetHouseholdSetting)
	r.Put("/household/{key}", h.HandleUpsertHouseholdSetting)
	r.Get("/user/{key}", h.HandleGetUserSetting)
	r.Put("/user/{key}", h.HandleUpsertUserSetting)
	r.Get("/providers/llm", h.HandleListLLMProviders)
	r.Post("/providers/llm", h.HandleCreateLLMProvider)
	r.Get("/providers/ocr", h.HandleListOCRProviders)
	r.Post("/providers/ocr", h.HandleCreateOCRProvider)
}
