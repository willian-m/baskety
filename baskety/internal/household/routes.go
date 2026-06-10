package household

import "github.com/go-chi/chi/v5"

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/", h.HandleListHouseholds)
	r.Post("/", h.HandleCreateHousehold)
	r.Get("/{householdID}", h.HandleGetHousehold)
	r.Post("/{householdID}/members", h.HandleAddMember)
	r.Delete("/{householdID}/members/{userID}", h.HandleRemoveMember)
	r.Post("/{householdID}/share-links", h.HandleCreateShareLink)
}
