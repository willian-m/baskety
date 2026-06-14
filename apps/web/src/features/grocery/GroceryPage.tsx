import {
  useArchiveList,
  useAutoGenerateList,
  useCreateList,
  useDeleteList,
  useGroceryLists,
  useInventories,
  useRenameList,
} from "@baskety/core";
import type { GroceryListResponse } from "@baskety/core";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { SetupWizard } from "../inventory/SetupWizard.js";

// ── ListCard ──────────────────────────────────────────────────────────────────

type ListCardProps = {
  list: GroceryListResponse;
  inventoryId: string;
};

function ListCard({ list, inventoryId }: ListCardProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(list.name);

  const renameList = useRenameList(inventoryId, list.id);
  const archiveList = useArchiveList(inventoryId, list.id);
  const deleteList = useDeleteList(inventoryId);

  const handleRename = async () => {
    const name = editName.trim();
    if (!name) return;
    try {
      await renameList.mutateAsync(name);
      setIsEditing(false);
      setMenuOpen(false);
    } catch {
      // mutation error is exposed via renameList.isError / renameList.error
      setIsEditing(false);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveList.mutateAsync();
      setMenuOpen(false);
    } catch {
      setMenuOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${list.name}"?`)) return;
    try {
      await deleteList.mutateAsync(list.id);
      setMenuOpen(false);
    } catch {
      setMenuOpen(false);
    }
  };

  const statusColor: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    completed: "bg-blue-100 text-blue-700",
    archived: "bg-muted text-muted-foreground",
  };

  return (
    <div className="relative border-t first:border-t-0">
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-muted/50"
        onClick={() => void navigate({ to: "/grocery/$listId", params: { listId: list.id } })}
      >
        <div className="flex flex-col gap-0.5">
          {isEditing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRename();
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setEditName(list.name);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-7 rounded border border-input bg-background px-2 py-0.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium">{list.name}</span>
              {list.pinned_at && <span className="text-xs text-muted-foreground">📌</span>}
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(list.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[list.status] ?? ""}`}
          >
            {list.status}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="List options"
          >
            ⋯
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="absolute right-2 top-10 z-10 w-36 rounded-md border bg-background shadow-md">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setMenuOpen(false);
            }}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleArchive();
            }}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
          >
            Archive
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleDelete();
            }}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-muted"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── GroceryPage ───────────────────────────────────────────────────────────────

export function GroceryPage() {
  const [newListName, setNewListName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: inventories, isLoading: loadingInv, isError: invError } = useInventories();
  const inventoryId = inventories?.[0]?.id ?? "";
  const { data: lists, isLoading: loadingLists } = useGroceryLists(inventoryId);
  const createList = useCreateList(inventoryId);
  const autoGenerate = useAutoGenerateList(inventoryId);
  const navigate = useNavigate();

  const handleAutoGenerate = async () => {
    const list = await autoGenerate.mutateAsync();
    await navigate({ to: "/grocery/$listId", params: { listId: list.id } });
  };

  if (loadingInv) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (invError || !inventoryId) {
    return <SetupWizard />;
  }

  if (loadingLists) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newListName.trim()) return;
    await createList.mutateAsync({ name: newListName.trim() });
    setNewListName("");
    setShowCreate(false);
  };

  const sorted = [...(lists ?? [])]
    .filter((l) => l.status !== "archived")
    .sort((a, b) => {
      if (a.pinned_at && !b.pinned_at) return -1;
      if (!a.pinned_at && b.pinned_at) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Grocery Lists</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="auto-generate-button"
            onClick={() => void handleAutoGenerate()}
            disabled={autoGenerate.isPending || !inventoryId}
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {autoGenerate.isPending ? "Generating…" : "Auto-generate"}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New list
          </button>
        </div>
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
          {sorted.map((list) => (
            <ListCard key={list.id} list={list} inventoryId={inventoryId} />
          ))}
        </div>
      )}
    </div>
  );
}
