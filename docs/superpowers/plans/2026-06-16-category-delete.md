# Category Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-category delete button that opens a confirmation modal and uncategorizes all items in the category on confirm.

**Architecture:** All changes are inside `CategoryHeaderRow` in `InventoryTable.tsx`. A trash icon button (hover-reveal) opens a local modal; confirming calls the existing `onRename({ to: "", items })` which reuses `useRenameCategory` to set each item's category to `""` (backend stores as null → displayed as Uncategorized).

**Tech Stack:** React 18, TanStack Query, Tailwind CSS, Vitest + Testing Library, MSW

---

### Task 1: Write failing tests for the delete feature

**Files:**
- Modify: `apps/web/src/features/inventory/InventoryTable.test.tsx`

- [ ] **Step 1: Add a `describe("category header delete")` block after the existing `category header rename` describe block**

```tsx
describe("category header delete", () => {
  it("renders a delete button for each category header", async () => {
    renderTable();
    await screen.findByText("Dairy");
    expect(
      screen.getByRole("button", { name: "Delete category Dairy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete category Non perishable" }),
    ).toBeInTheDocument();
  });

  it("clicking the delete button opens a confirmation modal with category name and item count", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole("button", { name: "Delete category Dairy" }));
    const modal = await screen.findByRole("dialog");
    expect(modal).toBeInTheDocument();
    // "Dairy" has 1 item (Milk)
    expect(within(modal).getByText(/Delete "Dairy"\?/)).toBeInTheDocument();
    expect(within(modal).getByText(/1 item/)).toBeInTheDocument();
    expect(within(modal).getByText(/Uncategorized/)).toBeInTheDocument();
  });

  it("Cancel closes the modal without calling the API", async () => {
    const user = userEvent.setup();
    const update = vi.fn();
    server.use(
      http.put(`${BASE}/inventories/:invId/items/:itemId`, async ({ request }) => {
        update(await request.json());
        return HttpResponse.json({ data: inventoryItemFixture() });
      }),
    );
    renderTable();
    await user.click(screen.getByRole("button", { name: "Delete category Dairy" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("clicking Delete calls PUT with category '' for every item in the category", async () => {
    const user = userEvent.setup();
    const update = vi.fn();
    server.use(
      http.put(`${BASE}/inventories/:invId/items/:itemId`, async ({ request }) => {
        update(await request.json());
        return HttpResponse.json({ data: inventoryItemFixture() });
      }),
    );
    renderTable();
    // "Non perishable" has Rice + Beans → 2 PUT calls
    await user.click(
      screen.getByRole("button", { name: "Delete category Non perishable" }),
    );
    const modal = await screen.findByRole("dialog");
    await user.click(within(modal).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(2);
    });
    expect(update.mock.calls.every((c) => c[0].category === "")).toBe(true);
  });

  it("clicking Delete closes the modal", async () => {
    const user = userEvent.setup();
    server.use(
      http.put(`${BASE}/inventories/:invId/items/:itemId`, () =>
        HttpResponse.json({ data: inventoryItemFixture() }),
      ),
    );
    renderTable();
    await user.click(screen.getByRole("button", { name: "Delete category Dairy" }));
    const modal = await screen.findByRole("dialog");
    await user.click(within(modal).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the new tests to confirm they all fail**

```bash
cd apps/web && npx vitest run src/features/inventory/InventoryTable.test.tsx --reporter=verbose 2>&1 | grep -E "category header delete|✓|×"
```

Expected: all 5 new tests fail (buttons/dialog not found).

---

### Task 2: Implement the delete button and modal in `CategoryHeaderRow`

**Files:**
- Modify: `apps/web/src/features/inventory/InventoryTable.tsx` — `CategoryHeaderRow` only

- [ ] **Step 1: Add `showDeleteModal` state and update the component**

Replace the entire `CategoryHeaderRow` function (everything from `function CategoryHeaderRow` through its closing `}`) with:

```tsx
function CategoryHeaderRow({ category, items, onRename, isPending }: CategoryHeaderRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === category) {
      setEditing(false);
      setDraft(category);
      return;
    }
    onRename({ to: trimmed, items });
    setEditing(false);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
      setDraft(category);
    }
  }

  return (
    <>
      <tr
        className={`group bg-muted/40 ${isPending ? "opacity-60" : ""} ${!editing ? "cursor-pointer" : ""}`}
        onClick={() => {
          if (!editing) {
            setDraft(category);
            setEditing(true);
          }
        }}
      >
        <td colSpan={4} className="px-2 py-2">
          <div className="flex items-center justify-between">
            {editing ? (
              <input
                autoFocus
                aria-label={`Rename category ${category}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKey}
                onBlur={commit}
                onClick={(e) => e.stopPropagation()}
                className="h-7 rounded border border-input bg-background px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            ) : (
              <strong className="text-sm font-semibold">{category}</strong>
            )}
            {!editing && (
              <button
                type="button"
                aria-label={`Delete category ${category}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteModal(true);
                }}
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        </td>
      </tr>
      {showDeleteModal && (
        <tr>
          <td colSpan={4}>
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-category-title"
            >
              <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl">
                <h2 id="delete-category-title" className="text-lg font-semibold">
                  Delete &quot;{category}&quot;?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  All {items.length} item{items.length !== 1 ? "s" : ""} in this category will
                  become Uncategorized. This action cannot be undone.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    autoFocus
                    type="button"
                    className="rounded px-4 py-2 text-sm"
                    onClick={() => setShowDeleteModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    onClick={() => {
                      onRename({ to: "", items });
                      setShowDeleteModal(false);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 2: Run all inventory tests to confirm they pass**

```bash
cd apps/web && npx vitest run src/features/inventory/InventoryTable.test.tsx --reporter=verbose 2>&1 | grep -E "✓|×|Tests "
```

Expected: 42 passed, 1 failed (the pre-existing search-to-add React-version mismatch — unrelated).

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
cd /home/wmatiolidev/dev-projects/GroceryStoreList
npx prettier --write apps/web/src/features/inventory/InventoryTable.tsx apps/web/src/features/inventory/InventoryTable.test.tsx
git add apps/web/src/features/inventory/InventoryTable.tsx apps/web/src/features/inventory/InventoryTable.test.tsx
git commit -m "feat(inventory): add delete button and confirmation modal to category header

Hovering a category row reveals a trash icon. Clicking it opens a modal
warning that all items in the category will become Uncategorized.
Confirming calls useRenameCategory with to='' to clear the category on
every item in one optimistic fan-out.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
