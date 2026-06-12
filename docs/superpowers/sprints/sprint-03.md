# Sprint 3 — Go Backend: Auth + Household Domains

**Goal:** Auth and Household HTTP endpoints fully working and unit-tested.

**Dependencies:** Sprint 2.

| # | Task | Est. |
|---|------|------|
| 3.1 | Implement `internal/auth`: `model.go`, `dto.go`, `repository.go` interface | 0.5d |
| 3.2 | Implement `auth/repository_pg.go`: create user, find by email, create session, find by token hash, revoke session | 0.5d |
| 3.3 | Implement `auth/service.go`: register (bcrypt cost 12), login (compare + mint token + sha256 hash), logout (stamp revoked_at) | 0.5d |
| 3.4 | Implement `auth/handler.go` + `routes.go`: `POST /register`, `POST /login`, `DELETE /session` | 0.5d |
| 3.5 | Implement Auth middleware: extract Bearer token, hash, look up session, attach userID to context; return 401 on miss/expiry/revocation | 0.5d |
| 3.6 | Unit tests for `auth/service.go` (mockery-generated mocks) | 0.5d |
| 3.7 | Handler tests for all three auth endpoints (httptest + mock service) | 0.5d |
| 3.8 | Implement `internal/household`: `model.go`, `dto.go`, `repository.go` interface | 0.5d |
| 3.9 | Implement `household/repository_pg.go`: create household, find by ID, list for user, add member, remove member, create share link | 0.5d |
| 3.10 | Implement `household/service.go` + `handler.go` + `routes.go`: all household + members + share-link endpoints | 0.5d |
| 3.11 | Implement HouseholdScope middleware: read `X-Household-ID` header, validate membership, attach householdID to context | 0.5d |
| 3.12 | Unit tests for `household/service.go`; handler tests for all household endpoints | 0.5d |

**Sprint total: 6d** — 1d spills into Sprint 4 or run a 6d sprint.

> Note: Combine 3.10 to absorb service + handler + routes as one block.
