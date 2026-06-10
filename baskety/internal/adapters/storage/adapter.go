package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// LocalFileStore stores files in a configurable base directory on local disk.
type LocalFileStore struct {
	BaseDir string
}

func NewLocalFileStore(baseDir string) *LocalFileStore {
	return &LocalFileStore{BaseDir: baseDir}
}

// Store writes the reader's contents to BaseDir/<name> and returns the full path.
func (s *LocalFileStore) Store(ctx context.Context, name string, r io.Reader) (string, error) {
	if err := os.MkdirAll(s.BaseDir, 0o755); err != nil {
		return "", fmt.Errorf("creating base dir: %w", err)
	}
	// Guard against path traversal in the provided name.
	clean := filepath.Base(name)
	path := filepath.Join(s.BaseDir, clean)

	f, err := os.Create(path)
	if err != nil {
		return "", fmt.Errorf("creating file: %w", err)
	}
	defer f.Close()

	if _, err := io.Copy(f, r); err != nil {
		return "", fmt.Errorf("writing file: %w", err)
	}
	return path, nil
}

func (s *LocalFileStore) Open(ctx context.Context, path string) (io.ReadCloser, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("opening file: %w", err)
	}
	return f, nil
}
