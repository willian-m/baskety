package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

type userIDKeyType struct{}
type sessionIDKeyType struct{}

// UserIDKey is the context key for the authenticated user's ID.
var UserIDKey = userIDKeyType{}

// SessionIDContextKey is the context key for the current session ID.
var SessionIDContextKey = sessionIDKeyType{}

// Middleware validates the Bearer token and attaches userID + sessionID to context.
func Middleware(repo Repository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
				return
			}
			rawToken := strings.TrimPrefix(authHeader, "Bearer ")
			hash := sha256.Sum256([]byte(rawToken))
			tokenHash := hex.EncodeToString(hash[:])

			session, err := repo.FindSessionByTokenHash(r.Context(), tokenHash)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
				return
			}
			if session.ExpiresAt != nil && session.ExpiresAt.Before(time.Now().UTC()) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
				return
			}
			if session.RevokedAt != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, session.UserID)
			ctx = context.WithValue(ctx, SessionIDContextKey, session.ID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserID retrieves the authenticated userID from context.
func GetUserID(ctx context.Context) (uuid.UUID, bool) {
	v, ok := ctx.Value(UserIDKey).(uuid.UUID)
	return v, ok
}

// GetSessionID retrieves the session ID from context.
func GetSessionID(ctx context.Context) (uuid.UUID, bool) {
	v, ok := ctx.Value(SessionIDContextKey).(uuid.UUID)
	return v, ok
}
