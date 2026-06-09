package testutil

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ResetSchema truncates all application tables in dependency order.
// Safe to call between subtests to reset state without restarting the container.
func ResetSchema(ctx context.Context, t testing.TB, pool *pgxpool.Pool) {
	t.Helper()

	const truncateSQL = `TRUNCATE
		purchase_transactions,
		receipt_scan_items,
		receipt_scans,
		grocery_list_items,
		grocery_lists,
		inventory_share_links,
		catalog_entries,
		stores,
		inventory_batches,
		inventory_items,
		inventory_permissions,
		inventories,
		household_members,
		households,
		sessions,
		users,
		user_settings,
		household_settings,
		system_settings,
		llm_provider_configs,
		ocr_provider_configs
	RESTART IDENTITY CASCADE`

	if _, err := pool.Exec(ctx, truncateSQL); err != nil {
		t.Fatalf("testutil: reset schema: %v", err)
	}
}
