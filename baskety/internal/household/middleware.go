package household

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	"github.com/willian-m/baskety/internal/auth"
)

type householdIDKeyType struct{}

// HouseholdIDKey is the context key for the validated household ID.
var HouseholdIDKey = householdIDKeyType{}

// ScopeMiddleware reads X-Household-ID, validates membership, and attaches householdID to context.
// Falls back to the caller's first household when the header is absent.
func ScopeMiddleware(repo Repository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := auth.GetUserID(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			var householdID uuid.UUID

			if headerVal := r.Header.Get("X-Household-ID"); headerVal != "" {
				id, err := uuid.Parse(headerVal)
				if err != nil {
					http.Error(w, `{"error":"invalid X-Household-ID"}`, http.StatusBadRequest)
					return
				}
				if _, err := repo.FindMember(r.Context(), id, userID); err != nil {
					http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
					return
				}
				householdID = id
			} else {
				households, err := repo.ListHouseholdsForUser(r.Context(), userID)
				if err != nil || len(households) == 0 {
					http.Error(w, `{"error":"no household available"}`, http.StatusForbidden)
					return
				}
				householdID = households[0].ID
			}

			ctx := context.WithValue(r.Context(), HouseholdIDKey, householdID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetHouseholdID retrieves the validated householdID from context.
func GetHouseholdID(ctx context.Context) (uuid.UUID, bool) {
	v, ok := ctx.Value(HouseholdIDKey).(uuid.UUID)
	return v, ok
}
