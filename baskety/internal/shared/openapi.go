package shared

import (
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
)

//go:embed openapi.json
var openapiJSON []byte

// RegisterOpenAPIRoute mounts GET /api/v1/openapi.json on the provided router.
// The spec is embedded at compile time from internal/shared/openapi.json.
func RegisterOpenAPIRoute(r chi.Router) {
	r.Get("/api/v1/openapi.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(openapiJSON)
	})
}
