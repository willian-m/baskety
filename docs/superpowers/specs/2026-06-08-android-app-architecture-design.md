# Android App Architecture — Baskety

**Date:** 2026-06-08
**Scope:** React Native (Expo) Android app architecture for all user-facing subsystems

---

## Design Principles

- **Shared logic, native UI:** Business logic (types, API client, query hooks, stores, validation) lives in a shared package consumed by both the web and mobile apps. UI is written natively for each platform — no React Native Web, no compromise on feel.
- **Feature parity for users:** The Android app covers all user-facing features. Server management (OCR/LLM endpoint configuration, system settings) is web-only.
- **Offline where it matters:** The grocery list is the only offline-first flow. Everything else requires a live connection.
- **Self-hosted first:** The app targets a user's own Baskety server. Network-aware URL switching makes local access transparent on home WiFi and external access seamless elsewhere.
- **Same rules as the web:** Routes import from features; features never import from each other; all API access goes through shared hooks.

---

## Section 1: Stack Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Expo (managed workflow) | Camera, file access, and permissions via Expo SDK; EAS Build for APK distribution |
| Router | Expo Router | File-based routing, deep links, route groups for auth separation |
| Server state | TanStack Query | Same as web; shared hooks from `@baskety/core` |
| Query persistence | `persistQueryClient` + AsyncStorage | Grocery list queries persisted to disk for offline shopping trips |
| Global client state | React Context | AuthContext, HouseholdContext — same as web |
| Complex UI state | Zustand (`@baskety/core/stores`) | Same three stores as web; AsyncStorage persist adapter on mobile |
| Styling | React Native StyleSheet | Native styling; no Tailwind on mobile |
| Network detection | `@react-native-community/netinfo` | WiFi SSID detection for automatic server URL switching |
| Build | EAS Build | APK for sideloading; AAB when Play Store distribution is desired |

---

## Section 2: Monorepo Structure

The Android app slots into the existing monorepo alongside two new shared packages.

```
baskety/                    # Go backend (unchanged)
apps/
  web/                      # Vite + React (updated to consume shared packages)
  mobile/                   # Expo app (new)
packages/
  core/                     # Shared logic — types, API client, hooks, stores (new)
  ui/                       # Cross-platform primitive components (new)
package.json                # pnpm workspace root
pnpm-workspace.yaml
turbo.json
docker-compose.yml
```

### Dependency rules

- Packages have no dependency on apps.
- Apps never import from each other.
- `packages/core` has zero UI imports — no React Native, no DOM.
- `packages/ui` has no domain knowledge and no API calls.

### Turborepo build order

```
@baskety/core → @baskety/ui → apps/web + apps/mobile (parallel) → Go binary (embeds web dist)
```

---

## Section 3: packages/core

Shared business logic. Consumed by both `apps/web` and `apps/mobile`. Zero platform imports.

```
packages/core/src/
  api/
    client.ts       ← typed fetch wrapper; reads activeServerUrl + token from uiStore
    types.ts        ← all domain TypeScript types
    errors.ts       ← ApiError class
  queries/
    auth.ts
    inventory.ts
    grocery.ts
    receipt.ts
    catalog.ts
    household.ts
    settings.ts
  stores/
    uiStore.ts
    shoppingTripStore.ts
    receiptReviewStore.ts
  validation/
    auth.ts         ← Zod schemas
    inventory.ts
    grocery.ts
  index.ts          ← barrel export
  package.json
  tsconfig.json
```

### API client — base URL and headers (canonical)

`client.ts` is the single shared client for both apps. It reads `uiStore.getState()` on every request — Zustand stores expose `getState()` outside React, no hook required — and derives the base URL plus auth and household headers from it.

- **Base URL.** Reads `activeServerUrl`.
  - **On web:** `activeServerUrl` is always `null`. The client uses a relative `/api/v1` path, which the Vite proxy rewrites to the Go backend.
  - **On mobile:** `useServerUrl` runs in the root `_layout.tsx`, computes the active URL from the current WiFi SSID, and writes it to `uiStore.activeServerUrl` via `setActiveServerUrl`. The client prepends it on every request.
- **Auth header.** If `token` is set, sends `Authorization: Bearer <token>`.
- **Household header.** If `activeHouseholdId` is set, sends `X-Household-ID: <activeHouseholdId>` (the backend `HouseholdScope` middleware validates it against the caller's memberships — selection only).
- **Content-Type.** Set to `application/json` **only** for non-`FormData` bodies. For the receipt multipart upload the body is `FormData`, so the client must **not** set `Content-Type` — `fetch` sets the multipart boundary itself.

```ts
// @baskety/core/api/client.ts  (canonical; the web spec defers to this)
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { activeServerUrl, token, activeHouseholdId } = uiStore.getState();
  const base = activeServerUrl ?? "";                 // null on web → relative for Vite proxy
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");  // never forced for FormData (receipt upload)
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (activeHouseholdId) headers.set("X-Household-ID", activeHouseholdId);

  const res = await fetch(`${base}/api/v1${path}`, { ...init, headers });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body.error, body.fields);
  return (body as { data: T }).data;
}
```

This keeps `@baskety/core/api/client.ts` free of platform imports while still reacting to network changes.

### Queries

All TanStack Query hooks are defined in this package (`@baskety/core/queries/`) — there are no per-feature `queries.ts` files in either app. Both apps import the same hooks (`useInventoryItems`, `useGroceryLists`, etc.) and the same household-scoped query key hierarchy (`["<domain>", householdId, ...]`; scan line items keyed by `scanId`). A `useHouseholds()` hook (`GET /households`, key `["households"]`) lists the caller's memberships to drive the household selector.

**Type contract (`api/types.ts`):** money is `pricePerUnitMinor: number` (integer minor units) paired with `currency: string` (ISO-4217); quantities are `string` (decimal, never a JS `number`, to avoid float rounding); timestamps are `string` (ISO-8601 / RFC 3339 UTC). These mirror the DB schema and Go DTOs exactly — see the DB spec's "Money & quantity representation" and "Timestamp & timezone representation". These types are **hand-written for now (interim)**; the target is generating `types.ts` from the backend's OpenAPI document (`GET /api/v1/openapi.json`) via `openapi-typescript`, consumed identically by web and mobile, with CI checking for drift (owned by the Go backend spec, Section 2; see the frontend spec, Section 3).

### Stores

The three Zustand stores accept an injectable persist adapter. On web the adapter wraps `localStorage`; on mobile it wraps `AsyncStorage`. Store logic is identical on both platforms.

**`uiStore` — updated shape for mobile:**

```ts
uiStore {
  sidebarCollapsed: boolean
  activeHouseholdId: string
  token: string | null
  externalUrl: string | null          // required; set during onboarding; persisted
  networkProfiles: Array<{            // persisted
    id: string
    label: string                     // e.g. "Home"
    ssids: string[]                   // one or more WiFi SSIDs
    serverUrl: string
  }>
  activeServerUrl: string | null      // NOT persisted; written by useServerUrl on mobile
  toggleSidebar()
  setActiveHousehold(id)
  setSession(token, firstHouseholdId)
  clearSession()
  setExternalUrl(url)
  setActiveServerUrl(url)             // called by useServerUrl on mount + network changes
  addProfile(profile)
  updateProfile(id, patch)
  removeProfile(id)
}
```

`serverUrl` (the old single field) is replaced by `externalUrl` + `networkProfiles` (persisted config) and `activeServerUrl` (runtime, computed). `activeServerUrl` is what `api/client.ts` reads; `useServerUrl` keeps it current.

---

## Section 4: packages/ui

A small set of cross-platform primitive components using the `.web.tsx` / `.native.tsx` platform extension pattern. Not a full design system — just the shared building blocks with identical visual intent on both platforms.

```
packages/ui/src/
  Button/
    index.ts            ← shared TypeScript prop interface
    Button.web.tsx      ← DOM + Tailwind implementation
    Button.native.tsx   ← React Native StyleSheet implementation
  Badge/
  TextInput/
  Card/
  Avatar/
  Spinner/
  ExpiryBadge/          ← domain-aware display (date → green/amber/red label), no side effects
  index.ts
  package.json
  tsconfig.json
```

### Platform extension pattern

Metro (mobile) and Vite (web) both resolve platform extensions automatically. Consumers import from one path:

```ts
import { Button } from '@baskety/ui'
// → Button.web.tsx on web
// → Button.native.tsx on mobile
```

### Rules

- Both implementations satisfy the same TypeScript interface defined in `index.ts`.
- No component in this package calls a query hook or reads from a store.
- shadcn/ui components stay in `apps/web` — they are DOM-only and not shared.
- Icons use `lucide-react` (web) and `lucide-react-native` (mobile), resolved via the same extension pattern.

---

## Section 5: apps/mobile Structure

```
apps/mobile/
├── app/                              # Expo Router file-based routes
│   ├── _layout.tsx                   # Root: providers + onboarding guard
│   ├── (auth)/
│   │   ├── _layout.tsx               # Redirects to / if already authenticated
│   │   ├── onboarding.tsx            # Server URL setup (first launch only)
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (app)/
│   │   ├── _layout.tsx               # Auth guard + bottom tab bar
│   │   ├── index.tsx                 # Home / dashboard
│   │   ├── statistics.tsx            # Full-screen push from Home; tab bar hidden
│   │   ├── inventory/
│   │   │   ├── index.tsx
│   │   │   └── [itemId].tsx
│   │   ├── grocery/
│   │   │   ├── index.tsx
│   │   │   └── [listId]/
│   │   │       ├── index.tsx
│   │   │       └── trip.tsx          # Shopping mode; tab bar hidden
│   │   ├── receipt/
│   │   │   ├── index.tsx
│   │   │   └── [scanId]/
│   │   │       └── review.tsx        # Full-screen review; tab bar hidden
│   │   ├── household/
│   │   │   └── index.tsx
│   │   └── settings/
│   │       ├── index.tsx
│   │       └── network.tsx           # Network profiles management
│   └── share/
│       └── [token].tsx               # Public share link — no auth required
├── features/                         # Domain components (native React Native)
│   ├── auth/
│   ├── inventory/
│   ├── grocery/
│   ├── receipt/
│   ├── household/
│   ├── catalog/
│   └── settings/
├── shared/
│   ├── components/                   # Mobile-only shared UI components
│   └── hooks/
│       ├── useCamera.ts              # Expo Camera + ImagePicker wrapper
│       ├── useOfflineSync.ts         # Detects connectivity; replays queued mutations
│       └── useServerUrl.ts           # Active server URL based on current WiFi SSID
├── app.json
├── eas.json
├── package.json
└── tsconfig.json
```

### Rules

- Route files are thin — they import from `features/` and render. No business logic in route files.
- Features never import from other features.
- All API access goes through hooks from `@baskety/core/queries/`.
- Features import primitives from `@baskety/ui` and logic from `@baskety/core`.

---

## Section 6: Navigation Architecture

### Bottom tab bar — 5 tabs

| Tab | Icon | Stack screens |
|---|---|---|
| Home | 🏠 | Dashboard → Statistics (full-screen push) |
| Inventory | 📦 | List → Item detail |
| Grocery | 🛒 | Lists → List detail → Shopping trip (full-screen) |
| Receipts | 🧾 | Scan list → Review (full-screen) |
| Settings | ⚙️ | Index → Network → Household |

Statistics is not a tab — it is a full-screen stack screen pushed from the Home dashboard via a "Statistics" card. Reports are a "review" mode consulted occasionally, not part of the daily loop. A tab implies frequent use; a dashboard card signals "here when you need it."

The shopping trip (`trip.tsx`), receipt review (`review.tsx`), and statistics (`statistics.tsx`) screens hide the tab bar — full-screen focus mode via `tabBarStyle: { display: 'none' }` in screen options.

### Auth and onboarding guards

```
Root _layout.tsx
  ↓ checks uiStore.externalUrl
  → null (first launch) → redirect to /(auth)/onboarding
  → set → proceed

(app)/_layout.tsx
  ↓ checks uiStore.token
  → null → redirect to /(auth)/login
  → set → render tab bar + outlet
```

First-run sequence: onboarding → login → app. No per-screen auth checks.

### Deep links

Expo Router handles deep links via the `scheme` in `app.json`. The share link route (`baskety://share/:token`) resolves outside `(app)` — no auth required. The token is read from the URL **path** and the read-only view is fetched from the dedicated unauthenticated backend endpoint `GET /api/v1/share/:token/inventory` (see the Go backend spec, Section 5); no session is created.

---

## Section 7: Network-Aware URL Switching

Self-hosted users often access their server via a local IP on home WiFi and a public URL (proxy, Tailscale magic DNS, etc.) elsewhere. The app detects the current WiFi SSID and selects the appropriate server URL automatically.

### useServerUrl hook

Lives in `apps/mobile/shared/hooks/useServerUrl.ts`. Not in `@baskety/core` — depends on `@react-native-community/netinfo`, a React Native library.

```
useNetInfo() → { ssid, type }

if type === 'wifi' && ssid:
  match ssid against uiStore.networkProfiles
  → found: return profile.serverUrl
  → not found: return uiStore.externalUrl
else (mobile data, no connection):
  return uiStore.externalUrl
```

Subscribes to network change events — switches URL automatically when the user leaves home WiFi mid-session. The API client in `@baskety/core` reads the return value of `useServerUrl` on every request.

### Onboarding flow

- **Step 1 (required):** Enter external URL. Connectivity validated before proceeding.
- **Step 2 (optional):** "Add your home network for automatic switching?" — enter a label, SSID (auto-detected if permission granted), and local URL.

### Settings — Network screen

`(app)/settings/network.tsx` — manage the full list of network profiles:
- View and edit existing profiles
- Add a new profile (SSID + local URL)
- Edit the external fallback URL
- Current SSID shown for reference

### Android permission caveat

Reading the WiFi SSID on Android 9+ requires `ACCESS_FINE_LOCATION`. If denied, `useServerUrl` always returns `externalUrl`. The Network settings screen explains why the permission is needed and prompts again if previously declined.

---

## Section 8: Offline Strategy

The grocery list is the only offline-first flow. All other features require a live connection.

### Query persistence

```ts
persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  dehydrateOptions: {
    shouldDehydrateQuery: (q) => q.queryKey[0] === 'grocery'
  }
})
```

Only grocery list queries are persisted to AsyncStorage. Receipt, report, and settings data is not — stale data there causes confusion, not convenience.

Collection queries (grocery lists, catalog entries/stores/transactions, inventory items) use the backend's cursor pagination (`?limit=&cursor=` → `{ "data": [...], "next_cursor": "..." }`, see the Go backend spec) via TanStack Query's `useInfiniteQuery`; `next_cursor === null` marks the final page.

### Offline mutation queuing

Grocery list item mutations use `networkMode: 'offlineFirst'`. When offline, TanStack Query queues mutations in memory. `useOfflineSync` listens to NetInfo and calls `queryClient.resumePausedMutations()` when connectivity returns.

### Shopping trip flow

1. **Online** — user opens list, data loads fresh and is written to AsyncStorage.
2. **Enters store** — signal lost.
3. **Offline** — cached list renders from AsyncStorage; `shoppingTripStore` reflects checked state.
4. **Checks off items** — mutations queue via `networkMode: 'offlineFirst'`; `shoppingTripStore` reflects changes immediately (AsyncStorage-persisted, survives app close).
5. **Back online** — `useOfflineSync` detects connectivity → resumes queued mutations → server syncs.

**App close during a trip:** `shoppingTripStore` survives a full restart via AsyncStorage persistence. Queued TanStack Query mutations do not survive app close — they are re-sent when the user next interacts with the list or completes the trip.

### Everything else — online only

Inventory edits, receipt scanning, household management, and statistics require a live connection. A standard "no connection" error state is shown — no queuing, no optimistic UI beyond TanStack Query defaults.

---

## Section 9: Receipt Scanning

The backend pipeline (`uploading → ocr_processing → llm_processing → pending_review → committed`) is unchanged. Mobile provides a better capture surface.

### useCamera hook

`apps/mobile/shared/hooks/useCamera.ts` — wraps two Expo APIs:

- **expo-camera** — inline viewfinder for live capture.
- **expo-image-picker** — file picker for an existing gallery photo.

Both return a local URI. The hook exposes `{ uri, requestPermission, status }`. Permissions are requested on first use with graceful fallback if denied.

### Upload

```ts
const form = new FormData()
form.append('image', {
  uri: localUri,
  name: 'receipt.jpg',
  type: 'image/jpeg',
})
await request('/receipts/scans', { method: 'POST', body: form })
// Body is FormData, so the shared client (Section 3) skips setting Content-Type —
// fetch sets the multipart boundary automatically. Auth + X-Household-ID are still attached.
```

`POST /receipts/scans` already accepts `multipart/form-data`. The shared `request()` in `@baskety/core/api/client.ts` only sets `Content-Type: application/json` for non-`FormData` bodies, so this upload works unchanged. No backend changes required.

### Polling during processing

After upload, the app navigates to the receipt index and polls `GET /receipts/scans/:scanId` via TanStack Query `refetchInterval`. When status reaches `pending_review`, polling stops and a notification badge appears on the Receipts tab.

### Review and commit

The review screen mirrors the web — each line item can be accepted, rejected, or corrected. `receiptReviewStore` holds draft state. The screen is full-screen with the tab bar hidden. On commit, the store is cleared and the user is returned to the Receipts index.

### Permissions

| Permission | Purpose |
|---|---|
| `CAMERA` | Live receipt capture. Graceful fallback to gallery picker if denied. |
| `MEDIA_LIBRARY` | Gallery photo picker. |
| `ACCESS_FINE_LOCATION` | WiFi SSID detection (network switching). Unrelated to scanning. |

---

## Section 10: Build & Deployment

### Distribution paths

**APK sideloading (default for self-hosters)**

```bash
eas build -p android --profile release
```

Returns a signed APK. Self-hoster enables "Install from unknown sources" and installs directly. No Play Store account required.

**Local build (no Expo cloud)**

```bash
eas build --local -p android
```

Requires Android SDK + JDK locally. Same pipeline, runs on-machine. For users who prefer not to upload source to Expo's servers.

**Play Store (future)**

When Play Store distribution is desired, change `buildType` in `eas.json` from `"apk"` to `"app-bundle"`. EAS Build already supports AAB output. A consistent signing key and a Play Store developer account are the only additional requirements — no architectural changes needed.

### eas.json

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "release": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### Development workflow

`pnpm --filter mobile start` launches Expo's dev server. Developers use Expo Go or a development build on a physical device or emulator. The mobile dev server connects directly to the Go backend via the onboarding URL — no Vite proxy needed.

### OTA updates — opt-in

Expo's EAS Update mechanism can push JS bundle changes without a new APK. Useful for self-hosters who don't want to rebuild and reinstall for every release. Native changes (new permissions, Expo SDK upgrades) still require a full APK build. OTA is not configured by default — self-hosters opt in by setting `updates.url` in `app.json`.

---

## Section 11: Testing Strategy

### Store tests — Jest

The three Zustand stores in `@baskety/core` are pure functions — tested without React or a device. The same test files are valid for both web and mobile since the stores are platform-agnostic.

```
packages/core/src/stores/
  shoppingTripStore.test.ts
  receiptReviewStore.test.ts
  uiStore.test.ts
```

### Component tests — Jest + React Native Testing Library

RNTL renders components in a JS environment — no device, no emulator required. MSW intercepts `fetch` at the network level (same as web). Each feature has colocated test files.

```
features/grocery/ShoppingTripView.test.tsx
features/receipt/ReviewScreen.test.tsx
features/inventory/ItemDetail.test.tsx
```

### Hook tests — Jest + RNTL

Mobile-only hooks tested with `renderHook`. NetInfo and Expo modules are mocked — hook logic is under test, not the native APIs.

```
shared/hooks/useServerUrl.test.ts
shared/hooks/useOfflineSync.test.ts
shared/hooks/useCamera.test.ts
```

### packages/ui — dual test targets

Each primitive has two implementations. `Button.web.tsx` is tested with Vitest + RTL; `Button.native.tsx` is tested with Jest + RNTL. Both are tested against the shared prop interface in `index.ts`.

### CI pipeline

```
# packages/core + packages/ui
pnpm typecheck
pnpm lint
pnpm test        # Jest (stores + ui native side)
pnpm test:web    # Vitest (ui web side)

# apps/mobile
pnpm typecheck
pnpm lint
pnpm test        # Jest + RNTL
# (no build step — EAS Build runs separately)
```

### Out of scope

End-to-end tests (Detox, Maestro) against a real device or emulator. These belong to a separate suite run against a deployed environment, consistent with the backend and web frontend specs.
