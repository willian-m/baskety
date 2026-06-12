# Sprint 2 — Architect Follow-up Items

Non-blocking issues flagged during sprint 2 reviews. None blocked merge; all should be addressed before or during sprint 3.

---

## compose.dev.yml (task 2.9)

**F5 — Missing DSN comment in file header.**
No documentation of the connection string a developer needs to point the app at the dev DB.
Fix: add to `compose.dev.yml` header:
```yaml
# Usage:
#   docker compose -f compose.dev.yml up -d
#   export BASKETY_DATABASE_URL=postgres://baskety:baskety@localhost:5432/baskety
```

**F6 — No Makefile targets for dev DB.**
`make up`/`make down` only drive the production compose. No shortcut for the dev DB.
Fix: add to `Makefile`:
```makefile
db-up:
	docker compose -f compose.dev.yml up -d
db-down:
	docker compose -f compose.dev.yml down
```

**F7 — File comment says "integration tests" but CI uses testcontainers.**
Misleading — this file is for manual/local use only; automated CI tests use testcontainers-go.
Fix: tighten the comment to "manual/local development" and note that CI tests are independent.

---

## Migrations (tasks 2.1–2.7)

**Redundant quantity precision note.**
`numeric(10,3)` is used for quantities while the spec says unbounded `NUMERIC`. Acceptable cap, but worth a one-line note in the spec so DTO authors know the bound.

**`purchase_transactions.currency` nullable risk.**
`currency char(3) NOT NULL DEFAULT 'USD'` while `price_per_unit_minor` is nullable. Consider a CHECK enforcing "currency present iff price present" in a future migration.

---

## sqlc queries (task 2.8)

**F7 — Cruncher purge queries missing.**
No query to hard-delete emptied batches or purge expired/non-pinned archived grocery lists.
Add when the background cruncher job is implemented (likely sprint 3/4).

**Revoked member filtering.**
`ListHouseholdMembers` and `GetHouseholdMember` do not filter `revoked_at IS NULL`.
Revoked members appear in active-membership results. Fix in the repository layer or add filtered variants to `households.sql`.

---

## Testcontainers harness (task 2.10)

**F1 — `dist` embed breaks clean checkout (pre-existing, elevated priority).**
`internal/shared/static.go` has `//go:embed all:dist` but the `dist/` glob in `.gitignore` (line 28) swallows the placeholder. A clean checkout cannot compile `internal/shared`, which means `go test ./...` fails in CI on any branch that doesn't run the web build first.
Fix: scope the gitignore entry from `dist/` to `apps/web/dist/` (and `packages/*/dist/`) so the Go embed anchor can be committed.
Files: `.gitignore:28`, `baskety/internal/shared/static.go:9`.

**F3 — Per-call container will slow as test suite grows.**
`NewTestDB` starts a fresh container per call. Add a doc comment pointing callers to the `NewTestDB` + `ResetSchema`-between-subtests pattern as the preferred approach at scale. Consider a `TestMain`-based shared container once the suite justifies it.

**F4 — `ResetSchema` table list must be hand-maintained.**
As migrations are added, the truncation list in `reset.go` will silently fall out of date. Consider replacing with a dynamic query:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name <> 'goose_db_version'
```

**F7 — No `testing.Short()` guard on integration tests.**
Developers without a running Docker daemon get hard failures on `go test ./...`. Consider gating container tests behind `if testing.Short() { t.Skip("requires docker") }` so `go test -short` stays green in non-Docker environments.
