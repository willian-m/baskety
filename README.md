# Baskety
> *Cestinha* in Portuguese

A self-hosted, open-source grocery and pantry management app for families.

---

> **Agentic SDLC:** This project is being designed and implemented entirely through an agentic software development lifecycle — architecture, code, tests, and documentation are generated and evolved through structured LLM-driven sessions. No line of code is written without a preceding architecture decision logged in `docs/superpowers/specs/`.

---

## What it does

Baskety goes beyond a simple shopping list. It tracks your home inventory — quantities, expiration dates, and target stock levels — and automatically generates a grocery list of what you need to restock. After shopping, scan your receipt and Baskety updates your inventory for you.

**Key features:**
- Shared family accounts — multiple users, one shared pantry
- Inventory tracking with expiration dates, batch quantities, and target stock levels
- Auto-generated grocery lists, prioritizing expired or low-stock items
- Receipt scanning via OCR + LLM that parses line items for review before inventory update
- Price history tracking across stores and brands over time
- Spending dashboards: habits, frequently purchased items, waste from expired goods
- Self-hostable with Docker Compose — one container, one binary, one port

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Go + chi + sqlc + pgxpool + goose + River |
| Database | PostgreSQL + pg_cron |
| Web frontend | React + Vite + TanStack Router + TanStack Query + Zustand + shadcn/ui + Tailwind |
| Mobile | Expo (React Native) + Expo Router + TanStack Query + Zustand |
| Shared packages | `@baskety/core` (types, API client, hooks, stores) · `@baskety/ui` (cross-platform primitives) |
| OCR | Pluggable — Tesseract, Google Vision, AWS Textract, Azure, custom |
| LLM | Pluggable — Ollama, OpenAI, Anthropic, LiteLLM proxy, custom |
| File storage | Local filesystem (default), S3-compatible, Azure Blob |
| Deployment | Docker Compose (primary), optional Kubernetes manifests |

---

## Architecture overview

### Monorepo layout

```
baskety/                    # Go backend
apps/
  web/                      # Vite SPA (embedded into the Go binary at build time)
  mobile/                   # Expo Android app
packages/
  core/                     # Shared: types, API client, TanStack Query hooks, Zustand stores, Zod schemas
  ui/                       # Shared: cross-platform primitive components
package.json                # pnpm workspaces root
pnpm-workspace.yaml
turbo.json                  # Build order: core → ui → web + mobile (parallel) → Go binary
docker-compose.yml
```

### One container, one binary

The web app (`apps/web/dist/`) is embedded into the Go binary at compile time via `go:embed`. No separate Node.js runtime or web server. A `docker compose up` starts one container serving both the API and the frontend.

---

## Backend

### Stack decisions

| Concern | Choice |
|---|---|
| HTTP router | chi — stdlib-compatible, composable middleware |
| Database access | sqlc — type-safe generated code, explicit SQL, no ORM |
| Connection pool | pgxpool — single pool, injected via dependency injection |
| Migrations | goose — embedded, runs at startup |
| Background jobs | River — PostgreSQL-backed, zero extra infrastructure |
| DB maintenance | pg_cron — purges expired sessions, empty batches, archived lists |
| Auth | Opaque session tokens — sha256-hashed, DB-backed, instantly revocable |
| Config | YAML + env var overrides (viper) |
| Secrets | Key file (Docker secrets compatible) — never in config or environment |

### Project structure

```
baskety/
├── cmd/baskety/main.go       # Wires all dependencies, starts HTTP server + River workers
├── internal/
│   ├── auth/                 # Sessions, login, logout, register
│   ├── household/            # Households, members, share links
│   ├── inventory/            # Items, batches, quantity tracking
│   ├── grocery/              # Lists, list items, auto-generation
│   ├── receipt/              # Scan upload, OCR, LLM, review, commit
│   ├── catalog/              # Entries, stores, purchase transactions
│   ├── settings/             # System/household/user settings, provider configs
│   ├── shared/               # Middleware, pagination, errors, context helpers, FileStore
│   └── adapters/
│       ├── ocr/              # OCRProvider implementations
│       ├── llm/              # LLMProvider implementations
│       └── storage/          # FileStore implementations (local, s3, azure)
├── db/
│   ├── migrations/           # goose .sql migration files
│   └── queries/              # sqlc .sql query files
├── gen/sqlc/                 # sqlc-generated Go — committed, never hand-edited
└── config.yaml
```

Every domain package follows the same internal shape:

```
model.go          ← domain types
repository.go     ← Repository interface (no pgx/sqlc imports)
repository_pg.go  ← postgres implementation wrapping sqlc
service.go        ← business logic; depends on Repository interface
handler.go        ← HTTP handlers
routes.go         ← RegisterRoutes(r chi.Router)
dto.go            ← request/response structs + validation
worker.go         ← River job definitions (only in receipt/ and catalog/)
```

### Authentication

Sessions are stored as `sha256(raw_token)` — the raw token is returned once at login and never stored server-side. Clients send `Authorization: Bearer <raw_token>`. Logout stamps `revoked_at` for instant invalidation. Session duration is configurable per user; pg_cron purges expired sessions daily.

### Receipt scan pipeline

```
upload → ocr_processing → llm_processing → pending_review → committed
                                                          ↘ failed
```

1. **Upload** — image stored via `FileStore`; `ProcessReceiptScanJob` enqueued; `scanID` returned immediately
2. **River worker** — calls `OCRProvider.ExtractText` then `LLMProvider.ParseReceipt`; writes parsed line items
3. **User review** — accept, reject, or correct each line item (mandatory; data is never auto-applied)
4. **Commit** — creates `purchase_transactions`; enqueues `ProcessPurchaseTransactionJob` per item
5. **`ProcessPurchaseTransactionJob`** — upserts store + catalog entry; updates inventory batches

OCR and LLM providers are pluggable interfaces. Implementations live in `internal/adapters/`. Selected per-household with system-level fallback via `llm_provider_configs` / `ocr_provider_configs` in the database.

---

## Database schema

Designed around two philosophies:

- **Inventory subsystem (item-centric):** the item record is the source of truth. Transactions automate updates but do not define state. Consumption is edited directly, never logged.
- **Price tracking subsystem (transaction-centric):** purchase records focused on price, store, brand, and date — not used to compute inventory state.

### Core tables

| Section | Tables |
|---|---|
| Identity | `users`, `sessions`, `households`, `household_members`, `inventory_share_links` |
| Inventories | `inventories`, `inventory_permissions`, `inventory_items`, `inventory_batches` |
| Grocery | `grocery_lists`, `grocery_list_items` |
| Receipts | `receipt_scans`, `receipt_scan_items` |
| Price tracking | `stores`, `catalog_entries`, `purchase_transactions` |
| Settings | `system_settings`, `household_settings`, `user_settings`, `llm_provider_configs`, `ocr_provider_configs` |

### Permission model

- **Owner:** implicit full access to all household inventories
- **Member (no row):** defaults to full access; owners opt members out explicitly
- **Guest (no row):** defaults to deny; requires an explicit `read_only` row
- **Link-based access:** a system-seeded public user singleton handles anonymous share link sessions — no `household_members` row created

---

## Web frontend

### Stack decisions

| Concern | Choice |
|---|---|
| Build tool | Vite |
| Router | TanStack Router — type-safe params + search params |
| Server state | TanStack Query — cache, mutations, optimistic updates |
| Session + household | React Context — low-frequency, read broadly |
| Complex UI state | Zustand — three stores only |
| UI components | shadcn/ui + `@baskety/ui` |
| Styling | Tailwind CSS |
| Charts | Recharts (in `features/catalog/`) |

### State layers

| Layer | What lives here |
|---|---|
| TanStack Query | All data from the API |
| React Context | Auth session + active household id |
| Zustand | `receiptReviewStore`, `shoppingTripStore`, `uiStore` |
| `useState` | Everything else |

The three Zustand stores are defined in `@baskety/core/stores/` and shared with the mobile app. The persist adapter (`localStorage` vs `AsyncStorage`) is injected at app startup — store logic has no platform imports.

### Structure rules

- Routes import from features; features never import other features
- All TanStack Query hooks live in `@baskety/core/queries/` — no per-feature `queries.ts` in `apps/web/`
- The `_app.tsx` layout route is the single auth guard — no per-route checks
- Filter and date range state lives in the URL (typed search params with Zod), not in Zustand

---

## Mobile (Android)

### Stack decisions

| Concern | Choice |
|---|---|
| Framework | Expo (managed workflow) |
| Router | Expo Router — file-based, deep links |
| Server state | TanStack Query (same hooks as web via `@baskety/core`) |
| Query persistence | `persistQueryClient` + AsyncStorage (grocery list only) |
| Global state | Same three Zustand stores; AsyncStorage persist adapter |
| Styling | React Native StyleSheet — no Tailwind |
| Build | EAS Build — APK for sideloading; one-line change for Play Store AAB |

### Navigation

5 tabs: Home, Inventory, Grocery, Receipts, Settings. Statistics is a full-screen push from the Home dashboard — not a tab.

Shopping trip, receipt review, and statistics screens hide the tab bar (focus mode).

### Network-aware URL switching

Self-hosters often have a local IP on home WiFi and a public URL elsewhere. The `useServerUrl` hook reads the current WiFi SSID via `@react-native-community/netinfo`, matches it against `uiStore.networkProfiles`, and writes the resolved URL to `uiStore.activeServerUrl`. The API client reads it on every request — no platform code inside `@baskety/core`.

Requires `ACCESS_FINE_LOCATION` on Android 9+. Falls back to the external URL if permission is denied.

### Offline strategy

Only the grocery list is offline-first. All other features require a live connection.

- Grocery queries are persisted to AsyncStorage via `persistQueryClient`
- Grocery mutations use `networkMode: 'offlineFirst'`; `useOfflineSync` replays them when connectivity returns
- `shoppingTripStore` is persisted to AsyncStorage — survives app close mid-shopping-trip

---

## Shared packages

### `@baskety/core`

TypeScript types, API client, TanStack Query hooks, Zustand stores, Zod validation schemas. Zero platform imports — consumed identically by web and mobile.

The API client reads `uiStore.activeServerUrl` (set by `useServerUrl` on mobile; `null` on web where `/api/v1` uses the Vite proxy).

### `@baskety/ui`

Cross-platform primitive components (Button, Badge, TextInput, Card, Avatar, Spinner, ExpiryBadge) using the `.web.tsx` / `.native.tsx` platform extension pattern. Metro and Vite resolve the correct implementation automatically — consumers import from one path.

---

## Testing strategy

| Layer | Tools |
|---|---|
| Go service layer | Unit tests with mocked repositories (mockery) |
| Go repository layer | Integration tests against real PostgreSQL via testcontainers-go |
| Go HTTP layer | Handler tests with httptest + mocked services |
| React components | Vitest + React Testing Library + MSW |
| React Native components | Jest + React Native Testing Library + MSW |
| Zustand stores | Pure function tests (Vitest / Jest); shared between web and mobile |
| Shared packages/ui | Vitest (web) + Jest + RNTL (native) per primitive |

CI disciplines: `go test -race ./...`, `go vet`, `golangci-lint`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

---

## Architecture specs

Full architecture decision records live in `docs/superpowers/specs/`:

| Spec | Contents |
|---|---|
| `2026-06-07-db-schema-design.md` | PostgreSQL schema for all subsystems |
| `2026-06-07-go-backend-architecture-design.md` | Go backend architecture |
| `2026-06-07-frontend-architecture-design.md` | React web frontend architecture |
| `2026-06-08-android-app-architecture-design.md` | Android app architecture (Expo) |

---

## Development

> Build and run commands will be added here once the project is scaffolded.

**Quick start (planned):**

```bash
# Start backend + database
docker compose up

# Start frontend dev server (proxies /api → :8080)
pnpm --filter web dev

# Start mobile dev server
pnpm --filter mobile start
```

---

## Self-hosting

Baskety is designed for self-hosters. The entire stack runs from a single `docker compose up`. No external services required — OCR and LLM providers are optional and pluggable; the app works without them (manual inventory entry remains fully functional).

Configuration is via `config.yaml` with environment variable overrides. The encryption key is loaded from a file (compatible with Docker secrets) and never appears in config or environment variables.

---

## License

MIT
