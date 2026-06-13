package shared

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed all:dist
var distFS embed.FS

// SPAHandler returns an http.Handler that serves the embedded web app.
// All requests that don't match a real file fall back to index.html so
// that the SPA router handles client-side navigation.
func SPAHandler() http.Handler {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		// dist is always embedded at build time; this is unreachable in production.
		panic("embedded dist not found: " + err.Error())
	}
	fileServer := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// embed.FS rejects paths with a leading slash as invalid, so strip it.
		name := strings.TrimPrefix(r.URL.Path, "/")
		if name == "" {
			name = "."
		}
		f, err := sub.Open(name)
		if err != nil {
			r.URL.Path = "/"
		} else {
			f.Close()
		}
		fileServer.ServeHTTP(w, r)
	})
}
