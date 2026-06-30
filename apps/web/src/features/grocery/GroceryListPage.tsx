import {
  useAddListItem,
  useCompleteList,
  useDeleteListItem,
  useGroceryItems,
  useGroceryList,
  useRenameList,
  useUpdateListItem,
} from "@baskety/core";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CheckCircle } from "../../components/CheckCircle.js";
import { useActiveInventory } from "../../hooks/useActiveInventory.js";

type ItemStatus = "pending" | "bought" | "skipped";

const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: "Pending",
  bought: "Bought",
  skipped: "Skipped",
};

const STATUS_ORDER: ItemStatus[] = ["pending", "bought", "skipped"];

export function GroceryListPage() {
  const { listId } = useParams({ from: "/_app/grocery/$listId" });
  const navigate = useNavigate();

  const inventoryId = useActiveInventory();

  const { data: list, isLoading: loadingList } = useGroceryList(inventoryId, listId);
  const { data: items, isLoading: loadingItems } = useGroceryItems(inventoryId, listId);
  const updateItem = useUpdateListItem(inventoryId, listId);
  const addItem = useAddListItem(inventoryId, listId);
  const completeList = useCompleteList(inventoryId, listId);
  const deleteItem = useDeleteListItem(inventoryId, listId);
  const renameList = useRenameList(inventoryId, listId);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newUnit, setNewUnit] = useState("pcs");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameText, setRenameText] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    setRenameText(list?.name ?? "");
  }, [list?.name]);

  const handleRenameCancel = useCallback(() => {
    setRenameText(list?.name ?? "");
    setRenameDialogOpen(false);
  }, [list?.name]);

  useEffect(() => {
    if (!renameDialogOpen) return;
    const el = dialogRef.current;
    if (!el) return;

    const siblings = Array.from(document.body.children).filter((child) => !child.contains(el));
    siblings.forEach((s) => s.setAttribute("aria-hidden", "true"));

    const focusable = Array.from(
      el.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
    triggerRef.current = document.activeElement;
    focusable[0]?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleRenameCancel();
        return;
      }
      if (e.key === "Tab") {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      siblings.forEach((s) => s.removeAttribute("aria-hidden"));
      document.removeEventListener("keydown", handleKey);
      const node = triggerRef.current as HTMLElement | null;
      if (node?.isConnected) {
        node.focus();
      }
    };
  }, [renameDialogOpen, handleRenameCancel]);

  if (loadingList || loadingItems || !inventoryId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">List not found.</p>
      </div>
    );
  }

  const handleToggle = async (itemId: string, current: ItemStatus) => {
    const next: ItemStatus = current === "pending" ? "bought" : "pending";
    setToggleError(null);
    try {
      await updateItem.mutateAsync({ itemId, status: next });
    } catch {
      setToggleError("Failed to update item.");
    }
  };

  const handleAddItem = async () => {
    if (!newName.trim()) return;
    try {
      await addItem.mutateAsync({
        name: newName.trim(),
        quantity: parseFloat(newQty) || 1,
        unit: newUnit,
      });
      setNewName("");
      setNewQty("1");
      setNewUnit("pcs");
      setShowAdd(false);
    } catch {
      // individual errors surfaced via TanStack Query error state
    }
  };

  const handleComplete = async () => {
    try {
      await completeList.mutateAsync();
      void navigate({ to: "/grocery" });
    } catch {
      // error surfaced via completeList.isError
    }
  };

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleDeleteSelected = async () => {
    const ids = [...checkedIds];
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteItem.mutateAsync(id)));
      const failedIds = ids.filter((_, i) => results[i]?.status === "rejected");
      setCheckedIds(failedIds);
      if (failedIds.length > 0) {
        setDeleteError("Failed to delete some items. Please try again.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameOpen = () => {
    setRenameText(list?.name ?? "");
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    const name = renameText.trim();
    if (!name) {
      return;
    }
    try {
      await renameList.mutateAsync(name);
      setRenameDialogOpen(false);
    } catch {
      // Keep the dialog open on failure; error surfaced via renameList.isError
    }
  };

  const grouped = STATUS_ORDER.reduce<Record<ItemStatus, typeof items>>(
    (acc, status) => {
      acc[status] = (items ?? []).filter((i) => i.status === status);
      return acc;
    },
    { pending: [], bought: [], skipped: [] },
  );

  const allItems = items ?? [];
  const totalCount = allItems.length;
  const doneCount = allItems.filter((i) => i.status === "bought").length;
  const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="mx-auto max-w-[680px] px-8 pb-20 pt-8">
      <button
        type="button"
        onClick={() => void navigate({ to: "/grocery" })}
        className="mb-5 flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
      >
        ← Back to lists
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{list.name}</h1>
          <button
            type="button"
            aria-label="Rename list"
            onClick={handleRenameOpen}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            ✏️
          </button>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(list.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {checkedIds.length > 0 && (
            <div className="flex flex-col items-end">
              <button
                type="button"
                data-testid="delete-selected"
                onClick={() => void handleDeleteSelected()}
                disabled={isDeleting}
                aria-busy={isDeleting}
                className="inline-flex h-9 items-center rounded-lg bg-destructive px-4 text-[13px] font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : `Delete selected (${checkedIds.length})`}
              </button>
              {deleteError && (
                <p role="alert" className="mt-1 text-sm text-destructive">
                  {deleteError}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            aria-expanded={showAdd}
            aria-controls="add-item-panel"
            className="inline-flex h-9 items-center rounded-lg border-[1.5px] border-border bg-card px-4 text-[13px] font-medium hover:bg-muted"
          >
            Add item
          </button>
          {list.status === "active" && (
            <div className="flex flex-col items-end">
              <button
                type="button"
                onClick={() => void handleComplete()}
                disabled={completeList.isPending}
                className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {completeList.isPending ? "Completing…" : "Complete list"}
              </button>
              {completeList.isError && (
                <p role="alert" className="mt-1 text-sm text-destructive">
                  Failed to complete list. Please try again.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <div
          id="add-item-panel"
          className="mb-6 rounded-2xl border-[1.5px] border-border bg-card p-4 shadow-soft"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowAdd(false);
          }}
        >
          <h3 className="mb-3 font-serif text-base font-medium">Add item</h3>
          <div className="flex flex-wrap gap-2">
            <input
              autoFocus
              aria-label="Item name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddItem();
              }}
              placeholder="Item name"
              className="flex h-9 flex-1 rounded-lg border-[1.5px] border-border bg-card px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              aria-label="Quantity"
              type="number"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="flex h-9 w-20 rounded-lg border-[1.5px] border-border bg-card px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              aria-label="Unit"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="Unit"
              className="flex h-9 w-20 rounded-lg border-[1.5px] border-border bg-card px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button
              type="button"
              data-testid="add-item-submit"
              onClick={() => void handleAddItem()}
              disabled={!newName.trim() || addItem.isPending}
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {addItem.isPending ? "Adding…" : "Add"}
            </button>
          </div>
          {addItem.isError && (
            <p role="alert" className="mt-1 text-sm text-destructive">
              Failed to add item. Please try again.
            </p>
          )}
        </div>
      )}

      {toggleError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {toggleError}
        </p>
      )}

      {totalCount > 0 && (
        <div className="mb-6">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-muted-foreground">
              {doneCount} of {totalCount} collected
            </span>
            <span className="font-semibold text-primary">
              {doneCount}/{totalCount}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-secondary">
            <div
              className="h-full rounded bg-primary transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {STATUS_ORDER.map((status) => {
        const group = grouped[status] ?? [];
        if (group.length === 0) return null;
        return (
          <div key={status} className="mb-5">
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {STATUS_LABEL[status]} ({group.length})
            </h2>
            <div className="overflow-hidden rounded-xl border-[1.5px] border-border bg-card shadow-soft">
              {group.map((item) => (
                <div
                  key={item.id}
                  role="group"
                  aria-label={item.name}
                  className={`flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 ${
                    item.status === "bought" ? "opacity-50" : "hover:bg-primary/10"
                  }`}
                >
                  <label
                    className="flex cursor-pointer items-center gap-1"
                    title="Select for deletion"
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.name} for deletion`}
                      data-testid={`select-${item.id}`}
                      checked={checkedIds.includes(item.id)}
                      onChange={() => toggleChecked(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span aria-hidden="true" className="text-xs text-muted-foreground">
                      ✕
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleToggle(item.id, item.status as ItemStatus)}
                    aria-label={
                      item.status === "bought" ? `Uncheck ${item.name}` : `Check ${item.name}`
                    }
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <CheckCircle checked={item.status === "bought"} />
                    <span
                      className={`flex-1 text-sm font-medium ${
                        item.status === "bought" ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {item.name}
                    </span>
                    <span className="text-[13px] tabular-nums text-muted-foreground">
                      {item.quantity} {item.unit}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {(items ?? []).length === 0 && (
        <p className="py-12 text-center text-muted-foreground">No items yet. Add one above.</p>
      )}

      {renameDialogOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="rename-dialog-title"
              className="w-full max-w-sm rounded-2xl border-[1.5px] border-border bg-card p-6 shadow-soft"
            >
              <h2 id="rename-dialog-title" className="mb-4 font-serif text-lg font-semibold">
                Rename list
              </h2>
              <input
                aria-label="List name"
                value={renameText}
                onChange={(e) => setRenameText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (renameText.trim() === "") return;
                    void handleRenameConfirm();
                  }
                }}
                placeholder="List name"
                className="mb-4 flex h-9 w-full rounded-lg border-[1.5px] border-border bg-card px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {renameList.isError && (
                <p role="alert" className="mb-4 text-sm text-destructive">
                  Failed to rename. Please try again.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleRenameCancel}
                  className="inline-flex h-9 items-center rounded-lg border-[1.5px] border-border bg-card px-4 text-[13px] font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleRenameConfirm()}
                  disabled={!renameText.trim() || renameList.isPending}
                  className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {renameList.isPending ? "Saving…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
