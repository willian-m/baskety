# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Baskety** (*Cestinha* in pt-BR) is a self-hosted, open-source grocery management app. Core differentiator: an inventory system that tracks quantities, expiration dates, and target stock levels — and auto-generates grocery lists from inventory gaps. Receipt scanning via OCR + LLM extracts purchase data to update inventory automatically.

## Tech Stack

- **Backend:** Go + PostgreSQL
- **Frontend:** React (web)
- **Mobile:** React Native
- **Deployment:** Docker Compose (primary), optional Kubernetes manifests
- **LLM integration:** Modular — supports self-hosted (Ollama) and frontier models (OpenAI, Anthropic, etc.)

## Architecture Principles

**Modularity for self-hosters:** OCR and LLM integrations must be pluggable. Users may substitute their own models. Design these as interfaces/adapters, not hardcoded implementations.

**Shared family accounts:** Multiple users share a single inventory and grocery list. All write operations must be scoped to a `household_id` (or equivalent), not just `user_id`.

**Receipt scanning flow:** OCR → text → LLM structured extraction → user review/correction → inventory update. The review step is mandatory; never auto-apply parsed data without user confirmation.

## Key Domain Concepts

- **Inventory item:** name, quantity on hand, target quantity, expiration date(s), category
- **Grocery list:** auto-generated from inventory shortfalls (quantity < target, or items expired/expiring soon); user-editable
- **Receipt scan:** raw image → OCR text → LLM-parsed line items (name, qty, price, store, brand) → pending review → committed to inventory
- **Price history:** per-item price tracking across stores and brands over time

## Project Structure

```
GroceryStoreList/
├── baskety/                  # Go backend (single binary)
│   ├── cmd/baskety/main.go   # entry point — wires all deps, starts server
│   ├── internal/
│   │   ├── auth/             # session auth: register, login, logout, middleware
│   │   ├── household/        # households, members, share links, scope middleware
│   │   ├── inventory/        # Sprint 4 — inventory items, batches, soft-delete
│   │   ├── grocery/          # Sprint 5 — grocery lists, auto-generation
│   │   ├── receipt/          # Sprint 6 — receipt scanning, OCR/LLM pipeline, job queue
│   │   ├── catalog/          # Sprint 7 — catalog entries, stores, price history
│   │   ├── settings/         # Sprint 7 — LLM/OCR provider settings
│   │   ├── shared/           # config, DB pool, migrations, health, SPA handler
│   │   ├── adapters/         # OCR, LLM, storage adapter stubs
│   │   └── testutil/         # testcontainers-go harness for integration tests
│   ├── db/
│   │   ├── migrations/       # goose .sql migration files (00001–00007)
│   │   └── queries/          # sqlc .sql query files (input to codegen)
│   └── gen/sqlc/             # sqlc-generated Go code — committed, never hand-edited
├── apps/
│   └── mobile/               # Expo (React Native) app — Sprint 13–16
│       ├── app/
│       │   ├── _layout.tsx               # root: PersistQueryClientProvider + hydration gate
│       │   ├── (auth)/                   # login, register, onboarding screens
│       │   └── (app)/                    # authenticated screens
│       │       ├── inventory.tsx         # Sprint 14 — inventory list (search, category filter)
│       │       ├── inventory/[itemId].tsx # Sprint 14 — item detail (batches, edit, delete)
│       │       ├── grocery.tsx           # Sprint 14 — grocery lists (pinned/active, FAB)
│       │       ├── grocery/[listId].tsx  # Sprint 14 — list detail (swipe-to-check, filter tabs)
│       │       └── grocery/[listId]/trip.tsx # Sprint 14 — shopping trip screen
│       └── shared/hooks/                 # useServerUrl (network profile auto-detection)
├── packages/
│   ├── core/                 # shared TS: API client, TanStack Query hooks, Zustand store
│   └── ui/                   # shared component library (.native.tsx + .web.tsx variants)
├── docs/
│   ├── ARCHITECTURE.md
│   └── superpowers/
│       ├── specs/            # locked architecture decisions (DB, backend, frontend, etc.)
│       └── sprints/          # sprint plan + per-sprint task files
└── compose.dev.yml           # Docker Compose for local dev (Postgres only)
```

## Build / Run Commands

```bash
# Start Postgres for local dev
docker compose -f compose.dev.yml up -d

# Run the server (applies migrations on startup)
cd baskety && go run ./cmd/baskety serve

# Run migrations only
cd baskety && go run ./cmd/baskety migrate

# Unit tests (no DB required)
cd baskety && go test ./internal/auth/... ./internal/household/...

# Full test suite (requires Docker for testcontainers)
cd baskety && go test ./...

# Build binary
cd baskety && go build ./cmd/baskety
```

API base: `http://localhost:8080`  
Health check: `GET /healthz`

## Implemented API Endpoints

All authenticated routes require `Authorization: Bearer <token>`. Household-scoped routes accept an optional `X-Household-ID` header (falls back to the caller's first household). Full spec: `GET /api/v1/openapi.json`.

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
DELETE /api/v1/auth/session

GET    /api/v1/households
POST   /api/v1/households
GET    /api/v1/households/:id
POST   /api/v1/households/:id/members
DELETE /api/v1/households/:id/members/:userID
POST   /api/v1/households/:id/share-links

GET/POST/DELETE  /api/v1/inventories/...       (items, batches, quantity)
GET/POST/PATCH   /api/v1/inventories/:id/lists/... (grocery lists + auto-generate)
GET/POST/PATCH   /api/v1/receipts/...          (scans, scan items, commit)
GET/POST/PATCH   /api/v1/catalog/...           (stores, entries, transactions)
GET/PUT/DELETE   /api/v1/settings/...          (LLM/OCR providers, key-value settings)

GET    /api/v1/share/:token/inventory          (unauthenticated; X-Share-Password header if protected)
GET    /api/v1/openapi.json                    (OpenAPI 3.1 spec)
GET    /healthz
```

## Domain Package Conventions

Every domain under `internal/` follows the same shape:
- `model.go` — domain types (`uuid.UUID`, `time.Time` only; no pgx/sqlc)
- `repository.go` — Repository interface (no pgx imports)
- `repository_pg.go` — postgres implementation wrapping sqlc
- `service.go` — business logic + `ServiceIface` for testability
- `handler.go` — HTTP handlers using `ServiceIface`
- `routes.go` — `RegisterRoutes(r chi.Router, h *Handler)`
- `middleware.go` — domain-owned middleware (auth token validation, household scoping)
- `*_test.go` — hand-rolled mocks (no mockery); unit tests only at service + handler layers

Response envelope: `{"data": ...}` for success, `{"error": "..."}` for errors.

## Sprint Status

| Sprint | Theme | Status |
|--------|-------|--------|
| 1 | Monorepo scaffold + shared packages | Done |
| 2 | DB migrations, sqlc, test harness | Done |
| 3 | Auth + Household domains | Done |
| 4 | Inventory domain | Done |
| 5 | Grocery lists domain | Done |
| 6 | Receipt scanning domain | Done |
| 7 | Catalog, settings, pg_cron, wire-up | Done |
| 8 | Integration tests + OpenAPI | Done |
| 9–12 | Web frontend | Not started |
| 13 | Mobile: Foundation + Auth + Navigation | Done |
| 14 | Mobile: Inventory + Grocery Screens | Done |
| 15–16 | Mobile: Receipt scanning + Settings | Not started |
| 17–18 | Docker/CI/CD + hardening | Not started |

Sprint plans: `docs/superpowers/sprints/sprint-NN.md`

## Development Notes

- The `prompts/` directory contains agent-drafting notes — ignore it; it does not reflect current project state.
- `gen/sqlc/` is committed — contributors can build without installing sqlc. Run `make generate` to regenerate after changing queries.
- Go module path: `github.com/willian-m/baskety`
- Go runtime installed via mise: `~/.local/share/mise/installs/go/1.26.4/bin/go`
