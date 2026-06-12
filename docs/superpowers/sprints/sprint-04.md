# Sprint 4 — Go Backend: Inventory Domain

**Goal:** All inventory, item, and batch endpoints working with householdID scoping enforced.

**Dependencies:** Sprint 3.

| # | Task | Est. |
|---|------|------|
| 4.1 | Implement `internal/inventory`: `model.go`, `dto.go`, `repository.go` interface | 0.5d |
| 4.2 | Implement `inventory/repository_pg.go`: CRUD for inventories, items (with soft-delete via deleted_at), batches | 1d |
| 4.3 | Implement `inventory/service.go`: create/get/list inventories; create/update/soft-delete items; add batch, list batches, compute effective quantity (SUM where emptied_at IS NULL) | 1d |
| 4.4 | Implement `inventory/handler.go` + `routes.go`: all inventory/items/batches endpoints with householdID scope | 0.5d |
| 4.5 | Unit tests for `inventory/service.go` | 0.5d |
| 4.6 | Handler tests for all inventory endpoints | 0.5d |
| 4.7 | Repository integration test: soft-delete integrity (soft-deleted item does not orphan purchase_transactions) | 0.5d |
| 4.8 | Repository integration test: batch quantity aggregation (SUM across non-emptied batches matches service output) | 0.5d |

**Sprint total: 5d**
