import {
  useAddBatch,
  useBatches,
  useCreateItem,
  useUpdateItem,
  type InventoryItemResponse,
  request,
} from "@baskety/core";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment, useState } from "react";

import { ExpiryBadge } from "./ExpiryBadge.js";

type Props = {
  inventoryId: string;
  items: InventoryItemResponse[];
  newItemName: string;
  onNewItemSaved: () => void;
};

const UNCATEGORIZED = "Uncategorized";

const inputClass =
  "h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function InventoryTable({ inventoryId, items, newItemName, onNewItemSaved }: Props) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [addingInCategory, setAddingInCategory] = useState<string | null>(null);

  // Real categories only (no Uncategorized) for autocomplete suggestions.
  const allCategories = Array.from(
    new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c))),
  ).sort((a, b) => a.localeCompare(b));

  // Group already-filtered items by category — InventoryPage owns filtering.
  const categories = Array.from(new Set(items.map((i) => i.category || UNCATEGORIZED))).sort(
    (a, b) => a.localeCompare(b),
  );

  const toggleExpanded = (itemId: string) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const startEditing = (itemId: string) => {
    setEditingItemId(itemId);
  };

  return (
    <>
      <datalist id="category-suggestions">
        {allCategories.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th className="w-8 px-2 py-2" aria-label="Expand" />
            <th className="px-2 py-2">Item</th>
            <th className="w-32 px-2 py-2">Stored Qty</th>
            <th className="w-32 px-2 py-2">Target Qty</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            const inCategory = items
              .filter((i) => (i.category || UNCATEGORIZED) === category)
              .sort((a, b) => a.name.localeCompare(b.name));

            if (inCategory.length === 0) return null;

            return (
              <Fragment key={category}>
                <tr className="bg-muted/40">
                  <td colSpan={4} className="px-2 py-2">
                    <strong className="text-sm font-semibold">{category}</strong>
                  </td>
                </tr>
                {inCategory.map((item) => (
                  <ItemRow
                    key={item.id}
                    inventoryId={inventoryId}
                    item={item}
                    isEditing={editingItemId === item.id}
                    isExpanded={expandedItemIds.has(item.id)}
                    allCategories={allCategories}
                    onStartEditing={() => startEditing(item.id)}
                    onStopEditing={() => setEditingItemId(null)}
                    onToggleExpanded={() => toggleExpanded(item.id)}
                  />
                ))}
                {addingInCategory === category ? (
                  <NewItemRow
                    inventoryId={inventoryId}
                    initialName=""
                    initialCategory={category}
                    allCategories={allCategories}
                    onDone={() => setAddingInCategory(null)}
                    data-testid={`new-item-row-${category}`}
                  />
                ) : (
                  <tr>
                    <td colSpan={4} className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => setAddingInCategory(category)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        + Add item to {category}
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}

          {newItemName.trim() !== "" && (
            <NewItemRow
              inventoryId={inventoryId}
              initialName={newItemName}
              allCategories={allCategories}
              onDone={onNewItemSaved}
            />
          )}
        </tbody>
      </table>
    </>
  );
}

// ── Item row ───────────────────────────────────────────────────────────────────

type ItemRowProps = {
  inventoryId: string;
  item: InventoryItemResponse;
  isEditing: boolean;
  isExpanded: boolean;
  allCategories: string[];
  onStartEditing: () => void;
  onStopEditing: () => void;
  onToggleExpanded: () => void;
};

function ItemRow({
  inventoryId,
  item,
  isEditing,
  isExpanded,
  allCategories: _allCategories, // suggestions come from shared <datalist> — prop kept for API completeness
  onStartEditing,
  onStopEditing,
  onToggleExpanded,
}: ItemRowProps) {
  const updateItem = useUpdateItem(inventoryId, item.id);

  const [name, setName] = useState(item.name);
  const [target, setTarget] = useState(String(item.target_quantity));
  const [unit, setUnit] = useState(item.unit);
  const [category, setCategory] = useState(item.category);
  const [failed, setFailed] = useState(false);

  // When entering edit mode, seed the local form from the latest item values.
  const beginEdit = () => {
    setName(item.name);
    setTarget(String(item.target_quantity));
    setUnit(item.unit);
    setCategory(item.category);
    setFailed(false);
    onStartEditing();
  };

  const save = async () => {
    setFailed(false);
    const savedName = name.trim();
    const savedCategory = category.trim();
    const savedUnit = unit.trim();
    const savedTarget = target;
    try {
      await updateItem.mutateAsync({
        name: savedName,
        category: savedCategory,
        unit: savedUnit,
        target_quantity: parseFloat(savedTarget) || 0,
        notes: item.notes ?? null,
      });
      setName(savedName);
      setCategory(savedCategory);
      setUnit(savedUnit);
      setTarget(savedTarget);
      onStopEditing();
    } catch {
      setFailed(true);
    }
  };

  const cancel = () => {
    setFailed(false);
    onStopEditing();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const canDisclose = item.batch_count > 1;

  if (isEditing) {
    return (
      <>
        <tr
          className={`border-b ${updateItem.isPending ? "pointer-events-none opacity-50" : ""}`}
          data-testid={`item-row-${item.id}`}
        >
          <td className="px-2 py-1" />
          <td className="px-2 py-1">
            <div className="flex flex-col gap-1">
              <input
                autoFocus
                aria-label="Item name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={onKeyDown}
                className={inputClass}
              />
              <div className="flex gap-1">
                <input
                  aria-label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Category"
                  list="category-suggestions"
                  className={inputClass}
                />
                <input
                  aria-label="Unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Unit"
                  className={inputClass}
                />
              </div>
            </div>
          </td>
          <td className="px-2 py-1 text-sm text-muted-foreground">
            {item.stored_quantity} {item.unit}
          </td>
          <td className="px-2 py-1">
            <div className="flex flex-col gap-1">
              <input
                aria-label="Target quantity"
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={onKeyDown}
                className={inputClass}
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={updateItem.isPending}
                  className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
        {failed && (
          <tr>
            <td />
            <td colSpan={3} className="px-2 pb-2">
              <p className="text-xs text-red-600">Save failed</p>
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <>
      <tr
        className="cursor-pointer border-b hover:bg-muted/30"
        data-testid={`item-row-${item.id}`}
        onClick={beginEdit}
      >
        <td className="px-2 py-2">
          {canDisclose && (
            <button
              type="button"
              aria-label={isExpanded ? "Collapse batches" : "Expand batches"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpanded();
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          )}
        </td>
        <td className="px-2 py-2">
          <span className="font-medium">{item.name}</span>
        </td>
        <td className="px-2 py-2 text-sm">
          {item.stored_quantity} {item.unit}
        </td>
        <td className="px-2 py-2 text-sm">
          {item.target_quantity} {item.unit}
        </td>
      </tr>
      {isExpanded && <BatchRows inventoryId={inventoryId} item={item} enabled={isExpanded} />}
    </>
  );
}

// ── Batch sub-rows ──────────────────────────────────────────────────────────────

type BatchRowsProps = {
  inventoryId: string;
  item: InventoryItemResponse;
  enabled: boolean;
};

function BatchRows({ inventoryId, item, enabled }: BatchRowsProps) {
  const { data: batches, isLoading } = useBatches(inventoryId, item.id, enabled);
  const addBatch = useAddBatch(inventoryId, item.id);

  const [adding, setAdding] = useState(false);
  const [qty, setQty] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [failedBatch, setFailedBatch] = useState(false);

  const saveBatch = async () => {
    setFailedBatch(false);
    try {
      await addBatch.mutateAsync({
        quantity: parseFloat(qty) || 0,
        expires_at: expiry || null,
        notes: notes || null,
      });
      setQty("");
      setExpiry("");
      setNotes("");
      setAdding(false);
    } catch {
      setFailedBatch(true);
    }
  };

  if (isLoading) {
    return (
      <tr>
        <td />
        <td colSpan={3} className="px-2 py-2 text-xs text-muted-foreground">
          Loading batches…
        </td>
      </tr>
    );
  }

  const rows = batches ?? [];

  return (
    <>
      {rows.map((batch, idx) => (
        <tr key={batch.id} className="border-b bg-muted/10 text-sm">
          <td className="px-2 py-1" />
          <td className="px-2 py-1 text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span>
                └ Batch {batch.quantity} {item.unit}
              </span>
              <ExpiryBadge expiresAt={batch.expires_at} />
            </span>
          </td>
          <td className="px-2 py-1 text-muted-foreground">
            {batch.expires_at ? new Date(batch.expires_at).toLocaleDateString() : "No expiry"}
          </td>
          <td className="px-2 py-1">
            {idx === rows.length - 1 && (
              <Link
                to="/inventory/$itemId"
                params={{ itemId: item.id }}
                className="text-xs text-primary hover:underline"
              >
                View details →
              </Link>
            )}
          </td>
        </tr>
      ))}

      <tr className="border-b bg-muted/10 text-sm">
        <td className="px-2 py-1" />
        {adding ? (
          <>
            <td className="px-2 py-1" colSpan={3}>
              <div className="flex flex-wrap items-center gap-1">
                <input
                  aria-label="Batch quantity"
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="Qty"
                  className="h-8 w-24 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <input
                  aria-label="Batch expiry"
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <input
                  aria-label="Batch notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes"
                  className="h-8 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  data-testid="add-batch-submit"
                  onClick={() => void saveBatch()}
                  disabled={addBatch.isPending}
                  className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
              {failedBatch && <p className="text-xs text-red-600">Add batch failed</p>}
            </td>
          </>
        ) : (
          <td className="px-2 py-1" colSpan={3}>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-xs text-primary hover:underline"
            >
              + Add batch
            </button>
          </td>
        )}
      </tr>
    </>
  );
}

// ── New item row (search-to-add) ────────────────────────────────────────────────

type NewItemRowProps = {
  inventoryId: string;
  initialName: string;
  initialCategory?: string;
  allCategories: string[];
  onDone: () => void;
  "data-testid"?: string;
};

function NewItemRow({
  inventoryId,
  initialName,
  initialCategory,
  allCategories: _allCategories, // suggestions come from shared <datalist> — prop kept for API completeness
  onDone,
  "data-testid": testId = "new-item-row",
}: NewItemRowProps) {
  const createItem = useCreateItem(inventoryId);
  const qc = useQueryClient();

  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(initialCategory ?? "");
  const [unit, setUnit] = useState("");
  const [target, setTarget] = useState("1");
  const [storedQty, setStoredQty] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [failed, setFailed] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setFailed(false);
    try {
      const item = await createItem.mutateAsync({
        name: name.trim(),
        category: category.trim(),
        unit: unit.trim(),
        target_quantity: parseFloat(target) || 1,
      });
      if (item?.id && parseFloat(storedQty) > 0) {
        await request(`/inventories/${inventoryId}/items/${item.id}/batches`, {
          method: "POST",
          body: JSON.stringify({
            quantity: parseFloat(storedQty),
            expires_at: expiryDate || null,
            notes: null,
          }),
        });
        void qc.invalidateQueries({
          queryKey: ["inventories", inventoryId, "items", item.id, "batches"],
        });
        void qc.invalidateQueries({ queryKey: ["inventories", inventoryId, "items"] });
      }
      onDone();
    } catch {
      setFailed(true);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onDone();
    }
  };

  return (
    <>
      <tr
        className={`border-b bg-primary/5 ${createItem.isPending ? "pointer-events-none opacity-50" : ""}`}
        data-testid={testId}
      >
        <td className="px-2 py-1" />
        <td className="px-2 py-1">
          <div className="flex flex-col gap-1">
            <input
              autoFocus
              aria-label="New item name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Name"
              className={inputClass}
            />
            <div className="flex gap-1">
              <input
                aria-label="New item category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Category"
                list="category-suggestions"
                readOnly={Boolean(initialCategory)}
                className={inputClass}
              />
              <input
                aria-label="New item unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Unit"
                className={inputClass}
              />
            </div>
          </div>
        </td>
        <td className="px-2 py-1">
          <div className="flex flex-col gap-1">
            <input
              aria-label="Initial stored quantity"
              type="number"
              value={storedQty}
              onChange={(e) => setStoredQty(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="0"
              className={inputClass}
            />
            <input
              aria-label="Expiry date"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </td>
        <td className="px-2 py-1">
          <div className="flex flex-col gap-1">
            <input
              aria-label="New item target quantity"
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={onKeyDown}
              className={inputClass}
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => void save()}
                disabled={createItem.isPending || !name.trim()}
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={onDone}
                className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </td>
      </tr>
      {failed && (
        <tr>
          <td />
          <td colSpan={3} className="px-2 pb-2">
            <p className="text-xs text-red-600">Save failed</p>
          </td>
        </tr>
      )}
    </>
  );
}
