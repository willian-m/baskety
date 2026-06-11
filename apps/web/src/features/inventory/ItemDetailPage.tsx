import {
  useAddBatch,
  useBatches,
  useInventories,
  useInventoryItem,
  useUpdateItem,
} from "@baskety/core";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";

import { ExpiryBadge } from "./ExpiryBadge.js";

export function ItemDetailPage() {
  const { itemId } = useParams({ from: "/_app/inventory/$itemId" });
  const navigate = useNavigate();

  const { data: inventories } = useInventories();
  const inventoryId = inventories?.[0]?.id ?? "";

  const { data: item, isLoading } = useInventoryItem(inventoryId, itemId);
  const { data: batches } = useBatches(inventoryId, itemId);
  const updateItem = useUpdateItem(inventoryId, itemId);
  const addBatch = useAddBatch(inventoryId, itemId);

  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [showAddBatch, setShowAddBatch] = useState(false);
  const [batchQty, setBatchQty] = useState("");
  const [batchExpiry, setBatchExpiry] = useState("");
  const [batchNotes, setBatchNotes] = useState("");

  if (isLoading || !inventoryId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Item not found.</p>
      </div>
    );
  }

  const startEdit = () => {
    setEditName(item.name);
    setEditCategory(item.category);
    setEditUnit(item.unit);
    setEditTarget(String(item.target_quantity));
    setEditNotes(item.notes ?? "");
    setEditMode(true);
  };

  const handleSave = async () => {
    await updateItem.mutateAsync({
      name: editName,
      category: editCategory,
      unit: editUnit,
      target_quantity: parseFloat(editTarget),
      notes: editNotes || null,
    });
    setEditMode(false);
  };

  const handleAddBatch = async () => {
    await addBatch.mutateAsync({
      quantity: parseFloat(batchQty),
      expires_at: batchExpiry || null,
      notes: batchNotes || null,
    });
    setBatchQty("");
    setBatchExpiry("");
    setBatchNotes("");
    setShowAddBatch(false);
  };

  const totalQty = (batches ?? []).reduce((sum, b) => sum + b.quantity, 0);

  return (
    <div className="p-6">
      <button
        type="button"
        onClick={() => void navigate({ to: "/inventory" })}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to inventory
      </button>

      <div className="mb-6 flex items-start justify-between">
        {editMode ? (
          <div className="flex flex-1 flex-col gap-3 pr-4">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Name"
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="Category"
                className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <input
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value)}
                placeholder="Unit"
                className="flex h-9 w-24 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <input
                type="number"
                value={editTarget}
                onChange={(e) => setEditTarget(e.target.value)}
                placeholder="Target qty"
                className="flex h-9 w-28 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <input
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={updateItem.isPending}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {updateItem.isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.category} · Target: {item.target_quantity} {item.unit}
            </p>
            {item.notes && (
              <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>
            )}
          </div>
        )}
        {!editMode && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
          >
            Edit
          </button>
        )}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Batches{" "}
          <span className="text-sm font-normal text-muted-foreground">
            (total: {totalQty} {item.unit})
          </span>
        </h2>
        <button
          type="button"
          onClick={() => setShowAddBatch((v) => !v)}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add batch
        </button>
      </div>

      {showAddBatch && (
        <div className="mb-4 rounded-lg border p-4">
          <h3 className="mb-3 font-medium">New batch</h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              value={batchQty}
              onChange={(e) => setBatchQty(e.target.value)}
              placeholder="Quantity"
              className="flex h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              type="date"
              value={batchExpiry}
              onChange={(e) => setBatchExpiry(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              value={batchNotes}
              onChange={(e) => setBatchNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => void handleAddBatch()}
              disabled={!batchQty || addBatch.isPending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {addBatch.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {(batches ?? []).length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No batches yet.
        </p>
      ) : (
        <div className="rounded-lg border">
          {(batches ?? []).map((batch, idx) => (
            <div
              key={batch.id}
              className={`flex items-center justify-between px-4 py-3 ${idx !== 0 ? "border-t" : ""}`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {batch.quantity} {item.unit}
                </span>
                {batch.notes && (
                  <span className="text-xs text-muted-foreground">
                    {batch.notes}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ExpiryBadge expiresAt={batch.expires_at} />
                <span className="text-xs text-muted-foreground">
                  {batch.expires_at
                    ? new Date(batch.expires_at).toLocaleDateString()
                    : "No expiry"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
