package testutil

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ResetSchema truncates all application tables in the public schema (excluding
// goose_db_version) using a dynamic query so the list never drifts from the
// actual schema. Safe to call between subtests to reset state without
// restarting the container.
func ResetSchema(ctx context.Context, t testing.TB, pool *pgxpool.Pool) {
	t.Helper()

	rows, err := pool.Query(ctx, `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public'
		  AND table_type = 'BASE TABLE'
		  AND table_name <> 'goose_db_version'
	`)
	if err != nil {
		t.Fatalf("testutil: query tables for reset: %v", err)
	}

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatalf("testutil: scan table name: %v", err)
		}
		tables = append(tables, name)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		t.Fatalf("testutil: iterate tables for reset: %v", err)
	}

	if len(tables) == 0 {
		return
	}

	quoted := make([]string, len(tables))
	for i, t := range tables {
		quoted[i] = pgx.Identifier{t}.Sanitize()
	}
	truncateSQL := "TRUNCATE " + strings.Join(quoted, ", ") + " RESTART IDENTITY CASCADE"
	if _, err := pool.Exec(ctx, truncateSQL); err != nil {
		t.Fatalf("testutil: reset schema: %v", err)
	}
}
