# Sprint 21 Plan — Inventory UX Fixes: Batch Creation, Delete, Duplicate Prevention, Multi-Select

## Context

Sprint 20 added a "stored quantity + expiry date" input to the new-item form. User testing revealed:
1. **Bug**: Saving an item with stored qty shows "save failed" even though the item is created — the separate batch POST fails, likely because `<input type="date">` produces "YYYY-MM-DD" strings that Go's `*time.Time` JSON decoder rejects (expects RFC 3339), and/or because the two-step approach is inherently fragile.
2. **Item shows 0 stored qty** because stored_quantity is always computed from batches — if the batch wasn't created, it stays 0.
3. **No edit path for stored qty** on existing items.
4. **No delete UI** for inventory items (backend `HandleDeleteItem` at `DELETE /{inventoryID}/items/{itemID}` already exists).
5. **Duplicate items allowed** — no unique constraint on (inventory_id, name, category).

**Developer's validated hypothesis:** Two-step creation is the root cause; fix is to merge batch creation into the item creation call, making it atomic.

---

## Parallel Groups

### Group A — Backend `sprint-21/backend`

**Files to modify/create:**
- `baskety/db/migrations/00008_inventory_constraints.sql` — new migration
- `baskety/db/queries/inventory_batches.sql` — add PatchBatch query
- `baskety/gen/sqlc/` — regenerated via `sqlc generate`
- `baskety/internal/inventory/dto.go` — update CreateItemRequest, add PatchBatchRequest
- `baskety/internal/inventory/repository.go` — add PatchBatch
- `baskety/internal/inventory/repository_pg.go` — implement PatchBatch
- `baskety/internal/inventory/service.go` — update CreateItem (atomic batch), handle unique violation
- `baskety/internal/inventory/handler.go` — add HandlePatchBatch
- `baskety/internal/inventory/routes.go` — register PATCH batch route
- `baskety/internal/inventory/handler_test.go` — tests

#### Task A1 — Migration `00008_inventory_constraints.sql`
Use goose format (matching existing migrations). Add a partial unique index so the same name+category cannot appear twice in the same inventory (soft-deleted items excluded):
```sql
-- +goose Up
CREATE UNIQUE INDEX idx_inventory_items_unique_name_category
    ON inventory_items (inventory_id, lower(name), COALESCE(lower(category), ''))
    WHERE deleted_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_inventory_items_unique_name_category;
```

#### Task A2 — Atomic batch creation in `CreateItem`
Modify `dto.go`: add optional fields to `CreateItemRequest`:
```go
InitialQuantity  float64    `json:"initial_quantity"`   // 0 = no initial stock
InitialExpiresAt *time.Time `json:"initial_expires_at"` // optional expiry for initial batch
```

Modify `Service.CreateItem` (in `service.go`): after calling `repo.CreateItem(...)` to insert the item row, **always** call `repo.AddBatch(ctx, item.ID, req.InitialQuantity, req.InitialExpiresAt, nil)` regardless of quantity. This ensures every item always has exactly one batch after creation. A zero-quantity batch is valid and represents "item tracked but no stock on hand."

Handle the unique constraint violation (pgx error code `23505`): detect it in `Service.CreateItem` and return `fmt.Errorf("an item with this name already exists in this category: %w", ErrInvalidInput)`. Import `github.com/jackc/pgx/v5/pgconn` to check `(*pgconn.PgError).Code == "23505"`. Pattern: look at how other pgx error codes are handled in the inventory or shared package.

#### Task A3 — PATCH batch endpoint
Add SQL query to `baskety/db/queries/inventory_batches.sql`:
```sql
-- name: PatchBatch :one
UPDATE inventory_batches
SET quantity = $2, expires_at = $3, updated_at = NOW()
WHERE id = $1 AND emptied_at IS NULL
RETURNING *;
```

Run `sqlc generate` (or `make go-generate`).

Add to `Repository` interface:
```go
PatchBatch(ctx context.Context, id uuid.UUID, quantity float64, expiresAt *time.Time) (*InventoryBatch, error)
```

Implement `repoPg.PatchBatch` following the existing `AddBatch` pattern.

Add to `ServiceIface`:
```go
PatchBatch(ctx context.Context, batchID, itemID, householdID uuid.UUID, req PatchBatchRequest) (*BatchResponse, error)
```

Add `PatchBatchRequest` to `dto.go`:
```go
type PatchBatchRequest struct {
    Quantity  float64    `json:"quantity"`
    ExpiresAt *time.Time `json:"expires_at"`
}
```

Implement `Service.PatchBatch`: validate quantity >= 0 (`ErrInvalidInput` if < 0), call `assertItemScope(ctx, itemID, householdID)` to verify household access, call `repo.PatchBatch(...)`. Return `toBatchResponse(batch)`.

Add `HandlePatchBatch` to `handler.go` (follow `HandleAddBatch` pattern):
- Parse `itemID` and `batchID` from URL
- Decode `PatchBatchRequest`
- Validate quantity >= 0 (400 if negative)
- Call `svc.PatchBatch(ctx, batchID, itemID, hid, req)`
- Return 200 `{"data": resp}`

Register in `routes.go`:
```go
r.Patch("/{inventoryID}/items/{itemID}/batches/{batchID}", h.HandlePatchBatch)
```

#### Task A4 — Tests
- `handler_test.go`: add `TestHandleCreateItem` cases for duplicate name (expect 400 with meaningful error), and `TestHandlePatchBatch` (success 200, not-found 404, forbidden 403, negative quantity 400).
- `service_test.go`: verify `CreateItem` unique violation maps to `ErrInvalidInput`.

**Pre-commit:** run `gofmt -w` on all modified `.go` files. Verify `go build ./...`, `go vet ./internal/inventory/...`, `go test ./internal/inventory/...`.

---

### Group B — Core + Web `sprint-21/frontend`

**Files to modify/create:**
- `packages/core/src/api/types.ts` — update `CreateItemRequest` interface
- `packages/core/src/queries/inventory.ts` — add `usePatchBatch`; verify/add `useDeleteItem`
- `apps/web/src/features/inventory/InventoryTable.tsx` — all UX changes
- `apps/web/src/features/inventory/InventoryTable.test.tsx` — update tests

#### Task B1 — Core type and mutation updates (`packages/core/`)
In `types.ts`, update `CreateItemRequest` (if declared there) or update the inline interface in `inventory.ts`:
```typescript
interface CreateItemRequest {
  name: string;
  category: string;
  unit: string;
  target_quantity: number;
  notes?: string | null;
  initial_quantity?: number;      // NEW — 0 if omitted
  initial_expires_at?: string | null; // NEW — null if omitted
}
```

Add `usePatchBatch(inventoryId: string, itemId: string)` to `queries/inventory.ts`:
```typescript
export function usePatchBatch(inventoryId: string, itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, quantity, expires_at }: { batchId: string; quantity: number; expires_at: string | null }) =>
      request<InventoryBatchResponse>(`/inventories/${inventoryId}/items/${itemId}/batches/${batchId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity, expires_at }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventories", inventoryId, "items"] });
      void qc.invalidateQueries({ queryKey: ["inventories", inventoryId, "items", itemId, "batches"] });
    },
  });
}
```

Check `inventory.ts` line ~140 for an existing `useDeleteItem` hook. If it exists, reuse it. If not, add:
```typescript
export function useDeleteItem(inventoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      request<void>(`/inventories/${inventoryId}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventories", inventoryId, "items"] });
    },
  });
}
```

Export any new hooks from `queries/index.ts` if not already exported via wildcard.

#### Task B2 — `NewItemRow` fix
Remove the separate batch POST. Instead, pass `initial_quantity` and `initial_expires_at` directly in the `createItem.mutateAsync()` call:

```typescript
await createItem.mutateAsync({
  name: name.trim(),
  category: category.trim(),
  unit: unit.trim(),
  target_quantity: parseFloat(target) || 1,
  initial_quantity: parseFloat(storedQty) || 0,
  initial_expires_at: expiryDate || null,
});
```

Remove: the `qc`/`useQueryClient` import (if no longer needed), the separate `request(...)` batch POST call, and the extra invalidateQueries calls. The `useCreateItem` hook's own `onSuccess` already invalidates items.

Handle the duplicate error specifically: catch the error from `mutateAsync` and check if it contains "already exists in this category" — if so, display "An item with this name already exists in this category" instead of the generic "Save failed."

#### Task B3 — Left column: "+" button + expand arrow
The first column currently shows an expand arrow only when `batch_count > 1`. Replace with:
- **Always** show a small boxed "+" button (tooltip `"Add a new batch"`)
- Additionally show expand arrow (▶/▼) when `batch_count > 1`

The "+" button click: prevent row click (stopPropagation), set `addingBatch` state to `true` on `BatchRows`. Since `BatchRows` is currently shown only when `isExpanded`, restructure:
- Split `BatchRows` into a `BatchList` (the existing batch rows) + an `AddBatchForm` (the add form)
- The "+" button in `ItemRow` triggers the add-batch form; it can be implemented via a new callback prop `onAddBatch` passed to `ItemRow` that sets a piece of state (e.g., `addingBatchForItemId`) in `InventoryTable`
- When `addingBatchForItemId === item.id`, render an inline batch add row beneath the item (regardless of expand state)

Alternatively (simpler): keep the existing `BatchRows` component but expose `isAdding` state externally. The "+" in `ItemRow` calls a new `onStartAddBatch()` callback which sets `expandedItemIds.add(item.id)` AND sets a new `addingBatchItemId` state in `InventoryTable`. Then `BatchRows` checks `initiallyAdding` prop to open the form automatically.

#### Task B4 — Batch edit in item edit mode (single batch)
When `isEditing && item.batch_count === 1`:
- In `ItemRow`, call `useBatches(inventoryId, item.id, isEditing)` — this starts fetching when edit mode opens
- Call `usePatchBatch(inventoryId, item.id)` at the top of `ItemRow` (unconditionally, hooks rule)
- Add local state: `batchQty: string`, `batchExpiry: string`
- When `batches` loads (in `useEffect` or via `beginEdit`), seed `batchQty = String(batches[0].quantity)` and `batchExpiry = batches[0].expires_at ?? ""`
- In edit mode, render the "Stored Qty" column with editable `<input type="number">` (for batchQty) and `<input type="date">` (for batchExpiry) instead of the read-only display
- On save: call both `updateItem.mutateAsync(...)` AND `patchBatch.mutateAsync({batchId: batches[0].id, quantity: parseFloat(batchQty)||0, expires_at: batchExpiry||null})` in parallel (Promise.all)
- When `item.batch_count > 1`: keep existing read-only "Stored Qty" display in edit mode (editing individual batches is done via the batch expand rows)

#### Task B5 — Multi-select delete
In `InventoryTable`:
- Add `selectedItemIds: Set<string>` state (use `useState<Set<string>>(new Set())`)
- Pass `isSelected`, `onSelect` props to `ItemRow`
- In `ItemRow`, add `onContextMenu` handler on the outer `<tr>`: `e.preventDefault(); onSelect(item.id)` (toggle selection)
- Visual: when `isSelected`, add a distinct background class (e.g., `bg-blue-50 ring-1 ring-blue-300`)
- In `InventoryTable` header row: when `selectedItemIds.size > 0`, render a "Delete {N} items" button (right side of the header) styled as a destructive action (red)
- Clicking the button: set `showDeleteModal = true`
- Delete modal (no external library — local state + fixed overlay):
  ```tsx
  {showDeleteModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Delete {selectedItemIds.size} item{selectedItemIds.size !== 1 ? "s" : ""}?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This will permanently remove the selected items and all their batches. This action is irreversible.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
          <button className="...bg-red-600..." onClick={handleConfirmDelete}>Delete</button>
        </div>
      </div>
    </div>
  )}
  ```
- `handleConfirmDelete`: call `useDeleteItem(inventoryId)` for each selected ID — since the hook takes `inventoryId` at hook-call time and `itemId` as mutation variable, call `deleteItem.mutateAsync(id)` in a `Promise.all`. After completion: clear `selectedItemIds`, `setShowDeleteModal(false)`.
- Since `useDeleteItem` is a single hook instance, call `deleteItem.mutateAsync` sequentially or use `Promise.allSettled` to handle partial failures gracefully.

**Pre-commit:** `pnpm exec prettier --write` + `pnpm exec eslint --max-warnings=0` on all changed files. TypeScript must be clean.

---

## Branch Names
- `sprint-21/backend`
- `sprint-21/frontend`

## Merge Order
1. `sprint-21/backend` first (migration runs on server start)
2. `sprint-21/frontend` after

## Verification
1. **Backend:** `go build ./...` + `go vet ./internal/inventory/...` + `go test ./internal/inventory/...` all pass
2. **Frontend:** `pnpm --filter @baskety/core typecheck` + `pnpm --filter @baskety/web typecheck` clean
3. **Manual smoke test:**
   - Create new item with stored qty 3 → no "save failed", item shows 3 in stored qty column
   - Create item with same name+category → see "already exists in this category" error
   - Click item row to edit (single-batch item) → stored qty and expiry date are editable → save updates correctly
   - Click "+" button → inline add-batch form opens → save adds second batch, expand arrow appears
   - Right-click two items → both highlight → "Delete 2 items" button appears → click → modal with irreversible warning → confirm → both disappear
