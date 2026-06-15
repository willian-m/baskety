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
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameText, setRenameText] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);

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
    const focusable = Array.from(el.querySelectorAll<HTMLElement>("input, button"));
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
    return () => document.removeEventListener("keydown", handleKey);
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

  const handleToggle = (itemId: string, current: ItemStatus) => {
    const next: ItemStatus = current === "pending" ? "bought" : "pending";
    void updateItem.mutateAsync({ itemId, status: next });
  };

  const handleAddItem = async () => {
    if (!newName.trim()) return;
    try {
      await addItem.mutateAsync({
        name: newName.trim(),
        quantity: parseFloat(newQty) || 1,
        unit: newUnit,
      });
    } catch {
      // individual errors surfaced via TanStack Query error state
    }
    setNewName("");
    setNewQty("1");
    setNewUnit("pcs");
    setShowAdd(false);
  };

  const handleComplete = async () => {
    try {
      await completeList.mutateAsync();
    } catch {
      // individual errors surfaced via TanStack Query error state
    }
    void navigate({ to: "/grocery" });
  };

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleDeleteSelected = async () => {
    const ids = [...checkedIds];
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteItem.mutateAsync(id)));
    } catch {
      // individual errors surfaced via TanStack Query error state
    } finally {
      setIsDeleting(false);
      setCheckedIds([]);
    }
  };

  const handleRenameOpen = () => {
    setRenameText(list?.name ?? "");
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    const name = renameText.trim();
    if (!name) {
      setRenameDialogOpen(false);
      return;
    }
    try {
      await renameList.mutateAsync(name);
    } catch {
      // ignore
    }
    setRenameDialogOpen(false);
  };

  const grouped = STATUS_ORDER.reduce<Record<ItemStatus, typeof items>>(
    (acc, status) => {
      acc[status] = (items ?? []).filter((i) => i.status === status);
      return acc;
    },
    { pending: [], bought: [], skipped: [] },
  );

  return (
    <div className="p-6">
      <button
        type="button"
        onClick={() => void navigate({ to: "/grocery" })}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to lists
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{list.name}</h1>
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
            <button
              type="button"
              data-testid="delete-selected"
              onClick={() => void handleDeleteSelected()}
              disabled={isDeleting}
              aria-busy={isDeleting}
              className="inline-flex h-9 items-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isDeleting ? "Deleting…" : `Delete selected (${checkedIds.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
          >
            Add item
          </button>
          {list.status === "active" && (
            <button
              type="button"
              onClick={() => void handleComplete()}
              disabled={completeList.isPending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {completeList.isPending ? "Completing…" : "Complete list"}
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <div
          className="mb-6 rounded-lg border p-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowAdd(false);
          }}
        >
          <h3 className="mb-3 font-medium">Add item</h3>
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
              className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              aria-label="Quantity"
              type="number"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="flex h-9 w-20 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              aria-label="Unit"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="Unit"
              className="flex h-9 w-20 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button
              type="button"
              data-testid="add-item-submit"
              onClick={() => void handleAddItem()}
              disabled={!newName.trim() || addItem.isPending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {addItem.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {STATUS_ORDER.map((status) => {
        const group = grouped[status] ?? [];
        if (group.length === 0) return null;
        return (
          <div key={status} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {STATUS_LABEL[status]} ({group.length})
            </h2>
            <div className="rounded-lg border">
              {group.map((item, idx) => (
                <div
                  key={item.id}
                  role="group"
                  aria-label={item.name}
                  className={`flex items-center gap-3 px-4 py-3 ${idx !== 0 ? "border-t" : ""}`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.name}`}
                    data-testid={`select-${item.id}`}
                    checked={checkedIds.includes(item.id)}
                    onChange={() => toggleChecked(item.id)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <input
                    type="checkbox"
                    aria-label={`Mark ${item.name} as bought`}
                    checked={item.status === "bought"}
                    onChange={() => handleToggle(item.id, item.status as ItemStatus)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <div className="flex flex-1 items-center justify-between">
                    <span
                      className={
                        item.status === "bought" ? "text-muted-foreground line-through" : ""
                      }
                    >
                      {item.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {(items ?? []).length === 0 && (
        <p className="py-12 text-center text-muted-foreground">No items yet. Add one above.</p>
      )}

      {renameDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-dialog-title"
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg"
          >
            <h2 id="rename-dialog-title" className="mb-4 text-lg font-semibold">
              Rename list
            </h2>
            <input
              aria-label="List name"
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRenameConfirm();
              }}
              placeholder="List name"
              className="mb-4 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleRenameCancel}
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRenameConfirm()}
                disabled={!renameText.trim() || renameList.isPending}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {renameList.isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
