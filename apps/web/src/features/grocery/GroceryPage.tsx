import { useState } from "react";

import { useCreateList, useGroceryLists, useInventories } from "@baskety/core";
import { Link } from "@tanstack/react-router";

export function GroceryPage() {
  const [newListName, setNewListName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: inventories, isLoading: loadingInv } = useInventories();
  const inventoryId = inventories?.[0]?.id ?? "";
  const { data: lists, isLoading: loadingLists } = useGroceryLists(inventoryId);
  const createList = useCreateList(inventoryId);

  if (loadingInv || loadingLists) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!inventoryId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">No inventory found.</p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newListName.trim()) return;
    await createList.mutateAsync({ name: newListName.trim() });
    setNewListName("");
    setShowCreate(false);
  };

  const sorted = [...(lists ?? [])].sort((a, b) => {
    if (a.pinned_at && !b.pinned_at) return -1;
    if (!a.pinned_at && b.pinned_at) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const statusColor: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    completed: "bg-blue-100 text-blue-700",
    archived: "bg-muted text-muted-foreground",
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Grocery Lists</h1>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New list
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 flex gap-2">
          <input
            autoFocus
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            placeholder="List name…"
            className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!newListName.trim() || createList.isPending}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createList.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No lists yet. Create one to get started.
        </p>
      ) : (
        <div className="rounded-lg border">
          {sorted.map((list, idx) => (
            <Link
              key={list.id}
              to="/grocery/$listId"
              params={{ listId: list.id }}
              className={`flex items-center justify-between px-4 py-3 hover:bg-muted/50 ${idx !== 0 ? "border-t" : ""}`}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{list.name}</span>
                  {list.pinned_at && (
                    <span className="text-xs text-muted-foreground">📌</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(list.created_at).toLocaleDateString()}
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[list.status] ?? ""}`}
              >
                {list.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
