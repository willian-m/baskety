# Frontend Architecture — Baskety

**Date:** 2026-06-07
**Scope:** React web app architecture for all core subsystems

---

## Design Principles

- **Self-hosted first:** The web app is embedded into the Go binary at build time. No separate Node.js runtime. One container, one binary, one port.
- **Feature-based ownership:** Code is organized by domain (auth, inventory, grocery, receipt, catalog, settings), mirroring the Go backend. Everything for a domain lives together.
- **Three-layer state:** Server data in TanStack Query, session identity in Context, complex UI state in Zustand. `useState` for everything else. No layer bleeds into another.
- **Routes import features, features never import features:** Cross-domain coupling is prevented at the import level.

---

## Section 1: Stack Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Build tool | Vite | Fast HMR, native ESM, minimal config |
| Router | TanStack Router | Type-safe params and search params; integrates with TanStack Query loaders |
| Server state | TanStack Query | Cache, background refetch, mutations, optimistic updates |
| Global client state | React Context | Auth session and active household — low-frequency, read broadly |
| Complex UI state | Zustand | Three specific stores only (see Section 5) |
| UI components | shadcn/ui + `@baskety/ui` | shadcn/ui for web-specific components; `@baskety/ui` for cross-platform primitives shared with the mobile app |
| Styling | Tailwind CSS | Utility-first, design system via config |
| Charts | Recharts | React-native, composable, good TypeScript support |
| Deployment | `go:embed` | SPA build output embedded in the Go binary at compile time |

### Monorepo context

The web app lives at `apps/web/` in a pnpm monorepo. It consumes two shared packages:

- **`@baskety/core`** — TypeScript types, API client, TanStack Query hooks, Zustand stores, Zod validation schemas. Shared with the Android app.
- **`@baskety/ui`** — Cross-platform primitive components (Button, Badge, TextInput, Card, Avatar, Spinner) with `.web.tsx` / `.native.tsx` implementations. Shared with the Android app.

These packages have no dependency on the web app. The web app's `features/` components import from `@baskety/core` and `@baskety/ui` rather than defining their own API and store logic.

---

## Section 2: Project Structure

### Monorepo root

```
baskety/                    # Go backend (unchanged from backend spec)
apps/
  web/                      # React web app (this spec)
package.json                # pnpm workspace root
pnpm-workspace.yaml
turbo.json                  # Turborepo build pipeline
docker-compose.yml          # builds Go binary (embeds web), starts postgres
.gitignore
```

### apps/web/

```
apps/web/
├── src/
│   ├── features/                    # one dir per backend domain
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── AuthContext.tsx      # Context + useAuth hook
│   │   ├── household/
│   │   │   ├── HouseholdContext.tsx # activeHouseholdId context
│   │   │   └── MembersPage.tsx
│   │   ├── inventory/
│   │   │   ├── InventoryPage.tsx
│   │   │   ├── ItemDetailPage.tsx
│   │   │   ├── BatchEditor.tsx
│   │   │   └── ExpiryBadge.tsx
│   │   ├── grocery/
│   │   │   ├── GroceryListPage.tsx
│   │   │   └── ShoppingTripView.tsx # uses shoppingTripStore from @baskety/core
│   │   ├── receipt/
│   │   │   ├── ScanUploadPage.tsx
│   │   │   ├── ReviewPage.tsx       # uses receiptReviewStore from @baskety/core
│   │   │   └── ReviewItemRow.tsx
│   │   ├── catalog/
│   │   │   ├── SpendingReportPage.tsx
│   │   │   ├── PriceHistoryChart.tsx
│   │   │   └── InflationTrackerPage.tsx
│   │   └── settings/
│   │       └── SettingsPage.tsx
│   ├── routes/                      # TanStack Router file-based tree
│   │   ├── __root.tsx               # QueryClientProvider, RouterProvider, Toaster
│   │   ├── _auth.tsx                # unauthenticated layout; redirects to / if already authed
│   │   ├── _auth.login.tsx
│   │   ├── _auth.register.tsx
│   │   ├── _app.tsx                 # authenticated layout + single auth guard
│   │   ├── _app.index.tsx
│   │   ├── _app.inventory.tsx
│   │   ├── _app.inventory.$itemId.tsx
│   │   ├── _app.grocery.tsx
│   │   ├── _app.grocery.$listId.tsx
│   │   ├── _app.grocery.$listId.trip.tsx
│   │   ├── _app.receipt.tsx
│   │   ├── _app.receipt.$scanId.review.tsx
│   │   ├── _app.reports.tsx
│   │   ├── _app.settings.tsx
│   │   └── share.$token.tsx         # public share link — outside _app, no auth required
│   ├── shared/
│   │   ├── components/              # shadcn/ui + custom cross-domain components
│   │   ├── lib/
│   │   │   ├── api-client.ts        # typed fetch wrapper for the Go API
│   │   │   └── utils.ts
│   │   └── stores/
│   │       ├── receiptReviewStore.ts
│   │       ├── shoppingTripStore.ts
│   │       └── uiStore.ts
│   └── main.tsx                     # entry point, router + query client setup
├── public/
├── index.html
├── vite.config.ts                   # proxies /api → Go backend in dev
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Rules

- Routes import from features, not the other way around. `_app.inventory.tsx` renders `InventoryPage` from `features/inventory/`.
- Features never import from other features. Cross-domain data flows through the API, not component imports.
- Shared components have no domain knowledge. A `DataTable` in `shared/components/` knows nothing about inventory items.
- All TanStack Query hooks and keys are defined in `@baskety/core/queries/`. Feature components import hooks from there — no query logic is defined inside `apps/web/`.
- The `_app.tsx` layout route enforces the auth guard. All authenticated routes are children of it — no per-route auth checks.

---

## Section 3: API Layer

### Fetch wrapper

The API client lives in `@baskety/core/api/client.ts` (shared with the mobile app) and is re-exported from `shared/lib/api-client.ts` for convenience within the web app. It handles the Go API response envelope (`{ "data": {...} }` / `{ "error": "..." }`), attaches the auth token, and throws `ApiError` on non-2xx responses so TanStack Query's error handling activates automatically.

```ts
// @baskety/core/api/client.ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),   // reads token from uiStore
      ...init?.headers,
    },
  });

  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body.error);
  return body.data as T;
}
```

### Query hooks

All TanStack Query hooks are defined in `@baskety/core/queries/` and consumed by both the web and mobile apps. The web app imports them directly from the package — no per-feature `queries.ts` files exist in `apps/web/`.

```ts
// @baskety/core/queries/inventory.ts
export function useInventoryItems(inventoryId: string) {
  return useQuery({
    queryKey: ["inventory", inventoryId, "items"],
    queryFn: () => request<InventoryItem[]>(`/inventories/${inventoryId}/items`),
  });
}

export function useUpdateBatch(inventoryId: string) {
  return useMutation({
    mutationFn: ({ itemId, ...body }: { itemId: string; [k: string]: unknown }) =>
      request(`/inventories/${inventoryId}/items/${itemId}/batches`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["inventory", inventoryId] }),
  });
}
```

### TypeScript types

Types are hand-written in `@baskety/core/api/types.ts` to match Go API response shapes. No code generation at this stage — the API surface is small enough. `openapi-typescript` can be introduced later if the API grows significantly.

### Query key hierarchy

```
["inventory", householdId, "items"]           // all items
["inventory", householdId, "items", itemId]   // one item
["grocery", householdId, "lists"]             // all lists
["grocery", householdId, "lists", listId]     // one list
["receipt", scanId, "items"]                  // scan line items
["catalog", householdId, "transactions"]      // price history
```

Invalidating at a higher key level cascades to all children.

**Rule:** Components never call `request()` directly. All API access goes through hooks in `@baskety/core/queries/`.

---

## Section 4: Routing Architecture

### Route tree and URLs

| File | URL |
|---|---|
| `_auth.login.tsx` | `/login` |
| `_auth.register.tsx` | `/register` |
| `_app.index.tsx` | `/` |
| `_app.inventory.tsx` | `/inventory` |
| `_app.inventory.$itemId.tsx` | `/inventory/:itemId` |
| `_app.grocery.tsx` | `/grocery` |
| `_app.grocery.$listId.tsx` | `/grocery/:listId` |
| `_app.grocery.$listId.trip.tsx` | `/grocery/:listId/trip` |
| `_app.receipt.tsx` | `/receipt` |
| `_app.receipt.$scanId.review.tsx` | `/receipt/:scanId/review` |
| `_app.reports.tsx` | `/reports` |
| `_app.settings.tsx` | `/settings` |
| `share.$token.tsx` | `/share/:token` |

### Auth guard

`_app.tsx` has a single `beforeLoad` hook. If the user is not authenticated it redirects to `/login`. All authenticated routes are children of `_app.tsx` — no per-route auth checks. `_auth.tsx` redirects in the opposite direction: if already authenticated, redirect to `/`.

### Search params — typed

Filter and date range state lives in the URL, not in Zustand. TanStack Router validates search params with Zod at the route level — bookmarkable, back-button friendly.

```ts
// _app.inventory.tsx
validateSearch: z.object({
  category: z.string().optional(),
  expiring: z.boolean().optional(),
})

// _app.reports.tsx
validateSearch: z.object({
  from: z.string().optional(),   // ISO date
  to: z.string().optional(),
  store_id: z.string().optional(),
})
```

### Route loaders — prefetch on navigate

Loaders call `ensureQueryData` before the component renders, so pages load instantly without a spinner on normal navigation.

```ts
// _app.inventory.tsx
loader: ({ context }) =>
  context.queryClient.ensureQueryData(
    inventoryItemsQueryOptions(context.householdId)
  )
```

### Share link route

`share.$token.tsx` sits outside `_app.tsx`. It requires no authentication. It reads the share link token, presents a read-only inventory view, and optionally prompts for a password if the link is password-protected.

---

## Section 5: State Management

Three layers with distinct responsibilities. They do not overlap.

### Layer 1: TanStack Query — all server data

Every piece of data from the Go API lives here. Components never fetch directly — they call hooks from their feature's `queries.ts`.

### Layer 2: React Context — session and household

Two contexts, initialized once at app load:

- **`AuthContext`** — current user (id, name, email) and `logout()`. Read by the auth guard, topbar, and any component that needs to know who is logged in.
- **`HouseholdContext`** — active household id. Every API call that is household-scoped reads this. Sourced from `uiStore.activeHouseholdId` and exposed via Context so components don't need to know about Zustand.

When the user switches household, `uiStore.activeHouseholdId` updates, `HouseholdContext` propagates the new value, and all TanStack Query keys scoped to `householdId` are invalidated — every page refetches automatically.

### Layer 3: Zustand — three stores only

All three stores are defined in `@baskety/core/stores/` and shared with the mobile app. The persistence adapter is platform-specific: `localStorage` on web, `AsyncStorage` on mobile. Each store accepts an injectable persist adapter so the store logic itself has no platform imports.

**`receiptReviewStore`**
Draft accept/reject/correction state during the receipt review step. Multi-component, not server state until committed.

```ts
receiptReviewStore {
  scanId: string
  items: Map<itemId, { status, correctedName, correctedPrice, ... }>
  markAccepted(itemId)
  markRejected(itemId)
  applyCorrection(itemId, corrections)
  reset()
}
```

Cleared on commit or abandon.

**`shoppingTripStore`**
Checked-off item ids during an active shopping trip. Must survive navigation (e.g., user switches to inventory to check a quantity). Persisted so a browser refresh or phone screen-off during a shop doesn't lose progress.

```ts
shoppingTripStore {
  activeListId: string
  checkedItemIds: Set<itemId>
  toggleItem(itemId)
  clearTrip()
}
```

**`uiStore`**
Sidebar collapsed state, active household id (source of truth fed into `HouseholdContext`), session token, and server URL. All persisted. `authHeader()` in the API client reads the token via `uiStore.getState().token` — Zustand stores are readable outside React without hooks. `serverUrl` is set during onboarding on mobile and unused on web (which uses the Vite proxy).

```ts
uiStore {
  sidebarCollapsed: boolean
  activeHouseholdId: string
  token: string | null
  serverUrl: string | null        // mobile only; null on web
  toggleSidebar()
  setActiveHousehold(id)
  setSession(token, firstHouseholdId)  // called on login
  clearSession()                        // called on logout
}
```

On login, `setSession` stores the raw token and sets `activeHouseholdId` to the first household returned by the login response. On logout, `clearSession` nulls both and all TanStack Query cache is cleared.

### Decision tree for new state

```
Is it data from the API?                                         → TanStack Query
Is it auth or household identity?                                → Context
Must it survive navigation or be shared across distant trees?    → Zustand
Everything else                                                  → useState
```

---

## Section 6: Component Architecture

### Two-level hierarchy

**`shared/components/`** — no domain knowledge, reusable across all features.

- shadcn/ui components (copied in, owned by the project): Button, Input, Select, Dialog, Sheet, Popover, Table, DataTable, Form, Label, Badge, Skeleton, Tabs, Card, DatePicker, Calendar, DropdownMenu, Command, Toast/Toaster.
- Custom shared components: AppShell, Sidebar, PageHeader, ConfirmDialog, EmptyState, ErrorBoundary, LoadingPage.

**`features/*/`** — domain-specific, only used within their feature. May import from `shared/`, never from other features.

### App shell layout

`_app.tsx` renders `AppShell`, which contains:
- **Topbar** — logo, household selector (switches `uiStore.activeHouseholdId`), user menu.
- **Sidebar** — navigation links (Inventory, Grocery Lists, Receipts, Reports, Settings). Collapses on small screens, driven by `uiStore.sidebarCollapsed`.
- **`<Outlet />`** — child route renders here.

### Container / presentational pattern

Page components own data fetching and mutations. Sub-components are pure — they receive props and render.

```tsx
// InventoryPage.tsx — container
export function InventoryPage() {
  const { data } = useInventoryItems(householdId);
  const updateBatch = useUpdateBatch();
  return <ItemGrid items={data} onUpdateBatch={updateBatch.mutate} />;
}

// ItemGrid.tsx — presentational, no queries
export function ItemGrid({ items, onUpdateBatch }: Props) {
  return items.map(item => <ItemCard key={item.id} item={item} onUpdate={onUpdateBatch} />);
}
```

### Charts

Recharts is the charting library. Chart components live in `features/catalog/` and receive plain data arrays as props. No chart library code appears in `shared/`.

```
PriceHistoryChart({ transactions: PurchaseTransaction[] })
SpendingByStoreChart({ transactions: PurchaseTransaction[] })
MonthlySpendingChart({ transactions: PurchaseTransaction[] })
InflationIndexChart({ items: InflationDataPoint[] })
```

---

## Section 7: Go Integration

### Embedding the SPA

`apps/web/dist/` (Vite build output) is embedded in the Go binary using `go:embed`. The SPA handler serves static files and falls back to `index.html` for all unknown paths (required for client-side routing).

```go
// baskety/internal/shared/spa.go

//go:embed dist
var staticFiles embed.FS

func SPAHandler() http.Handler {
    sub, _ := fs.Sub(staticFiles, "dist")
    fileServer := http.FileServer(http.FS(sub))

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        path := strings.TrimPrefix(r.URL.Path, "/")
        if _, err := sub.Open(path); err != nil {
            r.URL.Path = "/"
        }
        fileServer.ServeHTTP(w, r)
    })
}
```

Wired in `main.go`:

```go
r.Mount("/api/v1", apiRouter)   // API routes take precedence
r.Handle("/*", shared.SPAHandler())  // SPA catch-all
```

### Docker build (multi-stage)

```dockerfile
# Stage 1: build the web app
FROM node:22-alpine AS web
WORKDIR /app
COPY apps/web/ ./
RUN pnpm install --frozen-lockfile && pnpm build

# Stage 2: build the Go binary (embeds the dist)
FROM golang:1.23-alpine AS go
WORKDIR /app
COPY baskety/ ./
COPY --from=web /app/dist ./internal/shared/dist
RUN go build -o baskety ./cmd/baskety

# Stage 3: minimal runtime image
FROM alpine:3.20
COPY --from=go /app/baskety /usr/local/bin/baskety
ENTRYPOINT ["baskety"]
```

### Development

Vite dev server runs on `:5173`. `vite.config.ts` proxies `/api/*` to the Go server on `:8080`. No CORS config needed, no embedding in dev.

```ts
// vite.config.ts
server: {
  proxy: {
    "/api": "http://localhost:8080"
  }
}
```

`make dev` starts both processes with a single command.

---

## Section 8: Testing Strategy

### Component tests — Vitest + React Testing Library

Primary test layer. Each feature component has a colocated test file. Tests render components with a mocked TanStack Query provider and assert on user-visible behavior.

```
features/inventory/InventoryPage.test.tsx
features/receipt/ReviewPage.test.tsx
features/grocery/ShoppingTripView.test.tsx
```

**MSW (Mock Service Worker)** intercepts `fetch` calls at the network level and returns fixtures. Components are tested against realistic API response shapes — no hand-crafted mock functions.

### Store tests — Vitest

The three Zustand stores are pure functions tested without React or DOM:

```
shared/stores/receiptReviewStore.test.ts
shared/stores/shoppingTripStore.test.ts
shared/stores/uiStore.test.ts
```

### API client tests — Vitest + MSW

`shared/lib/api-client.ts` has a dedicated test suite verifying envelope unwrapping, auth header injection, and `ApiError` throwing on non-2xx responses.

### Out of scope

End-to-end tests (Playwright, full browser + real backend) belong to a separate suite run against a deployed environment. Not in scope for the initial implementation.

### CI pipeline

```
pnpm typecheck    # tsc --noEmit
pnpm lint         # ESLint
pnpm test         # Vitest (unit + component)
pnpm build        # Vite build (catches import errors)
```

All four must pass before the Go build stage runs in Docker.
