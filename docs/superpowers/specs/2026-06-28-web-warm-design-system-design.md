# Web Warm Design System

**Date:** 2026-06-28
**Status:** Approved (design phase)
**Source design:** `Baskety.dc.html` (Claude Design canvas, imported)

## Summary

Apply the warm cream / espresso visual language from the imported `Baskety.dc.html`
design canvas to the **existing, functional** web app (`apps/web`). The web app is
already built on TanStack Router with real API-wired pages (inventory, grocery,
receipts, settings, auth, share, reports) and is currently styled with the default
shadcn neutral-gray theme.

This is a **re-skin, not a rebuild**: we adopt the design's full visual system
(palette, typography, light/dark, nav/table/card/check-circle patterns) and match
the mock's per-screen layouts, while **preserving all existing functionality** that
the mock simplifies away (inventory setup wizard + batch editing, receipt OCR
review/commit flow, grocery shopping-trip flow, LLM/OCR/network settings).

## Decisions (locked)

1. **Faithfulness:** Adopt the design's visual language and match its layouts, but
   keep every existing feature. Where the mock is simpler than reality, the styling
   wins but the feature stays.
2. **Fonts:** Self-host Lora + DM Sans via `@fontsource` (OFL 1.1, redistribution
   permitted; keep license files, add attribution). No Google CDN dependency —
   honors the self-hosted/offline ethos.
3. **Token strategy (Approach A):** Remap the existing shadcn semantic tokens to the
   warm palette and add a small set of design-specific tokens. Every existing
   component that already consumes shadcn tokens shifts to the warm look with no
   per-component edits; bespoke layouts layer on top.

## Non-goals (YAGNI)

- No backend changes, no new API endpoints, no new routes.
- No refactors beyond what the re-skin touches.
- No overhaul of `packages/ui` — web pages style with Tailwind directly (the
  `@baskety/ui` web components are bare and used mainly by mobile).
- No bespoke layout work for login/register/share/reports — they inherit tokens.

## 1. Design tokens

Source of truth = the mock palette. Convert each hex to an HSL triplet (shadcn
stores tokens as `H S% L%` consumed via `hsl(var(--token))`) and **overwrite** the
existing shadcn tokens in `apps/web/src/styles/globals.css`, for both `:root`
(light) and `.dark`.

| shadcn token | light | dark |
|---|---|---|
| `--background` | `#fdf6ec` | `#17100a` |
| `--card` / `--popover` | `#fffcf5` | `#221409` |
| `--secondary` / `--muted` | `#f0e4ce` | `#2c1c0d` |
| `--border` / `--input` | `#dfc9a0` | `#4a3020` |
| `--primary` / `--ring` | `#c97d3a` | `#e8a050` |
| `--primary-foreground` | `#ffffff` | `#17100a` |
| `--foreground` | `#2d1a0e` | `#f0e0c8` |
| `--secondary-foreground` (text-2) | `#7a5c3a` | `#c8a878` |
| `--muted-foreground` (text-3) | `#b08060` | `#907060` |
| `--accent` | `#f0e4ce` | `#2c1c0d` |
| `--accent-foreground` | `#2d1a0e` | `#f0e0c8` |
| `--card-foreground` / `--popover-foreground` | `#2d1a0e` | `#f0e0c8` |
| `--destructive` | `#c04030` | `#e06050` |
| `--destructive-foreground` | `#ffffff` | `#f0e0c8` |

`--radius` stays `0.5rem`; larger radii (12–14px cards) use explicit `rounded-xl` /
`rounded-2xl` where the mock calls for them.

**New tokens** (shadcn has no equivalent), exposed through `tailwind.config.ts`
`colors` as `ok` / `warn` / `danger` / `primary-soft`, plus `text-2` / `text-3`
aliases:

| new token | light | dark | used by |
|---|---|---|---|
| `--ok` | `#5a8a50` | `#6aaa5a` | full stock bar, "Completed" status |
| `--warn` | `#c8902a` | `#e8a830` | mid (≥50%) stock bar |
| `--danger` | `#c04030` | `#e06050` | low (<50%) stock bar |
| `--primary-soft` | `rgba(201,125,58,.1)` | `rgba(232,160,80,.13)` | tag pills, icon chips, row hover |
| `--text-2` | = `--secondary-foreground` | | secondary text |
| `--text-3` | = `--muted-foreground` | | captions |

`--shadow` token (warm low-alpha: `0 1px 4px rgba(80,40,10,.08)` light /
`0 1px 4px rgba(0,0,0,.32)` dark) surfaced as a `shadow-soft` Tailwind utility.

Note: `--primary-soft` is an `rgba()` (not an HSL triplet), so it is consumed
directly as `var(--primary-soft)` rather than wrapped in `hsl()`. Its Tailwind
color entry uses the raw var.

## 2. Fonts

- Add `@fontsource/lora` and `@fontsource/dm-sans` dependencies; import the needed
  weights once in `apps/web/src/main.tsx`.
- `tailwind.config.ts` `fontFamily`: `sans → ['DM Sans', sans-serif]`,
  `serif → ['Lora', serif]`. Body defaults to `sans`; headings use `font-serif`.
- Add an OFL 1.1 attribution line for both fonts to `README.md`. `@fontsource`
  ships each font's `LICENSE` in `node_modules`, satisfying the OFL "keep the
  license" obligation.

## 3. Theme toggle + persistence

- Extend the existing persisted `uiStore` (`packages/core/src/stores/uiStore.ts`):
  add `theme: 'light' | 'dark'` (default `'light'`), `setTheme(t)` and
  `toggleTheme()` actions, and include `theme` in `partialize` so it persists in the
  existing `baskety-ui` localStorage key.
- The app already uses `darkMode: ["class"]`. A root-level effect keeps
  `document.documentElement.classList` in sync with `theme`.
- Flash-of-wrong-theme avoidance: a tiny synchronous snippet in `main.tsx` reads the
  persisted `baskety-ui` value from `localStorage` and applies/removes the `dark`
  class **before** React renders.
- One source of truth, two drivers: the nav toggle button (☾/☀︎) and the
  Settings → Appearance light/dark cards both call the same store actions.

## 4. Navigation (`apps/web/src/routes/_app.tsx`)

Restyle `AppLayout` in place; preserve all logic (`Link`s + active state,
`HouseholdSwitcher`, logout mutation):

- Sticky 56px bar on `--card`, bottom border, `shadow-soft`.
- Basket SVG logo + Lora "Baskety" wordmark (links to inventory).
- Nav links: inactive `text-2`; active = primary color with a 2.5px primary bottom
  border (driven by TanStack Router `activeProps`).
- Right cluster: `ThemeToggle`, household switcher restyled as a `secondary` pill
  with ▾ chevron (existing dropdown logic kept), logout as an outline button.

## 5. Per-screen restyle (logic preserved, layout matched)

**Inventory** (`features/inventory/InventoryPage.tsx`, `InventoryTable.tsx`):
grouped-by-category table — header row (Item / Stock / Stored / Target), category
section dividers, item rows with expand control (▸/▾ when batches exist, status dot
otherwise), name, **`StockBar`** colored by `stored/target` ratio, stored & target
labels, trash button. Expanded rows reveal batch sub-rows (label + expiry). Search
box + category `<select>` filter, "New Category" button, per-category "Add item to
{cat}" row. All current CRUD, `SetupWizard`, and batch editing preserved.

**Grocery index** (`features/grocery/GroceryPage.tsx`): responsive card grid; each
card = Auto/Manual `Tag` pill + date + Lora name + item count, clickable to detail.
"New list" button. Existing data/actions preserved.

**Grocery detail** (`features/grocery/GroceryListPage.tsx`): back link, title + date,
Add-item / Complete-list buttons, progress bar (done/total), **Pending** list with
`CheckCircle`s, **Collected** list (dimmed + strikethrough). Toggle drives the
existing check/uncheck mutation; shopping-trip entry preserved.

**Receipts** (`features/receipt/ReceiptPage.tsx`): rows with a receipt-icon chip,
store, `date · N items`, total, status badge. The OCR **review/commit** flow
(`ReceiptReviewPage.tsx`) stays reachable and is restyled to match.

**Settings** (`features/settings/SettingsPage.tsx`): Household-name card, Appearance
theme cards (drive the theme store), Categories card — all as `--card` panels. The
**existing** LLM/OCR provider + network-profile settings remain, restyled as
additional cards (the mock simply omits them).

**Login / Register / Share / Reports**: inherit the warm tokens automatically.
Light touch-ups on auth (Lora heading, primary button) for consistency. Reports'
recharts series may reuse existing chart tokens; no bespoke work.

## 6. New presentational components (`apps/web/src/components/`)

Pure, reusable, independently testable:

- `StockBar` — props `{ stored, target }`; renders the ratio bar; uses the shared
  stock-ratio→color helper.
- `CheckCircle` — props `{ checked }`; circular check used in grocery detail.
- `Tag` / `Pill` — small label pill (Auto/Manual, etc.).
- `PageHeader` — Lora title + subtitle + optional action slot.
- `ThemeToggle` — reads/sets the `uiStore` theme.
- `icons.tsx` — the mock's inline SVGs (basket logo, search, trash, receipt, check).
- `lib/stock.ts` — `stockRatioColor(stored, target)` returning a status token + width
  (ports the mock's `si()` logic); pure and unit-tested.

## 7. Error handling

No new error surfaces — existing query/mutation error handling is unchanged. Re-skin
preserves current loading/empty/error states, restyled to warm tokens. Theme
bootstrap snippet is wrapped in try/catch so a malformed/absent `localStorage` value
falls back to light without throwing.

## 8. Testing

- Keep all existing vitest + Playwright tests green. They assert behavior/text rather
  than class names; any test that incidentally breaks on markup changes is fixed in
  the same change.
- New unit tests: `stockRatioColor` (boundary ratios: 0, <0.5, ≥0.5, ≥1, zero
  target), the `theme` store reducer (`toggleTheme`/`setTheme` + persistence shape),
  and `ThemeToggle` (renders correct icon, dispatches toggle).
- Verification gate: `pnpm --filter @baskety/web typecheck`, `pnpm --filter
  @baskety/web test`, and a dev-server smoke run (load each screen in both themes).

## Implementation order (for the plan)

1. Tokens + Tailwind config + fonts (foundation; everything else depends on it).
2. Theme store + bootstrap + `ThemeToggle`.
3. Shared components + `lib/stock.ts` (+ their tests).
4. Nav restyle.
5. Inventory → Grocery (index + detail) → Receipts → Settings.
6. Auth/share/reports touch-ups.
7. Full verification (typecheck, tests, smoke in both themes).
