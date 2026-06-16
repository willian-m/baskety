# Sprint 19 — Inventory UX Redesign

**Goal:** Replace the flat inventory list with a spreadsheet-style table (web) and swipeable inline-edit cards (mobile), eliminating the three main UX pain points found in user testing.

**Source:** `docs/wishlist/inventory-ux-redesign.md`

**Dependencies:** Sprints 4, 10, 14 (backend inventory API + web/mobile inventory pages already implemented).

| # | Task | Est. |
|---|------|------|
| 19.1 | **Backend:** Extend `ListInventoryItems` SQL query with LEFT JOIN on `inventory_batches` to add `stored_quantity` (COALESCE SUM) and `batch_count` (COUNT). Run `make generate`. Update item response DTO in `handler.go`. Update list-items handler test. | 0.5d |
| 19.2 | **Core:** Add `stored_quantity: number` and `batch_count: number` to `InventoryItemResponse` in `packages/core/src/api/types.ts`. Add optimistic update to `useUpdateItem` (onMutate snapshot + apply, onError rollback, onSettled invalidate). | 0.5d |
| 19.3 | **Web — base table:** New `InventoryTable.tsx` component. Replace the bordered list in `InventoryPage.tsx` with it. Table columns: Item \| Stored Qty \| Target Qty. Category names appear as bold `<tr>` section-divider rows inside `<tbody>`. Items sorted alphabetically within each section. Category dropdown filter hides/shows entire sections. Search filters within visible sections. | 1d |
| 19.4 | **Web — inline row editing:** Click any item row → fields become `<input>` controls in-place (name, target qty, unit, category). Tab between fields; Enter saves; Escape cancels. Save calls `useUpdateItem` (optimistic). Pending spinner on row while saving; inline error text on failure. One row editable at a time. | 0.5d |
| 19.5 | **Web — batch disclosure:** Items with `batch_count > 1` show a ▶/▼ toggle. Click expands to batch sub-rows (qty, expiry date, `ExpiryBadge`). A `+ Add batch` sub-row at bottom opens an inline editable row (qty + date inputs); save calls `useAddBatch`. Multiple items can be expanded simultaneously. A "View details →" link in the expanded item row navigates to `/inventory/$itemId`. | 1d |
| 19.6 | **Web — Search-to-Add:** When search yields zero results and search term is non-empty, show "Add this item" button beside the search bar (replaces empty-state paragraph and top-level "Add item" button). Clicking scrolls to table bottom, opens a pre-filled editable row (name from search, category optional, unit + target qty required). Save calls `useCreateItem`; on success clears search and the row collapses. Escape cancels. | 0.5d |
| 19.7 | **Web — tests:** New `InventoryTable.test.tsx` (Vitest + RTL + MSW). Eight scenarios: category grouping, category filter, search filter, inline edit keyboard nav, optimistic update, disclosure arrow visibility, add-batch inline row, Search-to-Add flow. Extend `inventoryItemFixture` with `stored_quantity` and `batch_count`. | 1d |
| 19.8 | **Mobile — swipeable cards + stored qty:** In `apps/mobile/app/(app)/inventory.tsx`: (a) Show `stored_quantity` on each card alongside `target_quantity`. (b) Wrap `ItemRow` in `Swipeable` from `react-native-gesture-handler`; right-action reveals "Edit" button. Tapping Edit expands the card inline (name, category, unit, target qty inputs); Save calls `useUpdateItem` (optimistic); Cancel collapses. Card tap-to-detail preserved. `[itemId].tsx` unchanged. | 1d |

**Sprint total: 5.5d**

## Constraints

- Search bar and category dropdown filter must be preserved with their existing semantics.
- `ItemDetailPage.tsx` (web) and `[itemId].tsx` (mobile) are kept; de-emphasized but not removed.
- Inline editing must be keyboard-accessible (Tab, Enter, Escape).
- No new backend endpoints needed — extend the existing list response only.
- Conflict resolution: optimistic update + inline error text (no external toast library).
