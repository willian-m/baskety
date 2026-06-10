package auth

import "github.com/go-chi/chi/v5"

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Post("/register", h.HandleRegister)
	r.Post("/login", h.HandleLogin)
	r.Delete("/session", h.HandleLogout)
}
