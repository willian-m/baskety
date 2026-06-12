# Sprint 5 — Go Backend: Grocery Lists Domain

**Goal:** Grocery list creation, item management, trip completion, and auto-generation from inventory shortfalls all working.

**Dependencies:** Sprint 4 (inventory service).

| # | Task | Est. |
|---|------|------|
| 5.1 | Implement `internal/grocery`: `model.go`, `dto.go`, `repository.go` interface | 0.5d |
| 5.2 | Implement `grocery/repository_pg.go`: CRUD for lists and items, complete transition, archive query | 0.5d |
| 5.3 | Implement `grocery/service.go` — list management: create, get, list, update, complete (active→completed), archive | 0.5d |
| 5.4 | Implement `grocery/service.go` — item management: add item, update status (pending/bought/skipped), reorder | 0.5d |
| 5.5 | Implement auto-generation: query items where effective_quantity < target_quantity or batches expiring within threshold; populate grocery_list_items for shortfalls | 1d |
| 5.6 | Implement `grocery/handler.go` + `routes.go` | 0.5d |
| 5.7 | Unit tests for `grocery/service.go` including auto-generation logic | 0.5d |
| 5.8 | Handler tests for all grocery endpoints | 0.5d |

**Sprint total: 4.5d**
