# Sprint 20 — UX Polish: Inventory Autocomplete, Grocery Management, Household Switcher

**Goal:** Address five UX issues reported after the Sprint 19 inventory redesign.

**Source:** User feedback session, 2026-06-13.

**Dependencies:** Sprint 19 (InventoryTable, useBatches, stored_quantity/batch_count fields).

| # | Task | Est. |
|---|------|------|
| 20.1 | **Backend:** Add `RenameGroceryList` (UPDATE) and `DeleteGroceryList` (DELETE) SQL queries to `baskety/db/queries/grocery_lists.sql`. Run `make generate`. Add `RenameList` and `DeleteList` service methods. Add `HandleRenameList` (`PUT /{listID}`) and `HandleDeleteList` (`DELETE /{listID}`) handlers. Register routes. Add handler unit tests. | 0.5d |
| 20.2 | **Core:** Add `useRenameList(inventoryId, listId)`, `useDeleteList(inventoryId)`, and `useArchiveList(inventoryId, listId)` mutations to `packages/core/src/queries/grocery.ts`. Each invalidates `["inventories", inventoryId, "lists"]` on success. | 0.25d |
| 20.3 | **Web — category combobox:** Replace plain category `<input>` in `InventoryTable.tsx` with `<input list="category-suggestions">` + a single `<datalist id="category-suggestions">` rendered once in the table. Applies to `ItemRow` edit-mode and `NewItemRow`. `allCategories` already derived from `items` at line ~34. | 0.5d |
| 20.4 | **Web — initial stored qty on creation:** Add `storedQty` and `expiryDate` state to `NewItemRow` in `InventoryTable.tsx`. Show a numeric input + date input in the Stored Qty column. After `createItem.mutateAsync(...)` succeeds, if `storedQty > 0` call the batch endpoint directly via `request(...)` (can't use `useAddBatch` hook before item ID is known) then `invalidateQueries`. | 0.5d |
| 20.5 | **Web — per-category add affordance:** Add `addingInCategory: string \| null` state to `InventoryTable`. After each category's last `<ItemRow>`, render a subtle `+ Add item to [Category]` button that opens an inline `NewItemRow` with `initialCategory` pre-filled (read-only). `NewItemRow` gains `initialCategory?: string` and `allCategories: string[]` props. | 0.5d |
| 20.6 | **Web + Core — household/inventory switcher:** Add `activeInventoryId` + `setActiveInventory` to `packages/core/src/stores/uiStore.ts` (persist to localStorage). Create `apps/web/src/hooks/useActiveInventory.ts` that resolves the active inventory from the store (falling back to `inventories?.[0]`). Replace `inventories?.[0]?.id` in all five pages (`InventoryPage`, `ItemDetailPage`, `GroceryPage`, `GroceryListPage`, `SettingsPage`) with `useActiveInventory()`. Add `<HouseholdSwitcher />` to `apps/web/src/routes/_app.tsx` navbar: shows current household name, opens dropdown on click, calls `setActiveHousehold` + resets `activeInventoryId` on selection. | 1d |
| 20.7 | **Web — grocery list management UI:** In `apps/web/src/features/grocery/GroceryPage.tsx`, add a `⋯` kebab menu per list card (local `openMenuId` state). Menu actions: **Rename** (inline editable name, Enter/Escape, calls `useRenameList`), **Archive** (calls `useArchiveList`, hides list), **Delete** (`window.confirm` then `useDeleteList`). | 0.5d |

**Sprint total: 3.75d**

## Constraints

- `useAddBatch` cannot be used in `NewItemRow` for the initial batch because the item ID isn't known at hook-call time. Call `request(...)` from `@baskety/core/api/client` directly in the save handler instead.
- `<datalist>` must use a single ID in the DOM — render it once at the table level, not per-input.
- `initialCategory` provided to `NewItemRow` via per-category affordance should be read-only in the form (category already decided by which section the user clicked).
- Household switcher must reset `activeInventoryId` to `""` when switching households so `useActiveInventory` falls back to the new household's first inventory.
- No external menu/popover library — kebab menu uses local state + absolute positioning.
