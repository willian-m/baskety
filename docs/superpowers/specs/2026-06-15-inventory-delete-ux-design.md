# Inventory Delete UX Design

**Date:** 2026-06-15  
**Status:** Implemented

## Problem

Inventory item delete existed on the backend (soft-delete via `DELETE /inventories/{id}/items/{itemId}`) and was technically reachable in the web UI, but only through a non-obvious right-click-to-select gesture. Users reported not being able to delete items.

## Decision

Make delete discoverable by adding:
1. **Visible checkboxes** on each item row (replaces right-click as the primary selection mechanism).
2. **A select-all checkbox** in the table header that selects/deselects all currently-visible items.
3. **A per-row trash icon button** that deletes a single item without requiring checkbox selection first.

Right-click selection is retained as a power-user alias.

## Scope

Frontend only. Single file change: `apps/web/src/features/inventory/InventoryTable.tsx`.

No backend, hook, or modal changes required — `useDeleteItem` in `@baskety/core` and the confirmation modal were already production-ready.

## UI Behavior

### Checkbox column (first column)
- Header cell contains a "Select all items" checkbox.
  - Checked when all visible items are selected; unchecked when none are; indeterminate when some are.
  - Clicking when checked → deselects all. Clicking when unchecked or indeterminate → selects all visible items.
- Each data row has a "Select {item name}" checkbox wired to the existing `toggleSelect()` function.
- Clicking the checkbox stops propagation to prevent triggering inline edit mode.
- When ≥1 item is selected, the existing red "Delete N item(s)" button appears in the header.

### Per-row trash icon (last column)
- A trash icon SVG button (`aria-label="Delete {item.name}"`) placed at the far right of each row.
- Visible only on row hover (`opacity-0 group-hover:opacity-100`) via Tailwind's `group` class on the `<tr>`.
- Clicking calls `handleDeleteSingle(id)` which sets `selectedItemIds` to `new Set([id])` and opens the existing confirmation modal.
- Clicking stops propagation to prevent triggering inline edit mode.

### Confirmation modal (unchanged)
- Same modal, same warning ("This action is irreversible"), same error handling and cache invalidation.

## Select-all semantics
Only items currently visible (post-filter) are selected. Selecting all while a filter is active does not affect hidden items.

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/features/inventory/InventoryTable.tsx` | Added `TrashIcon` component, `handleDeleteSingle`, `allVisibleSelected`/`someSelected` derived values, `selectAllRef` + indeterminate effect, checkbox in header, checkbox + trash icon in `ItemRow`, `onDeleteSingle` prop |
| `apps/web/src/features/inventory/InventoryTable.test.tsx` | Added 8 tests in `describe("checkbox select + per-row trash icon")` |
