# Sprint 7 — Go Backend: Catalog, Settings, pg_cron, Wire-up

**Goal:** Catalog, settings, and price-tracking endpoints live. pg_cron jobs registered via migration. Binary boots end-to-end.

**Dependencies:** Sprint 6.

| # | Task | Est. |
|---|------|------|
| 7.1 | Implement `internal/catalog`: model, dto, repository interface + `repository_pg.go` (upsert store, upsert catalog_entry, list entries/stores/transactions) | 1d |
| 7.2 | Implement `ProcessPurchaseTransactionJob` (River): upsert store, upsert catalog_entry, update inventory batch quantity | 0.5d |
| 7.3 | Implement `catalog/service.go` + `handler.go` + `routes.go`: GET entries, stores, transactions | 0.5d |
| 7.4 | Implement `internal/settings`: model, dto, repository + pg implementation; CRUD for settings key-value tables and provider configs | 0.5d |
| 7.5 | Implement `settings/service.go` + `handler.go` + `routes.go`: `GET/PATCH /api/v1/settings`, provider config management | 0.5d |
| 7.6 | Register pg_cron jobs in a goose migration: purge expired sessions (daily), purge emptied batches (weekly), archive/purge completed grocery lists (daily) | 0.5d |
| 7.7 | Wire all domain routers, middleware, River workers, FileStore, and config loading into `cmd/baskety/main.go`; confirm binary boots cleanly | 1d |

**Sprint total: 4.5d**
