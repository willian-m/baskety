package shared

import (
	"context"
	"io"
)

// FileStore abstracts blob storage for receipt images so self-hosters can
// substitute their own backend (local disk, S3, etc.).
type FileStore interface {
	Store(ctx context.Context, name string, r io.Reader) (path string, err error)
	Open(ctx context.Context, path string) (io.ReadCloser, error)
}
