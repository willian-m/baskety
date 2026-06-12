package auth

import "github.com/go-chi/chi/v5"

// RegisterRoutes mounts auth endpoints.
// /register and /login are unauthenticated.
// DELETE /session requires a valid Bearer token so it gets the auth middleware.
func RegisterRoutes(r chi.Router, h *Handler, repo Repository) {
	r.Post("/register", h.HandleRegister)
	r.Post("/login", h.HandleLogin)

	r.Group(func(r chi.Router) {
		r.Use(Middleware(repo))
		r.Delete("/session", h.HandleLogout)
	})
}
