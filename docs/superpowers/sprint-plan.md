# Baskety — Implementation Sprint Plan

> Produced: 2026-06-08.
> Architecture is fully locked. This document covers only implementation work.
> Assumes one full-time developer. Sprint = 1 calendar week (5 working days).

---

## Summary Table

| Sprint | Theme | Est. Days | Calendar Week |
|--------|-------|-----------|---------------|
| 1 | Monorepo Scaffold + Shared Packages Bootstrap | 5d | Week 1 |
| 2 | Database: Migrations, sqlc, Test Harness | 5d | Week 2 |
| 3 | Go Backend — Auth + Household Domains | 4.5d | Week 3 |
| 4 | Go Backend — Inventory Domain | 5d | Week 4 |
| 5 | Go Backend — Grocery Lists Domain | 4.5d | Week 5 |
| 6 | Go Backend — Receipt Scanning Domain | 6.5d | Weeks 6–7 |
| 7 | Go Backend — Catalog, Settings, pg_cron, Wire-up | 4.5d | Week 8 |
| 8 | Go Backend — Integration Tests + OpenAPI | 4d | Week 9 |
| 9 | Web Frontend — Foundation + Auth Pages | 4.5d | Week 10 |
| 10 | Web Frontend — Inventory + Grocery Pages | 5d | Week 11 |
| 11 | Web Frontend — Receipt Review + Reports + Settings | 5.5d | Week 12 |
| 12 | Web Frontend — Share Page + Test Coverage | 4d | Week 13 |
| 13 | Mobile — Foundation + Auth + Navigation | 4.5d | Week 14 |
| 14 | Mobile — Inventory + Grocery Screens | 5d | Week 15 |
| 15 | Mobile — Receipt Scanning + Offline + Network Switching | 5d | Week 16 |
| 16 | Mobile — Testing + EAS Build Pipeline | 3.5d | Week 17 |
| 17 | Docker, CI/CD, Release Pipeline | 4d | Week 18 |
| 18 | End-to-End Hardening + Launch Readiness | 4.5d | Week 19 |
| **Total** | | **83.5d** | **19 weeks** |

---

## Sprint 1 — Monorepo Scaffold + Shared Packages Bootstrap

**Goal:** A working, runnable monorepo skeleton where all workspaces resolve, build, and lint cleanly. No application logic yet.

| # | Task | Est. |
|---|------|------|
| 1.1 | Initialize git repo; add `.gitignore` (Go, Node, Expo, Docker, secrets) | 0.5d |
| 1.2 | Scaffold pnpm workspace root: `pnpm-workspace.yaml`, root `package.json`, shared ESLint + Prettier config | 0.5d |
| 1.3 | Configure Turborepo `turbo.json`: pipelines for `build`, `test`, `lint`, `typecheck` with correct task dependency order | 0.5d |
| 1.4 | Scaffold `packages/core`: `package.json`, TypeScript config, Zod dependency, empty barrel exports (`api/`, `queries/`, `stores/`, `validation/`) | 1d |
| 1.5 | Scaffold `packages/ui`: `package.json`, TypeScript + React Native peer deps, empty component stubs with `.web.tsx`/`.native.tsx` extension pattern | 1d |
| 1.6 | Scaffold `apps/web`: Vite + React + TypeScript + Tailwind + shadcn/ui init; confirm `pnpm dev` starts on `:5173` | 0.5d |
| 1.7 | Scaffold `apps/mobile`: `npx create-expo-app` with TypeScript template; add Expo Router; confirm Expo Go boots | 0.5d |
| 1.8 | Scaffold `baskety/` (Go module): `go.mod`, `cmd/baskety/main.go` stub, directory skeleton for all internal domain packages | 0.5d |

**Sprint total: 5d**

---

## Sprint 2 — Database: Migrations, sqlc, Test Harness

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

---

## Sprint 3 — Go Backend: Auth + Household Domains

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

---

## Sprint 4 — Go Backend: Inventory Domain

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

---

## Sprint 5 — Go Backend: Grocery Lists Domain

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

---

## Sprint 6 — Go Backend: Receipt Scanning Domain

**Goal:** Full receipt scan state machine (upload → OCR → LLM → pending_review → commit) implemented with River background jobs and pluggable provider adapters.

**Dependencies:** Sprints 4–5.

> This sprint is 6.5d — run as a 1.5-week sprint or defer task 6.6 (Anthropic adapter) to Sprint 7.

| # | Task | Est. |
|---|------|------|
| 6.1 | Implement `internal/receipt`: `model.go`, `dto.go`, `repository.go` interface | 0.5d |
| 6.2 | Implement `receipt/repository_pg.go`: create scan, update scan status/fields, create scan items, list scan items, update scan item | 0.5d |
| 6.3 | Define `OCRProvider` interface; implement Tesseract adapter (shell out to `tesseract` CLI) | 0.5d |
| 6.4 | Define `LLMProvider` interface; implement Ollama adapter (HTTP call to local endpoint, structured JSON prompt) | 0.5d |
| 6.5 | Implement OpenAI adapter for `LLMProvider` | 0.5d |
| 6.6 | Implement Anthropic adapter for `LLMProvider` | 0.5d |
| 6.7 | Add River job queue to `cmd/baskety/main.go`; implement `ProcessReceiptScanJob`: drive OCR → LLM → persist receipt_scan_items → set status=pending_review; handle failures | 1d |
| 6.8 | Implement `receipt/service.go`: upload image (FileStore), enqueue job, get scan, get/update scan items, commit (create purchase_transactions, stamp receipt_scans.status=committed, enqueue ProcessPurchaseTransactionJob) | 1d |
| 6.9 | Implement `receipt/handler.go` + `routes.go` + `worker.go` | 0.5d |
| 6.10 | Unit tests for `receipt/service.go` (mock OCR/LLM providers, mock repository) | 0.5d |
| 6.11 | Cruncher/soft-delete integrity integration test (see backend spec Section 8) | 0.5d |

**Sprint total: 6.5d**

---

## Sprint 7 — Go Backend: Catalog, Settings, pg_cron, Wire-up

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

---

## Sprint 8 — Go Backend: Integration Tests + OpenAPI

**Goal:** All repository-layer integration tests passing. OpenAPI 3.1 document served at `GET /api/v1/openapi.json`. Backend is shippable.

**Dependencies:** Sprints 3–7.

| # | Task | Est. |
|---|------|------|
| 8.1 | Repository integration tests — auth: register, login, session lifecycle | 0.5d |
| 8.2 | Repository integration tests — household: create, members, permissions, share link | 0.5d |
| 8.3 | Repository integration tests — inventory: soft-delete, batch aggregation | 0.5d |
| 8.4 | Repository integration tests — grocery: auto-generation query correctness | 0.5d |
| 8.5 | Repository integration tests — receipt: state machine transitions, commit flow | 0.5d |
| 8.6 | Repository integration tests — catalog: upsert idempotency, price history ordering | 0.5d |
| 8.7 | Implement `GET /api/v1/share/:token/inventory`: unauthenticated endpoint validates token, checks expiry/revocation, returns read-only inventory view | 0.5d |
| 8.8 | Generate and serve OpenAPI 3.1 spec at `GET /api/v1/openapi.json` (swaggo or hand-authored YAML embedded in binary) | 0.5d |

**Sprint total: 4d**

---

## Sprint 9 — Web Frontend: Foundation + Auth Pages

**Goal:** Web app has routing, auth context, API client wired to backend, and working login/register pages.

**Dependencies:** Sprint 3 (auth API live); Sprint 1 (packages/core scaffold).

| # | Task | Est. |
|---|------|------|
| 9.1 | Implement `packages/core/api/types.ts`: all domain TypeScript types (money as number minor units + currency string; quantities and timestamps as strings) | 1d |
| 9.2 | Implement `packages/core/api/client.ts`: typed fetch wrapper, reads uiStore for token/activeHouseholdId/activeServerUrl, unwraps `{ data }` envelope, throws `ApiError` on non-2xx | 0.5d |
| 9.3 | Implement `packages/core/stores/uiStore.ts`: token, activeHouseholdId, activeServerUrl, sidebarCollapsed; setSession, clearSession | 0.5d |
| 9.4 | Implement `packages/core/queries/auth.ts`: useLogin, useRegister, useLogout, useHouseholds | 0.5d |
| 9.5 | Implement `AuthContext` + `HouseholdContext` in `apps/web`; wire into root layout | 0.5d |
| 9.6 | Configure TanStack Router route tree: all routes declared with auth guard on `_app.tsx` parent, redirects | 0.5d |
| 9.7 | Build `/login` page: email/password form with Zod validation, error display, redirect on success | 0.5d |
| 9.8 | Build `/register` page: email/name/password fields, validation, auto-login after registration | 0.5d |

**Sprint total: 4.5d**

---

## Sprint 10 — Web Frontend: Inventory + Grocery Pages

**Goal:** Users can view and manage inventory items, batches, and grocery lists from the web app.

**Dependencies:** Sprints 4–5 (APIs live); Sprint 9.

| # | Task | Est. |
|---|------|------|
| 10.1 | Implement `packages/core/queries/inventory.ts`: useInventories, useInventoryItems, useInventoryItem, useCreateItem, useUpdateItem, useDeleteItem, useBatches, useAddBatch | 1d |
| 10.2 | Build `/inventory` page: item list with search/filter by category; ExpiryBadge for expiring items; quantity vs. target indicator | 1d |
| 10.3 | Build `/inventory/:itemId` page: item detail — batch list, edit item form, add batch drawer | 1d |
| 10.4 | Implement `packages/core/queries/grocery.ts`: useGroceryLists, useGroceryList, useCreateList, useAddListItem, useUpdateListItem, useCompleteList | 0.5d |
| 10.5 | Build `/grocery` page: list of grocery lists (pinned first, then by date); create new list button; status badges | 0.5d |
| 10.6 | Build `/grocery/:listId` page: items grouped by status; check-off inline; add item form; complete list action | 1d |

**Sprint total: 5d**

---

## Sprint 11 — Web Frontend: Receipt Review + Reports + Settings

**Goal:** Receipt upload, review, and commit flow live on web. Reports page shows price history. Settings manages provider configs.

**Dependencies:** Sprints 6–7 (APIs live); Sprint 10.

| # | Task | Est. |
|---|------|------|
| 11.1 | Implement `packages/core/queries/receipt.ts`: useStartScan, useScanStatus, useScanItems, useUpdateScanItem, useCommitScan | 0.5d |
| 11.2 | Build `/receipt` page: file picker upload, scan history list with status badges, poll scan status | 0.5d |
| 11.3 | Build `/receipt/:scanId/review` page: table of parsed line items; accept/reject/correct each item; confidence indicators; commit button gated on all items reviewed | 2d |
| 11.4 | Implement `packages/core/queries/catalog.ts`: useCatalogEntries, useStores, usePriceHistory | 0.5d |
| 11.5 | Build `/reports` page: price history per item across stores (Recharts line chart) | 1d |
| 11.6 | Build `/settings` page: household settings, LLM provider config form, OCR provider config form | 1d |

**Sprint total: 5.5d** — `/reports` (11.5) is the most deferrable if running behind.

---

## Sprint 12 — Web Frontend: Share Page + Test Coverage

**Goal:** Unauthenticated share page works. Web frontend has solid test coverage. packages/ui web variants complete.

**Dependencies:** Sprint 8 (share endpoint); Sprint 11.

| # | Task | Est. |
|---|------|------|
| 12.1 | Build `/share/:token` page: unauthenticated inventory view, read-only item list, expiry indicators; optional password prompt | 0.5d |
| 12.2 | Implement `packages/ui` web variants fully: Button, Badge, TextInput, Card, Avatar, Spinner, ExpiryBadge (`.web.tsx`) | 1d |
| 12.3 | Set up MSW for web: handlers for all API routes using Zod schemas as fixture factories | 0.5d |
| 12.4 | Vitest + RTL tests — auth pages: form validation, error states, success redirect | 0.5d |
| 12.5 | Vitest + RTL tests — inventory pages: item list rendering, add item flow, expiry badge logic | 0.5d |
| 12.6 | Vitest + RTL tests — receipt review page: accept/reject/correct flow, commit button state | 0.5d |
| 12.7 | Vitest + RTL tests — grocery list page: check-off item, complete list action | 0.5d |

**Sprint total: 4d**

---

## Sprint 13 — Mobile: Foundation + Auth + Navigation

**Goal:** Expo app boots, routes work, login/register screens functional against real API.

**Dependencies:** Sprint 9 (packages/core reused in mobile); Sprint 1 (apps/mobile scaffold).

| # | Task | Est. |
|---|------|------|
| 13.1 | Configure Expo Router file-based routes: `(auth)/_layout`, `(auth)/login`, `(auth)/register`, `(auth)/onboarding`, `(app)/_layout`, all app screens | 0.5d |
| 13.2 | Implement `useServerUrl` hook in `apps/mobile/shared/hooks/`: reads WiFi SSID via `@react-native-community/netinfo`; matches against network profiles; falls back to externalUrl | 1d |
| 13.3 | Wire `@baskety/core` AuthContext, HouseholdContext, API client, and TanStack QueryClient (with AsyncStorage persister) in mobile root `_layout.tsx` | 0.5d |
| 13.4 | Build Onboarding screen: external URL input with connectivity check; optional local SSID + URL for home network | 0.5d |
| 13.5 | Build Login screen: email/password form, error feedback, redirect on success | 0.5d |
| 13.6 | Build Register screen: email/name/password, validation, auto-login | 0.5d |
| 13.7 | Implement `packages/ui` native variants: Button, Badge, TextInput, Card, Avatar, Spinner, ExpiryBadge (`.native.tsx`) | 1d |

**Sprint total: 4.5d**

---

## Sprint 14 — Mobile: Inventory + Grocery Screens

**Goal:** All inventory and grocery screens fully functional on Android.

**Dependencies:** Sprint 13; Sprints 4–5 (backend APIs).

| # | Task | Est. |
|---|------|------|
| 14.1 | Build Inventory list screen: FlatList of items, search bar, category filter chips, ExpiryBadge, quantity vs. target bar | 1d |
| 14.2 | Build Inventory item detail screen: batch list, edit item bottom sheet, add batch form | 1d |
| 14.3 | Implement grocery list offline persistence: configure `persistQueryClient` with AsyncStorage persister for grocery queries only; optimistic updates for check-off | 1d |
| 14.4 | Build Grocery lists screen: list of active/pinned lists, create new list FAB | 0.5d |
| 14.5 | Build Grocery list detail screen: item rows with swipe-to-check, status filter tabs | 0.5d |
| 14.6 | Build Shopping trip screen (`/grocery/:listId/trip`): full-screen focus mode, large check-off items, progress indicator, complete trip action | 1d |

**Sprint total: 5d**

---

## Sprint 15 — Mobile: Receipt Scanning + Offline + Network Switching

**Goal:** Camera-based receipt scanning, full review flow on mobile, and offline grocery list fully verified.

**Dependencies:** Sprint 14; Sprint 6 (receipt API).

| # | Task | Est. |
|---|------|------|
| 15.1 | Implement `useCamera` hook: wraps expo-camera (viewfinder) + expo-image-picker (gallery); returns URI + requestPermission | 0.5d |
| 15.2 | Build Scan tab home screen: camera capture button, gallery picker fallback, recent scans list with status | 0.5d |
| 15.3 | Implement upload flow: compress image, POST as FormData (no Content-Type override), navigate to status screen | 0.5d |
| 15.4 | Build scan status screen: animated progress states (uploading/OCR/LLM/pending_review); auto-navigates on pending_review | 0.5d |
| 15.5 | Build receipt review screen (full-screen, tab bar hidden): scrollable list of parsed items; accept/reject/correct inline; confirm and commit | 2d |
| 15.6 | Implement `useOfflineSync`: listens to NetInfo connectivity; calls `queryClient.resumePausedMutations()` on reconnect | 0.5d |
| 15.7 | Verify offline grocery list round-trip: go offline → check items → reconnect → mutations replay; fix any AsyncStorage edge cases | 0.5d |

**Sprint total: 5d**

---

## Sprint 16 — Mobile: Testing + EAS Build Pipeline

**Goal:** Mobile test suite green. EAS Build produces a signed APK installable on a real device.

**Dependencies:** Sprint 15.

| # | Task | Est. |
|---|------|------|
| 16.1 | Set up Jest + RNTL + MSW for mobile: configure jest preset, MSW server with handlers, mock react-native-community/netinfo | 0.5d |
| 16.2 | RNTL tests — auth screens: login/register form validation and error states | 0.5d |
| 16.3 | RNTL tests — inventory screens: list rendering, item detail, add batch | 0.5d |
| 16.4 | RNTL tests — grocery screens: item check-off, offline persistence mock | 0.5d |
| 16.5 | RNTL tests — receipt review screen: accept/reject/correct/commit flow | 0.5d |
| 16.6 | Configure `eas.json`: development, preview, production profiles; configure signing keystore | 0.5d |
| 16.7 | Run EAS Build `--platform android --profile production`; install and smoke test APK on a real Android device | 0.5d |

**Sprint total: 3.5d**

---

## Sprint 17 — Docker, CI/CD, Release Pipeline

**Goal:** Docker image builds and runs end-to-end. All three GitHub Actions workflows pass.

**Dependencies:** Sprint 8 (backend complete); Sprint 12 (web complete).

| # | Task | Est. |
|---|------|------|
| 17.1 | Write `docker/postgres/Dockerfile`: FROM postgres:16; install postgresql-16-cron; configure shared_preload_libraries | 0.5d |
| 17.2 | Write root `Dockerfile` (canonical multi-stage): Stage 1 node+pnpm web build; Stage 2 golang embeds dist, builds binary; Stage 3 alpine runtime | 1d |
| 17.3 | Write `docker-compose.yml`: postgres (custom image, volume, healthcheck, restart), baskety (depends_on health, config bind-mount, upload volume, Docker secret), minio (optional profile) | 0.5d |
| 17.4 | Write `.env.example`, `config.yaml.example`, `secrets/baskety_key.example` | 0.5d |
| 17.5 | Write `.github/workflows/ci.yml`: `test-go` + `test-frontend` parallel jobs on PR + main push | 0.5d |
| 17.6 | Write `.github/workflows/docker.yml`: triggered after CI on main; push `:latest` + `:<sha>` to GHCR | 0.5d |
| 17.7 | Write `.github/workflows/release.yml`: triggered on `v*.*.*` tag; push versioned image; create draft GitHub Release | 0.5d |

**Sprint total: 4d**

---

## Sprint 18 — End-to-End Hardening + Launch Readiness

**Goal:** All loose ends closed. README complete. Project is ready for public `v1.0.0` release.

**Dependencies:** All previous sprints.

| # | Task | Est. |
|---|------|------|
| 18.1 | Smoke test full Docker Compose stack locally end-to-end: register → household → inventory → grocery list → shopping trip → scan receipt → commit | 1d |
| 18.2 | Security audit: verify all endpoints enforce householdID scope; session revocation works; no PII in structured logs | 0.5d |
| 18.3 | DB index pass: add indexes on all FK columns and high-frequency query predicates; run EXPLAIN ANALYZE on auto-generation query | 0.5d |
| 18.4 | Write `README.md`: project description, screenshots (web + mobile), Docker Compose quick-start, configuration reference, self-hosting guide, backup instructions | 1d |
| 18.5 | Update `CLAUDE.md` build/run commands section with all final commands (go run, pnpm dev, docker compose up, eas build) | 0.5d |
| 18.6 | Tag `v1.0.0`; verify `release.yml` fires, GHCR image is pushed, and GitHub Release draft is created; build APK and attach to release | 1d |

**Sprint total: 4.5d**

---

## Effort Summary

| Category | Sprints | Est. Days |
|----------|---------|-----------|
| Monorepo + Shared Packages | 1 | 5d |
| Database (migrations, sqlc, test harness) | 2 | 5d |
| Go Backend (all domains + integration tests + OpenAPI) | 3–8 | ~30d |
| Web Frontend (all pages + tests) | 9–12 | ~19d |
| Mobile App (all screens + tests + EAS build) | 13–16 | ~18d |
| Docker + CI/CD + Release Pipeline | 17 | 4d |
| Hardening + Launch Readiness | 18 | 4.5d |
| **Total** | **18 sprints** | **~83.5d** |

**Calendar duration:** ~19 weeks (~4.5 months) with one full-time developer.

### Risk flags

- **Sprint 6 (Receipt Scanning)** runs 6.5 days — the heaviest sprint. Run as a 1.5-week sprint or defer the Anthropic LLM adapter to Sprint 7.
- **Sprint 11 (Web: Receipt + Reports + Settings)** runs 5.5 days — `/reports` (task 11.5) is the most deferrable if running behind.
- **Receipt review UI** (both web Sprint 11.3 and mobile Sprint 15.5) is estimated at 2d each — these are the most UX-complex screens and may run over.
- Estimates assume fluency in Go, TypeScript, React, and React Native. Ramp-up on unfamiliar tools (River, Turborepo, Expo EAS) is baked in at ~0.5d per tool.
- CI integration tests (testcontainers-go) require Docker available on the GitHub Actions runner — `ubuntu-latest` supports this natively without Docker-in-Docker.
