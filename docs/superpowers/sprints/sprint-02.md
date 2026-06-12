# Sprint 2 — Database: Migrations, sqlc, Test Harness

**Goal:** All migrations run cleanly; sqlc generates all query types; testcontainers harness works.

**Dependencies:** Sprint 1 (Go module exists).

| # | Task | Est. |
|---|------|------|
| 2.1 | Add goose; write migration 001: `users`, `sessions` | 0.5d |
| 2.2 | Write migration 002: `households`, `household_members`, `inventory_share_links` | 0.5d |
| 2.3 | Write migration 003: `inventories`, `inventory_permissions`, `inventory_items`, `inventory_batches` | 0.5d |
| 2.4 | Write migration 004: `grocery_lists`, `grocery_list_items` | 0.5d |
| 2.5 | Write migration 005: `receipt_scans`, `receipt_scan_items` | 0.5d |
| 2.6 | Write migration 006: `stores`, `catalog_entries`, `purchase_transactions` | 0.5d |
| 2.7 | Write migration 007: `system_settings`, `household_settings`, `user_settings`, `llm_provider_configs`, `ocr_provider_configs` | 0.5d |
| 2.8 | Configure `sqlc.yaml`; write all `.sql` query files per domain in `db/queries/`; run `sqlc generate`; fix all type errors | 1d |
| 2.9 | Configure `docker/postgres/Dockerfile` (postgres:16 + postgresql-16-cron); add local dev compose file with postgres only | 0.5d |
| 2.10 | Configure testcontainers-go integration test harness (`internal/testutil/`): container startup, migration runner, schema reset helper | 0.5d |

**Sprint total: 5d**
