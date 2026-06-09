package testutil

import (
	"context"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/willian-m/baskety/internal/shared"
)

// NewTestDB starts a fresh postgres:16-alpine container, runs all goose migrations,
// and returns a ready pool. The container is terminated via t.Cleanup.
//
// Each call starts an independent container, which is perfectly fine for small
// test suites. For larger suites, callers should create a single pool in
// TestMain (by calling NewTestDB(m) with a *testing.M adapter) and call
// [ResetSchema] between subtests to avoid the per-test container startup cost.
// Once the suite justifies it, a shared TestMain-based container can be
// introduced without changing individual test signatures.
func NewTestDB(t testing.TB) *pgxpool.Pool {
	t.Helper()

	ctx := context.Background()

	container, err := tcpostgres.Run(ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("baskety"),
		tcpostgres.WithUsername("baskety"),
		tcpostgres.WithPassword("baskety"),
		tcpostgres.BasicWaitStrategies(),
	)
	if err != nil {
		t.Fatalf("testutil: start postgres container: %v", err)
	}
	t.Cleanup(func() {
		if err := container.Terminate(context.Background()); err != nil {
			t.Logf("testutil: terminate postgres container: %v", err)
		}
	})

	host, err := container.Host(ctx)
	if err != nil {
		t.Fatalf("testutil: get container host: %v", err)
	}
	port, err := container.MappedPort(ctx, "5432")
	if err != nil {
		t.Fatalf("testutil: get container port: %v", err)
	}

	dsn := fmt.Sprintf("postgres://baskety:baskety@%s:%s/baskety?sslmode=disable", host, port.Port())

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("testutil: create pgxpool: %v", err)
	}
	t.Cleanup(pool.Close)

	if err := shared.RunMigrations(ctx, pool); err != nil {
		t.Fatalf("testutil: run migrations: %v", err)
	}

	return pool
}
