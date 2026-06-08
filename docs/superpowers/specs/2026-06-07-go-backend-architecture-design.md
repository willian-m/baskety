# Go Backend Architecture — Baskety

**Date:** 2026-06-07
**Scope:** Go backend design for all core subsystems

---

## Stack Decisions

| Concern | Choice | Rationale |
|---|---|---|
| HTTP router | chi | stdlib-compatible, composable middleware, no framework lock-in |
| Database access | sqlc | type-safe generated code, explicit SQL, no ORM magic |
| DB connection | pgxpool | single pool, injected via dependency injection |
| Migrations | goose | embedded migrations, runs at startup |
| Auth | opaque session tokens (DB-backed) | instantly revocable, simple, appropriate for self-hosted scale |
| Background jobs | River (PostgreSQL-backed) | zero extra infrastructure, jobs are PG rows, retryable |
| DB maintenance | pg_cron | purges expired sessions, empty batches, archived lists |
| Config | YAML + env var overrides | self-hosted UX, operator-friendly |
| Secrets | key file (Docker secrets compatible) | encryption key never appears in config or env |

---

## Section 1: Project Structure

Single binary. One `cmd/` entry point assembles the full dependency graph, starts the HTTP server, and registers River workers.

```
baskety/
├── cmd/
│   └── baskety/
│       └── main.go               # wires all dependencies, starts server + River workers
├── internal/
│   ├── auth/                     # session management, login/logout/register
│   ├── household/                # households, members, share links
│   ├── inventory/                # items, batches, quantity tracking
│   ├── grocery/                  # lists, list items, auto-generation
│   ├── receipt/                  # scan upload, OCR, LLM, review, commit
│   ├── catalog/                  # entries, stores, purchase transactions
│   ├── settings/                 # system/household/user settings, provider configs
│   ├── shared/                   # middleware, pagination, errors, context helpers
│   └── adapters/
│       ├── ocr/                  # OCRProvider implementations (tesseract, google_vision, etc.)
│       ├── llm/                  # LLMProvider implementations (openai, anthropic, ollama, etc.)
│       └── storage/              # FileStore implementations (local, s3, azure)
├── db/
│   ├── migrations/               # goose .sql migration files
│   └── queries/                  # sqlc .sql query files (input to codegen)
├── gen/
│   └── sqlc/                     # sqlc-generated Go code — committed, never hand-edited
├── sqlc.yaml
├── Makefile                      # generate, migrate, lint, test targets
├── config.yaml                   # operator config (see Section 7)
├── Dockerfile
├── docker-compose.yml
├── go.mod
└── go.sum
```

**Notes:**
- `gen/sqlc/` is committed so contributors can build without installing sqlc. `make generate` regenerates it when queries change.
- No `pkg/` directory — nothing in this codebase is a public library.
- Adapters in `internal/adapters/` are infrastructure implementations of interfaces defined in domain packages: OCR and LLM interfaces are defined in `internal/receipt/`; the `FileStore` interface is defined in `internal/shared/`.

---

## Section 2: HTTP Layer

The chi router is assembled once in `main.go`. No global state — all dependencies are injected.

### Middleware stack (outermost → innermost)

```
RequestID → Logger → Recoverer → Auth → HouseholdScope → [route handler]
```

| Middleware | Responsibility |
|---|---|
| `RequestID` | Attaches a unique ID to every request, propagated through logs |
| `Logger` | Structured JSON log per request (method, path, status, latency, request ID) |
| `Recoverer` | Catches panics, returns 500 without crashing the server |
| `Auth` | Reads `Authorization: Bearer <token>`, validates session, attaches `userID` to context. Returns 401 if missing/invalid/expired/revoked. Public routes bypass this. |
| `HouseholdScope` | Resolves the authenticated user's active household, attaches `householdID` to context. All downstream write operations use this value — never a user-supplied household ID. |

### Route grouping

```
/api/v1
  /auth
    POST   /register
    POST   /login
    DELETE /session

  /households
    POST   /
    GET    /:householdID
    POST   /:householdID/members
    DELETE /:householdID/members/:userID
    POST   /:householdID/share-links

  /inventories
    GET    /
    POST   /
    GET    /:inventoryID
    GET    /:inventoryID/items
    POST   /:inventoryID/items
    PATCH  /:inventoryID/items/:itemID
    DELETE /:inventoryID/items/:itemID
    GET    /:inventoryID/items/:itemID/batches
    POST   /:inventoryID/items/:itemID/batches

  /grocery-lists
    GET    /
    POST   /
    GET    /:listID
    PATCH  /:listID
    POST   /:listID/items
    PATCH  /:listID/items/:itemID
    POST   /:listID/complete

  /receipts
    POST   /scans
    GET    /scans/:scanID
    GET    /scans/:scanID/items
    PATCH  /scans/:scanID/items/:itemID
    POST   /scans/:scanID/commit

  /catalog
    GET    /entries
    GET    /stores
    GET    /transactions

  /settings
    GET    /
    PATCH  /
```

This list is a starting skeleton — it will grow as features are implemented.

### API versioning

`/api/v1` prefix from day one. A future `/api/v2` is a new chi group — no routing gymnastics.

### Response envelope

```json
{ "data": { ... } }           // success
{ "error": "message" }        // client error (4xx)
{ "error": "internal error" } // server error (5xx) — detail logged, not exposed
```

---

## Section 3: Domain Package Anatomy

Every domain follows the same internal shape:

```
internal/<domain>/
  model.go          ← domain types
  repository.go     ← Repository interface (no pgx/sqlc imports)
  repository_pg.go  ← postgres implementation wrapping sqlc (imports gen/sqlc)
  service.go        ← business logic; depends on Repository interface
  handler.go        ← Handler struct + all HandleX methods
  routes.go         ← RegisterRoutes(r chi.Router) — full URL surface in one place
  dto.go            ← request/response structs + decode/validate helpers
  worker.go         ← River job definitions for this domain (only in domains that own jobs)
```

`worker.go` is present only where a domain owns River jobs:
- `internal/receipt/worker.go` — `ProcessReceiptScanJob` (OCR → LLM pipeline)
- `internal/catalog/worker.go` — `ProcessPurchaseTransactionJob` (store/catalog upsert + inventory update)

### Dependency direction

```
handler → service → repository (interface)
                         ↑
               repository_pg (implementation, imports sqlc)
```

No layer imports above itself. `service.go` has zero pgx or sqlc imports — it is pure business logic, fully testable with mocked repositories.

### Repository interface pattern

The interface is defined in the domain package (consumer-defined, idiomatic Go) and implemented in `repository_pg.go`:

```go
// internal/inventory/repository.go
type Repository interface {
    GetItem(ctx context.Context, id uuid.UUID) (*model.InventoryItem, error)
    ListItems(ctx context.Context, inventoryID uuid.UUID) ([]model.InventoryItem, error)
    SumBatchQuantity(ctx context.Context, itemID uuid.UUID) (float64, error)
    WithTx(tx *pgx.Tx) Repository
}
```

`repository_pg.go` imports `gen/sqlc` and implements the interface. The `WithTx` method returns a new repository scoped to a transaction.

### Cross-domain dependencies

The `receipt` service is the primary cross-domain orchestrator. It receives `inventory`, `catalog`, and `grocery` services as constructor arguments. Dependency direction is one-way: `receipt → others`. No cycles.

### Handler file growth

If `handler.go` becomes large, split by sub-resource:

```
handler_items.go
handler_batches.go
```

`routes.go` always remains a single file — the URL surface must be readable at a glance.

### `shared/` package

Contains only things with no domain ownership: middleware, context key constants, pagination helpers, standard error/response types, and the `FileStore` interface.

---

## Section 4: Database Layer

### Migrations — goose

Migration files in `db/migrations/` as sequential `.sql` files. Goose runs embedded migrations at server startup — operators never run a separate command; `docker compose up` handles it.

```
db/migrations/
  00001_create_users.sql
  00002_create_sessions.sql
  00003_create_households.sql
  ...
```

### sqlc

Query files in `db/queries/` grouped by domain. Generated output committed to `gen/sqlc/`.

```
db/queries/
  inventory.sql
  grocery.sql
  receipt.sql
  catalog.sql
  auth.sql
  ...
```

### pg_cron scheduled tasks

| Task | Schedule | What it does |
|---|---|---|
| Purge expired sessions | Daily | Delete rows where `revoked_at IS NOT NULL OR expires_at < now()` |
| Purge empty batches | Daily | Delete `inventory_batches` where `emptied_at IS NOT NULL` |
| Archive completed lists | Daily | Transition `grocery_lists` from `completed` to `archived` past retention window |
| Purge archived lists | Daily | Delete `archived` lists where `expires_at < now()` and `pinned_at IS NULL` |

pg_cron is configured via migration — no app-layer scheduler is required.

### Connection

A single `*pgxpool.Pool` is created at startup and injected into all `repository_pg.go` constructors. No global DB variable.

### Transaction handling

`repository_pg.go` exposes `WithTx(*pgx.Tx) Repository`. Cross-domain operations (e.g. receipt commit) open a transaction from the pool and pass it down:

```go
tx, _ := pool.Begin(ctx)
defer tx.Rollback(ctx)
inventoryRepo.WithTx(tx).UpdateBatch(...)
catalogRepo.WithTx(tx).UpsertEntry(...)
tx.Commit(ctx)
```

Single-domain reads and writes use the pool directly — no transaction overhead.

---

## Section 5: Authentication

### Session model

A `sessions` table stores one row per active login. The raw token is never stored — only `sha256(raw_token)`:

```
sessions
  — id, user_id, token_hash (unique),
    created_at, expires_at, revoked_at
```

### Login flow

1. `POST /api/v1/auth/login` — validates credentials against `users.password_hash` (bcrypt, cost 12)
2. Generates a cryptographically random 32-byte token, stores `sha256(token)` in `sessions`
3. Returns the raw token to the client in the response body

### Request authentication

Every request sends `Authorization: Bearer <raw_token>`. The `Auth` middleware:
1. Hashes the token with sha256
2. Looks up `token_hash` in `sessions`
3. Checks `expires_at` and `revoked_at`
4. Attaches resolved `userID` to request context
5. Returns `401` if missing, invalid, expired, or revoked

### Logout

`DELETE /api/v1/auth/session` stamps `revoked_at` on the current session — instant invalidation.

### Session expiry

Configurable via `user_settings` (`session_duration_days`, default 30). Expired sessions are purged by pg_cron.

### Share link access (public user)

A system-seeded singleton user (well-known UUID) represents anonymous link access. When a valid `inventory_share_links` token is presented via query param, the `Auth` middleware creates a request context scoped to `userID = public_user_uuid` and `inventoryID` locked to that share link. No `sessions` row is created.

---

## Section 6: Receipt Scan Pipeline

### State machine

```
uploading → ocr_processing → llm_processing → pending_review → committed
                                                             ↘ failed
```

Mirrors `receipt_scans.status`.

### Step 1 — Upload

`POST /api/v1/receipts/scans`:
- Stores the image via `FileStore`
- Creates a `receipt_scans` row with `status = uploading`
- Enqueues a `ProcessReceiptScanJob` River job
- Returns `scanID` immediately — client polls status

### Step 2 — River worker (`ProcessReceiptScanJob`)

```
status: ocr_processing → call OCRProvider.ExtractText → store ocr_text
status: llm_processing → call LLMProvider.ParseReceipt → create receipt_scan_items rows
status: pending_review
on any error: status: failed + error_message
```

River handles retries automatically.

### Step 3 — User review

- `GET /api/v1/receipts/scans/:scanID/items` — returns parsed items with confidence scores
- `PATCH /api/v1/receipts/scans/:scanID/items/:itemID` — user accepts, rejects, or writes corrected values into `corrected_*` fields

Review is mandatory. Parsed data is never auto-applied.

### Step 4 — Commit

`POST /api/v1/receipts/scans/:scanID/commit`:
- Creates a `purchase_transactions` row per accepted/corrected item (with `receipt_scan_item_id` set)
- Stamps `receipt_scans.status = committed`
- Enqueues a `ProcessPurchaseTransactionJob` River job per created transaction

### `ProcessPurchaseTransactionJob` (reusable)

This job runs the same workflow whether triggered by receipt commit or a manual purchase entry:

```
→ upsert store by name → resolve/create stores row → set purchase_transactions.store_id
→ upsert catalog_entry by name+brand → resolve/create catalog_entries row → set purchase_transactions.catalog_entry_id
→ resolve inventory_item_id by following FK:
    receipt_scan_item_id → receipt_scan_items.inventory_item_id, OR
    grocery_list_item_id → grocery_list_items.inventory_item_id
→ if inventory_item_id resolved → add/update inventory_batches
```

Decouples receipt commit (fast, synchronous) from downstream catalog + inventory effects (async, retryable).

### Pluggable providers

Interfaces defined in `internal/receipt/`:

```go
type OCRProvider interface {
    ExtractText(ctx context.Context, imagePath string) (string, error)
}

type LLMProvider interface {
    ParseReceipt(ctx context.Context, ocrText string) ([]ParsedLineItem, error)
}
```

Implementations live in `internal/adapters/ocr/` and `internal/adapters/llm/`. At startup, `main.go` reads `ocr_provider_configs` and `llm_provider_configs` from the DB and wires the correct implementation — per-household with system-level fallback.

### File storage

`FileStore` interface defined in `internal/shared/`:

```go
type FileStore interface {
    Store(ctx context.Context, name string, r io.Reader) (path string, err error)
    Open(ctx context.Context, path string) (io.ReadCloser, error)
}
```

| Adapter | Notes |
|---|---|
| **Local filesystem** | Default. Configurable base path. |
| **S3-compatible** | AWS S3, Cloudflare R2, MinIO (set `s3.endpoint` to local MinIO URL). |
| **Azure Blob Storage** | Separate adapter for Azure users. |

Selected via `storage.backend` in `config.yaml`.

---

## Section 7: Configuration

YAML as the primary config source, with environment variable overrides on top (via `viper`). Secrets never appear in the config file.

### Sample `config.yaml`

```yaml
server:
  port: 8080
  public_url: https://baskety.example.com

database:
  url: postgres://user:pass@localhost:5432/baskety

storage:
  backend: local        # local | s3 | azure
  local_path: ./data/uploads
  s3:
    endpoint: ""        # empty = AWS; set for MinIO, R2, etc.
    bucket: baskety
    access_key: ""
    secret_key: ""
  azure:
    container: ""
    connection_string: ""

encryption:
  key_file: /run/secrets/baskety_key

log:
  level: info           # debug | info | warn | error
  format: json          # json | text
```

### Encryption key

`encryption.key_file` points to a file containing the AES encryption key. The key itself never appears in the config or in environment variables.

| Deployment style | How to manage the key file |
|---|---|
| Docker Compose | Docker secret mounted at `/run/secrets/baskety_key` |
| Bare metal | Plain file with `chmod 600` |
| Advanced | Vault or another secret manager writes to the path |

### Startup behaviour

`main.go` loads the `Config` struct first. Missing required values (database URL, encryption key file) produce a clear error and halt startup before any connection is attempted.

---

## Section 8: Testing Strategy

### Unit tests — service layer

`service.go` files tested with mocked repositories. Mocks generated with `mockery` against the `Repository` interface. No database, no HTTP — pure business logic verification.

```
internal/inventory/service_test.go   ← shortfall calculation, batch aggregation
internal/grocery/service_test.go     ← list generation logic
internal/receipt/service_test.go     ← pipeline orchestration, mocked OCR/LLM providers
```

### Integration tests — repository layer

`repository_pg.go` files tested against a real PostgreSQL instance via `testcontainers-go`. Each test run applies goose migrations to a clean schema. Verifies actual SQL: joins, aggregations, soft deletes, batch sum queries — behaviours mocks cannot catch.

```
internal/inventory/repository_pg_test.go
internal/receipt/repository_pg_test.go
...
```

### Handler tests — HTTP layer

`handler.go` files tested with `httptest.NewRecorder` + chi router, mocked services. Verifies request parsing, response shape, status codes, and middleware integration.

```
internal/inventory/handler_test.go
internal/auth/handler_test.go
...
```

### CI discipline

- `go test -race ./...` — race detector on every run
- `go vet ./...` + `golangci-lint` — static analysis
- Integration tests use `testcontainers-go` — no external DB required in CI
- `gen/sqlc/` committed — CI never needs sqlc installed

### Out of scope (initial implementation)

End-to-end tests (belong to the frontend/mobile test suite) and load testing.
