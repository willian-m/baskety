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

import { PageHeader } from "../../components/PageHeader.js";
import { Tag } from "../../components/Tag.js";
import { useActiveInventory } from "../../hooks/useActiveInventory.js";
import { SetupWizard } from "../inventory/SetupWizard.js";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

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

  return (
    <div className="relative">
      <div
        className="cursor-pointer rounded-2xl border-[1.5px] border-border bg-card p-[22px] shadow-soft transition-shadow hover:shadow-md"
        onClick={() => void navigate({ to: "/grocery/$listId", params: { listId: list.id } })}
      >
        <div className="mb-3 flex items-center justify-between">
          <Tag>
            {list.status === "active" ? "List" : (STATUS_LABEL[list.status] ?? list.status)}
          </Tag>
          <span className="text-xs text-muted-foreground">
            {new Date(list.created_at).toLocaleDateString()}
          </span>
        </div>
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
          <div className="mb-2 flex items-center gap-2">
            <span className="font-serif text-[17px] font-medium">{list.name}</span>
            {list.pinned_at && <span className="text-xs text-muted-foreground">📌</span>}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted-foreground">
            {STATUS_LABEL[list.status] ?? list.status}
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
            className="block w-full px-4 py-2 text-left text-sm text-destructive hover:bg-muted"
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

  const { isLoading: loadingInv, isError: invError } = useInventories();
  const inventoryId = useActiveInventory();
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
    <div className="mx-auto max-w-[1060px] px-8 pb-20 pt-8">
      <PageHeader
        title="Grocery Lists"
        subtitle="Auto-generated and manual shopping lists"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="auto-generate-button"
              onClick={() => void handleAutoGenerate()}
              disabled={autoGenerate.isPending || !inventoryId}
              className="inline-flex h-[38px] items-center rounded-lg border-[1.5px] border-border bg-card px-4 text-[13px] font-medium hover:bg-muted disabled:opacity-50"
            >
              {autoGenerate.isPending ? "Generating…" : "Auto-generate"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex h-[38px] items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              + New list
            </button>
          </div>
        }
      />

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
            className="h-9 flex-1 rounded-lg border-[1.5px] border-border bg-card px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!newListName.trim() || createList.isPending}
            className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {sorted.map((list) => (
            <ListCard key={list.id} list={list} inventoryId={inventoryId} />
          ))}
        </div>
      )}
    </div>
  );
}
