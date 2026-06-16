# Category Delete UX

**Date:** 2026-06-16
**Status:** Approved

## Problem

The category header row supports inline rename but has no way to delete a category. Users who want to remove a category must individually re-categorize or delete every item in it.

## Solution

Add a delete button to the category header row. Clicking it opens a confirmation modal warning that all items in the category will become Uncategorized. On confirmation, the existing `useRenameCategory` hook is called with `to: ""`, which sets each item's category to an empty string (stored as null by the backend, displayed as Uncategorized).

No new hooks, no new API endpoints, no backend changes.

## Design

### `CategoryHeaderRow` — changes only

**New local state:** `showDeleteModal: boolean` (false by default).

**Layout change:** The `<td>` content becomes a flex row (`flex items-center justify-between`):
- Left: category name (`<strong>`) or rename input when editing
- Right: `TrashIcon` button — `opacity-0 group-hover:opacity-100`, hidden while `editing` is true

The `<tr>` gains `"group"` in its className so the hover-opacity pattern works (same as per-item trash icons).

The trash button calls `e.stopPropagation()` before `setShowDeleteModal(true)` so the row's rename-on-click handler does not fire.

**Confirmation modal:** Rendered as a `fixed inset-0 z-50` overlay (same pattern as the existing item bulk-delete modal in `InventoryTable`). Content:

> **Delete "[category]"?**
> All N item[s] in this category will become Uncategorized. This action cannot be undone.
>
> [Cancel]  [Delete]

- **Cancel:** `setShowDeleteModal(false)` — no mutation.
- **Delete:** `onRename({ to: "", items })` then `setShowDeleteModal(false)`. The optimistic cache update in `useRenameCategory.onMutate` instantly moves all items to Uncategorized; `onSettled` refetches to reconcile.

The modal is rendered inside the `<tr>/<td>` structure (same approach as the batch-removal modal) — no portal needed since the pattern already works in this codebase.

## Files Modified

| File | Change |
|------|--------|
| `apps/web/src/features/inventory/InventoryTable.tsx` | `CategoryHeaderRow`: group class on `<tr>`, flex layout in `<td>`, delete button, delete modal |
| `apps/web/src/features/inventory/InventoryTable.test.tsx` | Add tests for delete button visibility, modal content, cancel, and confirm |

## Verification

1. Hovering a category row reveals the trash icon; it's hidden otherwise.
2. Clicking trash while in rename mode does not open the modal (button hidden).
3. Clicking trash opens modal with correct category name and item count.
4. Cancel closes modal, no API call fired.
5. Confirm calls `PUT` for each item in the category with `category: ""`, closes modal; items regroup under Uncategorized.
6. `npx vitest run src/features/inventory/InventoryTable.test.tsx` — all tests pass.
7. `npx tsc --noEmit` — no type errors.
