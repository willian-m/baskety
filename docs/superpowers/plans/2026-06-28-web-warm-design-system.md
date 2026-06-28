# Web Warm Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the existing `apps/web` app to the warm cream/espresso visual language from `Baskety.dc.html` (light + dark, Lora + DM Sans), matching the mock's per-screen layouts while preserving every existing feature.

**Architecture:** Approach A — remap the existing shadcn HSL-channel tokens to the warm palette and add two new status tokens (`--ok`, `--warn`); `--primary-soft` is achieved via the `bg-primary/10` opacity modifier and `danger` reuses `--destructive`. Self-host fonts via `@fontsource`. Add a persisted `theme` to the existing `uiStore` driving the `.dark` class. Extract a few pure presentational components, then restyle each page in place keeping all data/handlers wired.

**Tech Stack:** React 18, TanStack Router + Query, Tailwind 3 (shadcn token convention, `darkMode: ["class"]`), Vite, Zustand (persisted), Vitest + Testing Library, Playwright (e2e).

**Refinement vs spec:** The spec listed `--primary-soft` as a new token; it is implemented via the `/10` opacity utility (the HSL-channel tokens support alpha), and `danger` maps to the existing `--destructive`. Net new CSS tokens: `--ok`, `--warn`, `--shadow`. Everything else in the spec is unchanged.

**Working branch:** `web-warm-design-system` (already checked out; the spec is already committed there).

**Verification commands (used throughout):**
- Typecheck: `pnpm --filter @baskety/web typecheck`
- Unit tests: `pnpm --filter @baskety/web test`
- Core tests (theme store): `pnpm --filter @baskety/core test`
- Dev smoke: `pnpm --filter @baskety/web dev` then load each screen in both themes.

---

## Phase 0 — Foundation: tokens, Tailwind, fonts

### Task 0.1: Self-host fonts (dependencies + import)

**Files:**
- Modify: `apps/web/package.json` (dependencies)
- Modify: `apps/web/src/main.tsx`
- Modify: `README.md` (attribution)

- [ ] **Step 1: Add font dependencies**

Run (from repo root):

```bash
pnpm --filter @baskety/web add @fontsource/lora @fontsource/dm-sans
```

Expected: both packages added to `apps/web/package.json` `dependencies`, lockfile updated.

- [ ] **Step 2: Import the needed weights in `main.tsx`**

Add these imports near the top of `apps/web/src/main.tsx`, immediately above `import "./styles/globals.css";`:

```ts
// Self-hosted fonts (OFL 1.1) — see README attribution.
import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/500.css";
import "@fontsource/lora/600.css";
import "@fontsource/lora/400-italic.css";
```

- [ ] **Step 3: Add OFL attribution to README**

Append this section to the end of `README.md`:

```markdown
## Fonts

Baskety bundles the following fonts, both licensed under the SIL Open Font
License 1.1:

- **Lora** © Cyreal — https://github.com/cyrealtype/Lora-Cyrillic
- **DM Sans** © Colophon Foundry, Jonny Pinhorn — https://github.com/googlefonts/dm-fonts

The full license text ships with each font in `node_modules/@fontsource/*/LICENSE`.
```

- [ ] **Step 4: Verify install + typecheck**

Run: `pnpm --filter @baskety/web typecheck`
Expected: PASS (no type errors; `.css` imports are side-effect imports).

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/main.tsx README.md
git commit -m "feat(web): self-host Lora + DM Sans via @fontsource"
```

---

### Task 0.2: Warm color tokens in `globals.css`

**Files:**
- Modify: `apps/web/src/styles/globals.css`

The mock's hex palette converted to shadcn HSL channels (`H S% L%`). Replace the
entire `:root` and `.dark` blocks. Keep the existing `--chart-*` and `--radius`
lines unchanged (reports/recharts depend on them). Add `--ok`, `--warn`, `--shadow`.

- [ ] **Step 1: Replace the `:root` block**

In `apps/web/src/styles/globals.css`, replace the `:root { ... }` block inside
`@layer base` with:

```css
:root {
  --background: 35 81% 96%;          /* #fdf6ec */
  --foreground: 23 53% 12%;          /* #2d1a0e */
  --card: 42 100% 98%;               /* #fffcf5 */
  --card-foreground: 23 53% 12%;
  --popover: 42 100% 98%;
  --popover-foreground: 23 53% 12%;
  --primary: 28 57% 51%;             /* #c97d3a */
  --primary-foreground: 0 0% 100%;
  --secondary: 39 53% 87%;           /* #f0e4ce */
  --secondary-foreground: 32 36% 35%;/* #7a5c3a (text-2) */
  --muted: 39 53% 87%;
  --muted-foreground: 24 34% 53%;    /* #b08060 (text-3) */
  --accent: 39 53% 87%;
  --accent-foreground: 23 53% 12%;
  --destructive: 7 60% 47%;          /* #c04030 */
  --destructive-foreground: 0 0% 100%;
  --border: 39 50% 75%;              /* #dfc9a0 */
  --input: 39 50% 75%;
  --ring: 28 57% 51%;
  --ok: 110 27% 43%;                 /* #5a8a50 */
  --warn: 39 65% 47%;                /* #c8902a */
  --radius: 0.5rem;
  --shadow: 0 1px 4px rgba(80, 40, 10, 0.08);
  --chart-1: 12 76% 61%;
  --chart-2: 173 58% 39%;
  --chart-3: 197 37% 24%;
  --chart-4: 43 74% 66%;
  --chart-5: 27 87% 67%;
}
```

- [ ] **Step 2: Replace the `.dark` block**

Replace the `.dark { ... }` block with:

```css
.dark {
  --background: 28 39% 6%;           /* #17100a */
  --foreground: 36 57% 86%;          /* #f0e0c8 */
  --card: 26 58% 8%;                 /* #221409 */
  --card-foreground: 36 57% 86%;
  --popover: 26 58% 8%;
  --popover-foreground: 36 57% 86%;
  --primary: 32 77% 61%;             /* #e8a050 */
  --primary-foreground: 28 39% 6%;
  --secondary: 29 54% 11%;           /* #2c1c0d */
  --secondary-foreground: 36 42% 63%;/* #c8a878 (text-2) */
  --muted: 29 54% 11%;
  --muted-foreground: 20 20% 47%;    /* #907060 (text-3) */
  --accent: 29 54% 11%;
  --accent-foreground: 36 57% 86%;
  --destructive: 7 70% 60%;          /* #e06050 */
  --destructive-foreground: 36 57% 86%;
  --border: 23 40% 21%;              /* #4a3020 */
  --input: 23 40% 21%;
  --ring: 32 77% 61%;
  --ok: 108 32% 51%;                 /* #6aaa5a */
  --warn: 39 80% 55%;                /* #e8a830 */
  --shadow: 0 1px 4px rgba(0, 0, 0, 0.32);
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
}
```

- [ ] **Step 3: Add base typography defaults**

Replace the final `@layer base { * {...} body {...} }` block with:

```css
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: "DM Sans", system-ui, sans-serif;
  }
  h1, h2, h3 {
    font-family: "Lora", Georgia, serif;
  }
}
```

- [ ] **Step 4: Typecheck (CSS has no test; confirm build parses)**

Run: `pnpm --filter @baskety/web typecheck`
Expected: PASS (CSS is not typechecked, but this confirms nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/styles/globals.css
git commit -m "feat(web): warm cream/espresso color tokens (light + dark)"
```

---

### Task 0.3: Tailwind config — fonts, status colors, soft shadow

**Files:**
- Modify: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Extend `theme.extend` with fonts, colors, shadow**

In `apps/web/tailwind.config.ts`, add these keys inside `theme.extend` (alongside
the existing `borderRadius` and `colors`):

```ts
fontFamily: {
  sans: ['"DM Sans"', "system-ui", "sans-serif"],
  serif: ['"Lora"', "Georgia", "serif"],
},
boxShadow: {
  soft: "var(--shadow)",
},
```

Then add these entries inside the existing `colors` object (next to `border`,
`input`, `ring`):

```ts
ok: "hsl(var(--ok))",
warn: "hsl(var(--warn))",
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @baskety/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tailwind.config.ts
git commit -m "feat(web): tailwind fonts, ok/warn colors, shadow-soft"
```

---

## Phase 1 — Theme state + toggle

### Task 1.1: Add persisted `theme` to `uiStore`

**Files:**
- Modify: `packages/core/src/stores/uiStore.ts`
- Test: `packages/core/src/stores/uiStore.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/stores/uiStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "./uiStore.js";

describe("uiStore theme", () => {
  beforeEach(() => {
    useUiStore.setState({ theme: "light" });
  });

  it("defaults to light", () => {
    expect(useUiStore.getState().theme).toBe("light");
  });

  it("toggleTheme flips light <-> dark", () => {
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe("dark");
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe("light");
  });

  it("setTheme sets explicitly", () => {
    useUiStore.getState().setTheme("dark");
    expect(useUiStore.getState().theme).toBe("dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @baskety/core test -- uiStore.test`
Expected: FAIL (`theme` / `toggleTheme` / `setTheme` undefined).

- [ ] **Step 3: Implement in `uiStore.ts`**

Add to the `UiState` interface:

```ts
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
```

Add to the store initializer object (next to the other defaults/actions):

```ts
      theme: "light",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
```

Add `theme` to the `partialize` return object:

```ts
        theme: state.theme,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @baskety/core test -- uiStore.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/stores/uiStore.ts packages/core/src/stores/uiStore.test.ts
git commit -m "feat(core): persisted light/dark theme in uiStore"
```

---

### Task 1.2: Apply theme class + flash-free bootstrap

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/routes/__root.tsx`

- [ ] **Step 1: Add the synchronous bootstrap to `main.tsx`**

In `apps/web/src/main.tsx`, immediately after the imports and before
`const queryClient = ...`, add:

```ts
// Apply persisted theme before first paint to avoid a flash of the wrong theme.
// Reads the same localStorage key the uiStore persists under ("baskety-ui").
try {
  const raw = localStorage.getItem("baskety-ui");
  const theme = raw ? (JSON.parse(raw)?.state?.theme as string | undefined) : undefined;
  document.documentElement.classList.toggle("dark", theme === "dark");
} catch {
  // Malformed/absent storage -> stay on light (no class).
}
```

- [ ] **Step 2: Keep the class in sync with the store in `__root.tsx`**

Replace the contents of `apps/web/src/routes/__root.tsx` with:

```tsx
import { useUiStore } from "@baskety/core";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

function Root() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return <Outlet />;
}

export const Route = createRootRoute({
  component: Root,
});
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @baskety/web typecheck`
Expected: PASS.

- [ ] **Step 4: Verify existing tests still pass**

Run: `pnpm --filter @baskety/web test`
Expected: PASS (no regressions; smoke test renders root).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/main.tsx apps/web/src/routes/__root.tsx
git commit -m "feat(web): apply persisted theme class (flash-free)"
```

---

### Task 1.3: `ThemeToggle` component

**Files:**
- Create: `apps/web/src/components/ThemeToggle.tsx`
- Test: `apps/web/src/components/ThemeToggle.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/ThemeToggle.test.tsx`:

```tsx
import { useUiStore } from "@baskety/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "./ThemeToggle.js";

describe("ThemeToggle", () => {
  beforeEach(() => useUiStore.setState({ theme: "light" }));

  it("shows the moon in light mode and toggles to dark", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /toggle theme/i });
    expect(btn).toHaveTextContent("☾");
    fireEvent.click(btn);
    expect(useUiStore.getState().theme).toBe("dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @baskety/web test -- ThemeToggle`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `ThemeToggle.tsx`**

```tsx
import { useUiStore } from "@baskety/core";

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title="Toggle theme"
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border bg-secondary text-[15px] text-secondary-foreground hover:bg-secondary/80"
    >
      {theme === "dark" ? "☀︎" : "☾"}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @baskety/web test -- ThemeToggle`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ThemeToggle.tsx apps/web/src/components/ThemeToggle.test.tsx
git commit -m "feat(web): ThemeToggle component"
```

---

## Phase 2 — Shared presentational pieces

### Task 2.1: `stockRatioColor` helper

**Files:**
- Create: `apps/web/src/lib/stock.ts`
- Test: `apps/web/src/lib/stock.test.ts`

Ports the mock's `si()` logic. Returns a Tailwind background class + width %.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/stock.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { stockRatioColor } from "./stock.js";

describe("stockRatioColor", () => {
  it("no target -> muted, 0 width", () => {
    expect(stockRatioColor(5, 0)).toEqual({ className: "bg-muted-foreground", width: "0%" });
  });
  it("at or above target -> ok, full", () => {
    expect(stockRatioColor(2, 2)).toEqual({ className: "bg-ok", width: "100%" });
    expect(stockRatioColor(5, 2)).toEqual({ className: "bg-ok", width: "100%" });
  });
  it("half or more -> warn, proportional", () => {
    expect(stockRatioColor(1, 2)).toEqual({ className: "bg-warn", width: "50%" });
  });
  it("below half but positive -> danger, proportional", () => {
    expect(stockRatioColor(0.5, 2)).toEqual({ className: "bg-destructive", width: "25%" });
  });
  it("zero stock with target -> danger, sliver", () => {
    expect(stockRatioColor(0, 3)).toEqual({ className: "bg-destructive", width: "3%" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @baskety/web test -- stock.test`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `stock.ts`**

```ts
export type StockBarStyle = { className: string; width: string };

/** Mirrors the design canvas `si()` logic: pick a status color + bar width. */
export function stockRatioColor(stored: number, target: number): StockBarStyle {
  if (!target) return { className: "bg-muted-foreground", width: "0%" };
  const ratio = stored / target;
  if (ratio >= 1) return { className: "bg-ok", width: "100%" };
  if (ratio >= 0.5) return { className: "bg-warn", width: `${Math.round(ratio * 100)}%` };
  if (ratio > 0) return { className: "bg-destructive", width: `${Math.round(ratio * 100)}%` };
  return { className: "bg-destructive", width: "3%" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @baskety/web test -- stock.test`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/stock.ts apps/web/src/lib/stock.test.ts
git commit -m "feat(web): stockRatioColor helper"
```

---

### Task 2.2: Presentational components (`StockBar`, `CheckCircle`, `Tag`, `PageHeader`) + icons

**Files:**
- Create: `apps/web/src/components/StockBar.tsx`
- Create: `apps/web/src/components/CheckCircle.tsx`
- Create: `apps/web/src/components/Tag.tsx`
- Create: `apps/web/src/components/PageHeader.tsx`
- Create: `apps/web/src/components/icons.tsx`
- Test: `apps/web/src/components/StockBar.test.tsx`

These are pure/presentational. Only `StockBar` gets a unit test (it has logic via
the helper); the others are trivial and verified by typecheck + page usage.

- [ ] **Step 1: Write the failing test for `StockBar`**

Create `apps/web/src/components/StockBar.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StockBar } from "./StockBar.js";

describe("StockBar", () => {
  it("renders a fill at the computed width and color", () => {
    const { container } = render(<StockBar stored={1} target={2} />);
    const fill = container.querySelector("[data-testid='stock-fill']") as HTMLElement;
    expect(fill).toBeTruthy();
    expect(fill.style.width).toBe("50%");
    expect(fill.className).toContain("bg-warn");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @baskety/web test -- StockBar`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the components**

`apps/web/src/components/StockBar.tsx`:

```tsx
import { stockRatioColor } from "../lib/stock.js";

type Props = { stored: number; target: number };

export function StockBar({ stored, target }: Props) {
  const { className, width } = stockRatioColor(stored, target);
  return (
    <div className="h-[5px] overflow-hidden rounded-[3px] bg-secondary">
      <div data-testid="stock-fill" className={`h-full rounded-[3px] ${className}`} style={{ width }} />
    </div>
  );
}
```

`apps/web/src/components/CheckCircle.tsx`:

```tsx
type Props = { checked: boolean };

export function CheckCircle({ checked }: Props) {
  return (
    <div
      className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2 ${
        checked ? "border-primary bg-primary" : "border-border bg-transparent"
      }`}
    >
      {checked && <span className="text-[11px] font-bold leading-none text-primary-foreground">✓</span>}
    </div>
  );
}
```

`apps/web/src/components/Tag.tsx`:

```tsx
import type { ReactNode } from "react";

type Props = { children: ReactNode };

export function Tag({ children }: Props) {
  return (
    <span className="rounded-full bg-primary/10 px-[9px] py-[3px] text-[10px] font-bold uppercase tracking-wider text-primary">
      {children}
    </span>
  );
}
```

`apps/web/src/components/PageHeader.tsx`:

```tsx
import type { ReactNode } from "react";

type Props = { title: string; subtitle?: string; action?: ReactNode };

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
```

`apps/web/src/components/icons.tsx` (ports the mock's inline SVGs):

```tsx
export function BasketLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path d="M9 12C9 12 9.5 6 13 6C16.5 6 17 12 17 12" stroke="hsl(var(--primary))" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 12h18l-1.8 11.5H5.8L4 12z" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="10" y1="14" x2="9.3" y2="22" stroke="hsl(var(--secondary-foreground))" strokeWidth="0.8" opacity="0.6" />
      <line x1="13" y1="14" x2="13" y2="23" stroke="hsl(var(--secondary-foreground))" strokeWidth="0.8" opacity="0.6" />
      <line x1="16" y1="14" x2="16.7" y2="22" stroke="hsl(var(--secondary-foreground))" strokeWidth="0.8" opacity="0.6" />
    </svg>
  );
}

export function ReceiptIcon() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="16" height="20" rx="2" stroke="hsl(var(--primary))" strokeWidth="1.4" />
      <line x1="4" y1="6.5" x2="14" y2="6.5" stroke="hsl(var(--primary))" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
      <line x1="4" y1="10" x2="14" y2="10" stroke="hsl(var(--primary))" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
      <line x1="4" y1="13.5" x2="10" y2="13.5" stroke="hsl(var(--primary))" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="4" stroke="hsl(var(--muted-foreground))" strokeWidth="1.3" />
      <line x1="9" y1="9" x2="12" y2="12" stroke="hsl(var(--muted-foreground))" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm --filter @baskety/web test -- StockBar` → Expected: PASS.
Run: `pnpm --filter @baskety/web typecheck` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/
git commit -m "feat(web): StockBar, CheckCircle, Tag, PageHeader, icons"
```

---

## Phase 3 — Navigation

### Task 3.1: Restyle the app nav (`_app.tsx`)

**Files:**
- Modify: `apps/web/src/routes/_app.tsx`

Keep ALL logic: `HouseholdSwitcher` (dropdown + invalidate), `handleLogout`,
`beforeLoad` redirect, the four `Link`s with `activeProps`. Only restyle markup
and add `ThemeToggle` + the basket logo.

- [ ] **Step 1: Update imports**

Add to the top of `apps/web/src/routes/_app.tsx`:

```tsx
import { BasketLogo } from "../components/icons.js";
import { ThemeToggle } from "../components/ThemeToggle.js";
```

- [ ] **Step 2: Restyle `HouseholdSwitcher`'s trigger button**

Replace the trigger `<button>` (the one rendering `{current.name} ▾`) className with:

```tsx
className="flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-secondary px-3.5 text-[13px] text-secondary-foreground hover:bg-secondary/80"
```

and change its label markup to:

```tsx
{current.name} <span className="text-[9px] text-muted-foreground">▾</span>
```

Leave the dropdown panel and its mapped buttons as-is (they already use
`border/bg-background/hover:bg-muted` tokens).

- [ ] **Step 3: Replace the `<nav>` in `AppLayout`**

Replace the entire `<nav>...</nav>` element with:

```tsx
<nav className="sticky top-0 z-50 flex h-14 items-center border-b border-border bg-card px-8 shadow-soft">
  <Link to="/inventory" className="mr-9 flex flex-shrink-0 items-center gap-2.5">
    <BasketLogo />
    <span className="font-serif text-xl font-semibold tracking-tight">Baskety</span>
  </Link>
  <div className="flex h-full items-stretch">
    {[
      { to: "/inventory", label: "Inventory" },
      { to: "/grocery", label: "Grocery" },
      { to: "/receipt", label: "Receipts" },
      { to: "/settings", label: "Settings" },
    ].map((item) => (
      <Link
        key={item.to}
        to={item.to}
        className="flex items-center border-b-[2.5px] border-t-[2.5px] border-transparent px-4 text-sm text-secondary-foreground hover:text-foreground"
        activeProps={{ className: "border-b-primary font-semibold text-primary" }}
      >
        {item.label}
      </Link>
    ))}
  </div>
  <div className="flex-1" />
  <div className="flex items-center gap-2">
    <ThemeToggle />
    <HouseholdSwitcher />
    <button
      type="button"
      data-testid="logout-button"
      onClick={() => void handleLogout()}
      disabled={logout.isPending}
      className="h-[34px] rounded-lg border border-border bg-transparent px-3 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {logout.isPending ? "Logging out…" : "Logout"}
    </button>
  </div>
</nav>
```

Note: TanStack Router's `activeProps.className` is appended, so the base classes
stay and active styles layer on. Keep the surrounding `<div className="min-h-screen">`
and `<Outlet />`.

- [ ] **Step 3b: Set the page background**

Change the wrapper from `<div className="min-h-screen">` to
`<div className="min-h-screen bg-background">`.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @baskety/web typecheck` → Expected: PASS.
Run: `pnpm --filter @baskety/web test` → Expected: PASS (logout-button testid and
nav links preserved).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/_app.tsx
git commit -m "feat(web): warm sticky nav with logo + theme toggle"
```

---

## Phase 4 — Inventory

### Task 4.1: Restyle `InventoryPage` header + search row

**Files:**
- Modify: `apps/web/src/features/inventory/InventoryPage.tsx`

Keep all state/handlers (`search`, `categoryFilter`, `newItemName`, `tableRef`,
queries, `handleNewItemSaved`, `showAddThisItem`). Only restyle the returned markup
and wrap content in the centered container.

- [ ] **Step 1: Add imports**

```tsx
import { PageHeader } from "../../components/PageHeader.js";
import { SearchIcon } from "../../components/icons.js";
```

- [ ] **Step 2: Replace the outer `return` markup**

Replace `return ( <div className="p-6"> ... </div> )` (the final return only — keep
the loading/error early returns, but restyle their wrapper text to
`text-muted-foreground` which already matches) with:

```tsx
return (
  <div className="mx-auto max-w-[1060px] px-8 pb-20 pt-8">
    <PageHeader
      title="Pantry"
      subtitle="Track your household inventory and target levels"
    />

    <div className="mb-5 flex items-center gap-2.5">
      <div className="relative max-w-[300px] flex-1">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
          <SearchIcon />
        </span>
        <input
          type="search"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border-[1.5px] border-border bg-card px-3 py-1.5 pl-[30px] text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <select
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
        className="h-9 cursor-pointer rounded-lg border-[1.5px] border-border bg-card px-3 text-[13px] text-secondary-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {showAddThisItem && (
        <button
          type="button"
          onClick={() => setNewItemName(search.trim())}
          className="inline-flex h-9 items-center whitespace-nowrap rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Add this item
        </button>
      )}
    </div>

    {filtered.length === 0 && newItemName.trim() === "" ? (
      <p className="py-12 text-center text-muted-foreground">No items found.</p>
    ) : (
      <div ref={tableRef}>
        <InventoryTable
          inventoryId={inventoryId}
          items={filtered}
          newItemName={newItemName}
          onNewItemSaved={handleNewItemSaved}
        />
      </div>
    )}
  </div>
);
```

(The outer table border/rounded wrapper is removed; the table now owns its own
header underline per the mock.)

- [ ] **Step 3: Verify**

Run: `pnpm --filter @baskety/web test -- InventoryPage` → Expected: PASS.
Run: `pnpm --filter @baskety/web typecheck` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/inventory/InventoryPage.tsx
git commit -m "feat(web): warm inventory header + search row"
```

---

### Task 4.2: Add Stock column + warm styling to `InventoryTable`

**Files:**
- Modify: `apps/web/src/features/inventory/InventoryTable.tsx`

This is a re-skin only — DO NOT change any handler, state, query, or the editing /
batch / delete / category-rename behavior. Changes are: (a) add a "Stock" column
header + a `StockBar` cell in the read-only `ItemRow`; (b) swap hardcoded
`bg-red-*`/`text-red-*`/`bg-blue-*` for tokens (`bg-destructive`,
`text-destructive`, `bg-primary/10`/`ring-primary`); (c) warm the header/category
rows. The table keeps 4 logical columns for edit rows; the read-only row uses a
nested layout for the Stock bar so colSpans stay valid.

- [ ] **Step 1: Import StockBar**

Add at the top of `InventoryTable.tsx`:

```tsx
import { StockBar } from "../../components/StockBar.js";
```

- [ ] **Step 2: Restyle the `<thead>` row**

Replace the `<thead>`'s `<tr>` className with:

```tsx
className="border-b-2 border-border text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
```

Change the `Stored Qty` header cell text to `Stored` and the `Target Qty` to
`Target`, and insert a new header cell **before** `Stored`:

```tsx
<th className="w-24 px-2 py-2 text-center">Stock</th>
```

(Leave the checkbox `<th className="w-16 ...">` and the `Item` `<th>` as-is, but
update their padding to match: keep existing.)

- [ ] **Step 3: Widen edit/new/batch rows by one column**

Every non-read-only `<tr>` currently spans 4 columns via individual `<td>`s for
Item / Stored / Target, plus the leading checkbox `<td>`. Because we added a Stock
column, these rows must account for it. The simplest correct change: in the **edit
`ItemRow`**, the **`NewItemRow`**, and the **`BatchRows`** sub-rows, add a single
empty spacer cell `<td className="px-2 py-1" />` immediately after the leading
checkbox/indent `<td>` (i.e. in the Stock column position). Concretely:

- In `ItemRow` edit branch: after `<td className="px-2 py-1" />` (the first cell),
  add another `<td className="px-2 py-1" />`.
- In `NewItemRow`: after the first `<td className="px-2 py-1" />`, add another
  `<td className="px-2 py-1" />`.
- In `BatchRows`: each batch `<tr>` and the add-batch `<tr>` begins with
  `<td className="px-2 py-1" />`; add one more empty `<td className="px-2 py-1" />`
  right after it. For rows using `colSpan={3}`, change them to `colSpan={4}` so the
  trailing content still reaches the row's end (table now has 5 columns).
- In `CategoryHeaderRow`: change `colSpan={4}` to `colSpan={5}`.
- In `InventoryTable`'s "Add item to {category}" row and the delete-modal carrier
  rows: change `colSpan={4}` to `colSpan={5}`.
- In the `failed`/error helper rows that use `colSpan={3}`: change to `colSpan={4}`.

> Implementation note: search the file for `colSpan={4}` and `colSpan={3}` and
> bump each by one, and add the spacer `<td>` in the three editable row types above.
> The read-only `ItemRow` gets a real Stock cell (next step), not a spacer.

- [ ] **Step 4: Add the Stock cell to the read-only `ItemRow`**

In the read-only `ItemRow` return (the `<tr>` with `onClick={beginEdit}`), insert a
new `<td>` between the `Item` name cell and the `Stored` cell:

```tsx
<td className="px-2 py-2">
  <StockBar stored={item.stored_quantity} target={item.target_quantity} />
</td>
```

- [ ] **Step 5: Swap hardcoded non-token colors for tokens**

Apply these replacements throughout `InventoryTable.tsx` (all are styling-only):

- `bg-red-600 ... hover:bg-red-700 ... text-white` (delete buttons) →
  `bg-destructive text-destructive-foreground hover:bg-destructive/90`
- `text-red-600` / `text-red-500` / `hover:text-red-700` / `hover:text-red-600`
  (error text + trash hovers) → `text-destructive` / `hover:text-destructive`
- The selected-row highlight `bg-blue-50 ring-1 ring-blue-300` →
  `bg-primary/10 ring-1 ring-primary/40`
- `bg-primary/5` (new item row) → keep (already a token).
- Category header row `bg-muted/40`, batch rows `bg-muted/10` → keep (tokens).

- [ ] **Step 6: Verify (this is the highest-risk task — run the full inventory suite)**

Run: `pnpm --filter @baskety/web test -- InventoryTable InventoryPage ExpiryBadge`
Expected: PASS (all existing behavior tests green).
Run: `pnpm --filter @baskety/web typecheck` → Expected: PASS.

If any test fails on column count / `colSpan`, re-check Step 3 — every row must
total 5 columns.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/inventory/InventoryTable.tsx
git commit -m "feat(web): inventory stock-bar column + warm tokens"
```

---

## Phase 5 — Grocery index (card grid)

### Task 5.1: Restyle `GroceryPage` into a card grid

**Files:**
- Modify: `apps/web/src/features/grocery/GroceryPage.tsx`

Keep all logic: `ListCard` menu (rename/archive/delete), navigation, auto-generate,
create-list, sorting. Convert the vertical list container into a responsive card
grid and restyle `ListCard` as a card. Swap the hardcoded `statusColor` map and
`text-red-600` for tokens.

- [ ] **Step 1: Add imports**

```tsx
import { PageHeader } from "../../components/PageHeader.js";
import { Tag } from "../../components/Tag.js";
```

- [ ] **Step 2: Restyle `ListCard`'s outer card**

Replace `ListCard`'s root `<div className="relative border-t first:border-t-0">`
and the inner clickable `<div ...>` with a single card:

```tsx
return (
  <div className="relative">
    <div
      className="cursor-pointer rounded-2xl border-[1.5px] border-border bg-card p-[22px] shadow-soft transition-shadow hover:shadow-md"
      onClick={() => void navigate({ to: "/grocery/$listId", params: { listId: list.id } })}
    >
      <div className="mb-3 flex items-center justify-between">
        <Tag>{list.status === "active" ? "List" : list.status}</Tag>
        <span className="text-xs text-muted-foreground">
          {new Date(list.created_at).toLocaleDateString()}
        </span>
      </div>
      {isEditing ? (
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleRename();
            if (e.key === "Escape") {
              setIsEditing(false);
              setEditName(list.name);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-7 rounded border border-input bg-background px-2 py-0.5 text-sm font-medium outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      ) : (
        <div className="mb-2 flex items-center gap-2">
          <span className="font-serif text-[17px] font-medium">{list.name}</span>
          {list.pinned_at && <span className="text-xs text-muted-foreground">📌</span>}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted-foreground">{STATUS_LABEL[list.status] ?? list.status}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="List options"
        >
          ⋯
        </button>
      </div>
    </div>
    {/* keep the existing menuOpen dropdown block unchanged below */}
  </div>
);
```

Add a small status-label map near the top of the file (module scope):

```tsx
const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};
```

Delete the now-unused `statusColor` map. In the menu dropdown, change the Delete
button's `text-red-600` to `text-destructive`.

- [ ] **Step 3: Restyle the page shell + grid**

Replace `GroceryPage`'s final `return ( <div className="p-6"> ... )` with:

```tsx
return (
  <div className="mx-auto max-w-[1060px] px-8 pb-20 pt-8">
    <PageHeader
      title="Grocery Lists"
      subtitle="Auto-generated and manual shopping lists"
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="auto-generate-button"
            onClick={() => void handleAutoGenerate()}
            disabled={autoGenerate.isPending || !inventoryId}
            className="inline-flex h-[38px] items-center rounded-lg border-[1.5px] border-border bg-card px-4 text-[13px] font-medium hover:bg-muted disabled:opacity-50"
          >
            {autoGenerate.isPending ? "Generating…" : "Auto-generate"}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex h-[38px] items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            + New list
          </button>
        </div>
      }
    />

    {showCreate && (
      <div className="mb-4 flex gap-2">
        <input
          autoFocus
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate();
          }}
          placeholder="List name…"
          className="h-9 flex-1 rounded-lg border-[1.5px] border-border bg-card px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={!newListName.trim() || createList.isPending}
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {createList.isPending ? "Creating…" : "Create"}
        </button>
      </div>
    )}

    {sorted.length === 0 ? (
      <p className="py-12 text-center text-muted-foreground">
        No lists yet. Create one to get started.
      </p>
    ) : (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {sorted.map((list) => (
          <ListCard key={list.id} list={list} inventoryId={inventoryId} />
        ))}
      </div>
    )}
  </div>
);
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @baskety/web test -- GroceryPage`
Expected: PASS (auto-generate-button testid + nav preserved).
Run: `pnpm --filter @baskety/web typecheck` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/grocery/GroceryPage.tsx
git commit -m "feat(web): grocery lists as warm card grid"
```

---

## Phase 6 — Grocery detail (check circles + progress)

### Task 6.1: Restyle `GroceryListPage`

**Files:**
- Modify: `apps/web/src/features/grocery/GroceryListPage.tsx`

Keep all logic: `useParams`, all queries/mutations (`updateItem`, `addItem`,
`completeList`, `deleteItem`, `renameList`), `handleToggle`, `toggleChecked`,
multi-select delete, rename dialog, `grouped` by status, `STATUS_ORDER`/`STATUS_LABEL`.
Restyle: container width, header, add a progress bar, render the bought-toggle as a
`CheckCircle`, dim/strike collected rows, wrap groups in warm cards.

- [ ] **Step 1: Add imports**

```tsx
import { CheckCircle } from "../../components/CheckCircle.js";
```

- [ ] **Step 2: Compute progress (derived, above the return)**

After `grouped` is computed, add:

```tsx
const allItems = items ?? [];
const totalCount = allItems.length;
const doneCount = allItems.filter((i) => i.status === "bought").length;
const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
```

- [ ] **Step 3: Restyle the page container + header**

Change the outermost wrapper to:

```tsx
<div className="mx-auto max-w-[680px] px-8 pb-20 pt-8">
```

Keep the existing back link but restyle to:

```tsx
className="mb-5 flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
```

Change the `<h1>` to:

```tsx
<h1 className="font-serif text-2xl font-semibold tracking-tight">{list.name}</h1>
```

Leave the action buttons (Add item / Complete list / Delete selected) logic intact;
update their classes to the warm button recipe:
- Primary (Complete list): `inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50`
- Outline (Add item): `inline-flex h-9 items-center rounded-lg border-[1.5px] border-border bg-card px-4 text-[13px] font-medium hover:bg-muted`
- Destructive (Delete selected): `... bg-destructive text-destructive-foreground hover:bg-destructive/90`

- [ ] **Step 4: Add the progress bar (after the header, before the groups)**

Insert:

```tsx
{totalCount > 0 && (
  <div className="mb-6">
    <div className="mb-1.5 flex justify-between text-xs">
      <span className="text-muted-foreground">{doneCount} of {totalCount} collected</span>
      <span className="font-semibold text-primary">{doneCount}/{totalCount}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded bg-secondary">
      <div
        className="h-full rounded bg-primary transition-[width] duration-300"
        style={{ width: `${progressPct}%` }}
      />
    </div>
  </div>
)}
```

- [ ] **Step 5: Restyle each status group + rows**

For each group, replace the group wrapper with a warm card and restyle rows. Keep
the multi-select checkbox (`checkedIds`) and the status toggle. The bought toggle
(currently a `<input type="checkbox" checked={item.status === "bought"} ...>`)
becomes a clickable `CheckCircle`:

- Group heading:
  ```tsx
  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
    {STATUS_LABEL[status]} ({group.length})
  </div>
  ```
- Group list container: wrap the rows in
  ```tsx
  <div className="mb-5 overflow-hidden rounded-xl border-[1.5px] border-border bg-card shadow-soft">…rows…</div>
  ```
- Each row: a flex row
  ```tsx
  <div
    key={item.id}
    className={`flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 ${
      item.status === "bought" ? "opacity-50" : "cursor-pointer hover:bg-primary/10"
    }`}
  >
    {/* keep the multi-select checkbox exactly as-is, with its onClick stopPropagation */}
    <input
      type="checkbox"
      checked={checkedIds.includes(item.id)}
      onChange={() => toggleChecked(item.id)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Select ${item.name}`}
    />
    <button
      type="button"
      onClick={() => handleToggle(item.id, item.status as ItemStatus)}
      aria-label={item.status === "bought" ? `Uncheck ${item.name}` : `Check ${item.name}`}
      className="flex flex-1 items-center gap-3 text-left"
    >
      <CheckCircle checked={item.status === "bought"} />
      <span className={`flex-1 text-sm font-medium ${item.status === "bought" ? "text-muted-foreground line-through" : ""}`}>
        {item.name}
      </span>
      <span className="text-[13px] tabular-nums text-muted-foreground">
        {item.quantity} {item.unit}
      </span>
    </button>
    {/* keep any existing per-row delete control if present */}
  </div>
  ```

> Preserve the exact prop names used by the current rows (`item.quantity`,
> `item.unit`, `item.status`, `ItemStatus`) — read the current JSX around
> lines 337–390 and keep the same field accessors. Only the wrapper/markup changes.

- [ ] **Step 6: Restyle the rename dialog + add-item form**

Leave their logic untouched; update dialog panel to
`rounded-2xl border-[1.5px] border-border bg-card p-6 shadow-soft` and its primary
button to the warm primary recipe. Update the add-item inputs to
`border-[1.5px] border-border bg-card`.

- [ ] **Step 7: Verify**

Run: `pnpm --filter @baskety/web test -- GroceryListPage`
Expected: PASS. If a test queried the bought state via a checkbox role that is now a
button, update the test to assert via the new accessible name (`Uncheck …`/`Check …`)
— adjust the test, not the behavior.
Run: `pnpm --filter @baskety/web typecheck` → Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/grocery/GroceryListPage.tsx
git add apps/web/src/features/grocery/GroceryListPage.test.tsx
git commit -m "feat(web): grocery detail with check circles + progress"
```

---

## Phase 7 — Receipts

### Task 7.1: Restyle `ReceiptPage`

**Files:**
- Modify: `apps/web/src/features/receipt/ReceiptPage.tsx`

Keep all logic (upload, `useScans`, `useStartScan`, status badges, links). Restyle
container + scan rows into the mock's row style with an icon chip; convert the
hardcoded `STATUS_BADGE` colors to warm tokens.

- [ ] **Step 1: Add imports**

```tsx
import { PageHeader } from "../../components/PageHeader.js";
import { ReceiptIcon } from "../../components/icons.js";
```

- [ ] **Step 2: Replace the `STATUS_BADGE` map with token classes**

```tsx
const STATUS_BADGE: Record<string, string> = {
  uploading: "bg-warn/15 text-warn",
  ocr_processing: "bg-primary/10 text-primary",
  llm_processing: "bg-primary/10 text-primary",
  pending_review: "bg-warn/15 text-warn",
  committed: "bg-ok/15 text-ok",
  failed: "bg-destructive/15 text-destructive",
};
```

- [ ] **Step 3: Restyle the page shell**

Replace the outer `<div className="p-6">` with
`<div className="mx-auto max-w-[1060px] px-8 pb-20 pt-8">` and replace the
`<div className="mb-6 flex ...">` + `<h1>` with:

```tsx
<PageHeader title="Receipts" subtitle="Scan receipts and review completed trips" />
```

Update the "Scan a receipt" panel wrapper to
`mb-6 rounded-2xl border-[1.5px] border-border bg-card p-5 shadow-soft`, its
`<h2 className="mb-3 font-medium">` to
`mb-3 font-serif text-base font-medium`, the Upload button to the warm primary
recipe, and the inline `text-red-600`/`text-green-600` messages to
`text-destructive`/`text-ok`.

- [ ] **Step 4: Restyle the scan list rows**

Replace the scan list container `<div className="rounded-lg border">` and the inner
`<Link>` rows with:

```tsx
<div className="flex flex-col gap-2.5">
  {scans.map((scan) => (
    <Link
      key={scan.id}
      to="/receipt/$scanId/review"
      params={{ scanId: scan.id }}
      className="flex items-center gap-4 rounded-xl border-[1.5px] border-border bg-card px-5 py-4 shadow-soft hover:shadow-md"
    >
      <div className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[10px] bg-primary/10">
        <ReceiptIcon />
      </div>
      <div className="flex-1">
        <div className="font-mono text-sm font-medium">{scan.id.slice(0, 8)}…</div>
        <div className="text-xs text-muted-foreground">
          {new Date(scan.created_at).toLocaleString()}
        </div>
      </div>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[scan.status] ?? "bg-muted text-muted-foreground"}`}>
        {scan.status}
      </span>
    </Link>
  ))}
</div>
```

- [ ] **Step 5: Verify**

Run: `pnpm --filter @baskety/web test -- ReceiptPage` (if a test file exists) and
`pnpm --filter @baskety/web typecheck`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/receipt/ReceiptPage.tsx
git commit -m "feat(web): warm receipts list with icon chips"
```

---

## Phase 8 — Settings

### Task 8.1: Warm settings shell + Appearance + Categories

**Files:**
- Modify: `apps/web/src/features/settings/SettingsPage.tsx`

Keep ALL existing sections (`LLMSection`, `OCRSection`, `HouseholdSection`,
`ShareLinksSection`) and their logic. Add an `AppearanceSection` (theme cards) and a
`CategoriesSection` is **out of scope** unless category data is already available on
this page — the mock's Categories card is informational; skip it to honor YAGNI
(categories are managed inline on the inventory page). Restyle the page container
and section card chrome to warm tokens.

- [ ] **Step 1: Add imports + AppearanceSection**

Add at the top:

```tsx
import { useUiStore } from "@baskety/core";
```

Add this component above `export function SettingsPage`:

```tsx
function AppearanceSection() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const card = (active: boolean) =>
    `flex-1 cursor-pointer rounded-[10px] border-2 p-4 ${
      active ? "border-primary bg-primary/10" : "border-border bg-card"
    }`;
  return (
    <section className="mb-4 rounded-2xl border-[1.5px] border-border bg-card p-6 shadow-soft">
      <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        Appearance
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={() => setTheme("light")} className={card(theme === "light")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Light</div>
              <div className="text-[11px] text-muted-foreground">Warm cream</div>
            </div>
            {theme === "light" && <span className="text-base font-bold text-primary">✓</span>}
          </div>
        </button>
        <button type="button" onClick={() => setTheme("dark")} className={card(theme === "dark")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Dark</div>
              <div className="text-[11px] text-muted-foreground">Espresso</div>
            </div>
            {theme === "dark" && <span className="text-base font-bold text-primary">✓</span>}
          </div>
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Restyle the `SettingsPage` shell + mount AppearanceSection**

Replace `SettingsPage`'s wrapper and heading:

```tsx
return (
  <div className="mx-auto max-w-[640px] px-8 pb-20 pt-8">
    <div className="mb-6">
      <h1 className="font-serif text-[28px] font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Manage your Baskety household</p>
    </div>
    <AppearanceSection />
    {/* keep the existing sections in their current order below */}
    <HouseholdSection />
    <ShareLinksSection />
    <LLMSection />
    <OCRSection />
  </div>
);
```

(Match the actual existing section order/usage — read the current `SettingsPage`
return and insert `<AppearanceSection />` after the heading without removing any
existing section.)

- [ ] **Step 3: Warm the section card chrome**

In each of `HouseholdSection`, `ShareLinksSection`, `LLMSection`, `OCRSection`,
update the section container/card classes: replace `rounded-lg border` wrappers with
`rounded-2xl border-[1.5px] border-border bg-card p-6 shadow-soft mb-4` and the
`text-lg font-semibold` section headings with
`font-serif text-base font-semibold`. Swap any `text-red-*`/`bg-red-*` for
`text-destructive`/`bg-destructive`. Do not change form logic.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @baskety/web test -- SettingsPage`
Expected: PASS.
Run: `pnpm --filter @baskety/web typecheck` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/settings/SettingsPage.tsx
git commit -m "feat(web): warm settings + appearance theme cards"
```

---

## Phase 9 — Auth / share / reports touch-ups

### Task 9.1: Auth pages — Lora heading

**Files:**
- Modify: `apps/web/src/features/auth/LoginPage.tsx`
- Modify: `apps/web/src/features/auth/RegisterPage.tsx`

These already use shadcn tokens (auto-warmed). Only make the brand heading Lora.

- [ ] **Step 1: LoginPage heading**

Change `<h1 className="text-3xl font-bold tracking-tight">Baskety</h1>` to
`<h1 className="font-serif text-3xl font-semibold tracking-tight">Baskety</h1>`.

- [ ] **Step 2: RegisterPage heading**

Apply the same `font-serif text-3xl font-semibold` change to the RegisterPage
top-level `<h1>` (read the file to confirm the exact current className, swap only
the heading).

- [ ] **Step 3: Verify**

Run: `pnpm --filter @baskety/web test -- LoginPage RegisterPage`
Expected: PASS.
Run: `pnpm --filter @baskety/web typecheck` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/auth/LoginPage.tsx apps/web/src/features/auth/RegisterPage.tsx
git commit -m "feat(web): Lora brand heading on auth pages"
```

---

### Task 9.2: Share + Reports token sweep

**Files:**
- Modify: `apps/web/src/features/share/SharePage.tsx`
- Modify: `apps/web/src/features/reports/ReportsPage.tsx`

These inherit warm tokens automatically. Only fix any hardcoded non-token colors
(`bg-gray-*`, `text-red-*`, `bg-green-*`, etc.) by swapping for the nearest token
(`bg-muted`, `text-destructive`, `text-ok`). Headings to `font-serif`.

- [ ] **Step 1: Grep for hardcoded colors**

Run:
```bash
grep -nE "bg-(gray|red|green|blue|yellow)-[0-9]|text-(gray|red|green|blue|yellow)-[0-9]" apps/web/src/features/share/SharePage.tsx apps/web/src/features/reports/ReportsPage.tsx
```

- [ ] **Step 2: Replace each hit with the nearest token**

Mapping: `red→destructive`, `green→ok`, `yellow→warn`, `blue→primary`,
`gray→muted/muted-foreground`. Make `<h1>`/`<h2>` use `font-serif`.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @baskety/web test` (full) and
`pnpm --filter @baskety/web typecheck`.
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/share/SharePage.tsx apps/web/src/features/reports/ReportsPage.tsx
git commit -m "feat(web): token sweep for share + reports"
```

---

## Phase 10 — Full verification

### Task 10.1: Full suite + dual-theme smoke

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the whole web app**

Run: `pnpm --filter @baskety/web typecheck`
Expected: PASS.

- [ ] **Step 2: Run all web unit tests**

Run: `pnpm --filter @baskety/web test`
Expected: PASS (all suites green).

- [ ] **Step 3: Run core tests**

Run: `pnpm --filter @baskety/core test`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `pnpm --filter @baskety/web lint`
Expected: PASS (fix any unused-import or a11y warnings introduced).

- [ ] **Step 5: Dual-theme dev smoke**

Run: `pnpm --filter @baskety/web dev`
Manually load `/inventory`, `/grocery`, a grocery list, `/receipt`, `/settings`,
`/login` in BOTH light and dark (toggle via nav). Confirm: fonts load (Lora
headings, DM Sans body), stock bars colored, check circles work, nav active
underline, no flash on reload, no console errors.

- [ ] **Step 6: Final no-op commit if any smoke fixes were needed**

```bash
git add -A
git commit -m "fix(web): dual-theme smoke fixes" || echo "nothing to commit"
```

---

## Self-review notes (coverage vs spec)

- Tokens (spec §1) → Tasks 0.2, 0.3 (ok/warn added; primary-soft via `/10`; danger via destructive — documented in header).
- Fonts (spec §2) → Task 0.1.
- Theme toggle + persistence (spec §3) → Tasks 1.1, 1.2, 1.3, 8.1 (Appearance cards).
- Nav (spec §4) → Task 3.1.
- Inventory (spec §5) → Tasks 4.1, 4.2.
- Grocery index → Task 5.1; Grocery detail → Task 6.1.
- Receipts → Task 7.1; Settings → Task 8.1 (Categories card intentionally dropped — YAGNI, noted in 8.1).
- Auth/share/reports → Tasks 9.1, 9.2.
- Shared components (spec §6) → Tasks 2.1, 2.2.
- Error handling (spec §7) → bootstrap try/catch in 1.2; no new error surfaces.
- Testing (spec §8) → unit tests in 1.1/1.3/2.1/2.2; existing suites kept green throughout; verification in 10.1.
