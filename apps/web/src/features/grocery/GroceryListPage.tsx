import {
  useAddListItem,
  useCompleteList,
  useGroceryItems,
  useGroceryList,
  useInventories,
  useUpdateListItem,
} from "@baskety/core";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";

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

  const { data: inventories } = useInventories();
  const inventoryId = inventories?.[0]?.id ?? "";

  const { data: list, isLoading: loadingList } = useGroceryList(inventoryId, listId);
  const { data: items, isLoading: loadingItems } = useGroceryItems(inventoryId, listId);
  const updateItem = useUpdateListItem(inventoryId, listId);
  const addItem = useAddListItem(inventoryId, listId);
  const completeList = useCompleteList(inventoryId, listId);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newUnit, setNewUnit] = useState("pcs");

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
    await addItem.mutateAsync({
      name: newName.trim(),
      quantity: parseFloat(newQty) || 1,
      unit: newUnit,
    });
    setNewName("");
    setNewQty("1");
    setNewUnit("pcs");
    setShowAdd(false);
  };

  const handleComplete = async () => {
    await completeList.mutateAsync();
    void navigate({ to: "/grocery" });
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{list.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(list.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
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
        <div className="mb-6 rounded-lg border p-4">
          <h3 className="mb-3 font-medium">Add item</h3>
          <div className="flex flex-wrap gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddItem();
              }}
              placeholder="Item name"
              className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              type="number"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="flex h-9 w-20 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
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
                  className={`flex items-center gap-3 px-4 py-3 ${idx !== 0 ? "border-t" : ""}`}
                >
                  <input
                    type="checkbox"
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
    </div>
  );
}
