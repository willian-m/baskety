package testutil_test

import (
	"context"
	"testing"

	"github.com/willian-m/baskety/internal/testutil"
)

func TestNewTestDB(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	pool := testutil.NewTestDB(t)
	if pool == nil {
		t.Fatal("expected non-nil pool")
	}

	var result int
	if err := pool.QueryRow(context.Background(), "SELECT 1").Scan(&result); err != nil {
		t.Fatalf("SELECT 1 failed: %v", err)
	}
	if result != 1 {
		t.Fatalf("expected 1, got %d", result)
	}
}

func TestResetSchema(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	pool := testutil.NewTestDB(t)
	testutil.ResetSchema(context.Background(), t, pool)
}
