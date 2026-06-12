package auth

import (
	"encoding/json"
	"errors"
	"net/http"
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

func (h *Handler) HandleRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.Email == "" || req.Name == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email, name, and password are required"})
		return
	}
	resp, err := h.svc.Register(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrEmailTaken) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "email already taken"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": resp})
}

func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	resp, err := h.svc.Login(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": resp})
}

func (h *Handler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := GetSessionID(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if err := h.svc.Logout(r.Context(), sessionID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
