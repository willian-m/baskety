# Category Inline Rename + Combobox UX

**Date:** 2026-06-16
**Status:** Approved

## Problem

Categories in the inventory table are not editable — the only way to move an item to a different category is to inline-edit the item and retype the category string. There is no way to rename a whole category at once. The category field in the item edit form uses a browser-native `<datalist>` which has inconsistent cross-browser styling and limited UX.

## Solution

Two frontend-only changes, no backend work:

1. **Inline category header rename** — click the category section header to edit it in place; saving renames all items in that category via optimistic client-side fan-out using the existing `PUT /inventories/{id}/items/{itemId}` endpoint.
2. **Category combobox** — replaces the `<datalist>` in the item edit form with a styled dropdown combobox that supports both selection from existing categories and free-text entry.

## Architecture

### New hook: `useRenameCategory` (`packages/core/src/queries/inventory.ts`)

Mirrors `useUpdateItem` exactly — same three TanStack Query callbacks (`onMutate`, `onError`, `onSettled`). Takes `{ to, items }` where `items` is the array of `InventoryItemResponse` objects currently in the category.

- **`mutationFn`**: fires `Promise.all()` of N PUT requests, one per item, each with `category: to`
- **`onMutate`**: patches the cache by item ID (avoids any dependency on the `UNCATEGORIZED` display constant), then returns snapshot for rollback
- **`onError`**: restores snapshot
- **`onSettled`**: invalidates items query to reconcile with server

Partial failure behavior: `Promise.all` rejects on first failure; cache rolls back; `onSettled` invalidates so TanStack Query refetches and shows true (partially updated) state.

### `CategoryHeaderRow` component (internal to `InventoryTable.tsx`)

State machine per category header:

- **Idle**: category name rendered as `<strong>` with `cursor-pointer`. Click → editing mode.
- **Editing**: `<input>` with `autoFocus`, pre-filled with current name.
  - Enter / blur → `commit()`: trims value; if non-empty and changed, calls `renameCategory.mutate`; switches back to idle.
  - Escape → cancel, restore original name.
  - Empty value → treated as cancel.
- **Saving** (mutation pending): row dims to `opacity-60`.

"Uncategorized" is renameable — assigns a real category to previously uncategorized items.

### `CategoryCombobox` component (internal to `InventoryTable.tsx`)

Replaces `<input list="...">` + `<datalist>` pair. Props: `value`, `onChange`, `options` (existing category strings), `readOnly`, `className`.

- Opens dropdown on focus or change showing options filtered by input (case-insensitive)
- Arrow Up/Down navigates; Enter selects highlighted or keeps typed value; Escape closes
- Click on suggestion selects it (`mousedown` + `e.preventDefault()` to avoid blur race)
- Outside `mousedown` closes dropdown
- `readOnly` locks the field (preserves existing behavior for "+ Add item to {category}")

The existing `<datalist id="category-suggestions">` block is removed.

## Files Modified

| File | Change |
|------|--------|
| `packages/core/src/queries/inventory.ts` | Add `useRenameCategory` |
| `apps/web/src/features/inventory/InventoryTable.tsx` | `CategoryHeaderRow`, `CategoryCombobox`, remove datalist |
| `apps/web/src/features/inventory/InventoryTable.test.tsx` | Update category-related tests |
