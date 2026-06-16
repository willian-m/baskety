import {
  useAddBatch,
  useBatches,
  useCreateItem,
  useDeleteBatch,
  useDeleteItem,
  useMarkBatchEmptied,
  usePatchBatch,
  useRenameCategory,
  useUpdateItem,
  type BatchResponse,
  type InventoryItemResponse,
} from "@baskety/core";
import { Fragment, useEffect, useRef, useState } from "react";

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="size-4"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

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

// ── Category combobox ──────────────────────────────────────────────────────────

type CategoryComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  "aria-label"?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

function CategoryCombobox({
  value,
  onChange,
  options,
  placeholder,
  readOnly,
  className,
  "aria-label": ariaLabel,
  onKeyDown,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // Only filter after the user starts typing; on focus show all options.
  const [filtering, setFiltering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = filtering
    ? options.filter((opt) => opt.toLowerCase().includes(value.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlightedIndex((i) => (i < filtered.length - 1 ? i + 1 : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlightedIndex((i) => (i > 0 ? i - 1 : filtered.length - 1));
      return;
    }
    if (e.key === "Enter") {
      if (open && highlightedIndex >= 0 && filtered[highlightedIndex]) {
        // Select highlighted suggestion; don't propagate so the item doesn't save yet.
        e.preventDefault();
        onChange(filtered[highlightedIndex]);
        setOpen(false);
        setHighlightedIndex(-1);
        setFiltering(false);
        return;
      }
      // No suggestion highlighted — close dropdown and let parent handle save.
      setOpen(false);
      onKeyDown?.(e);
      return;
    }
    if (e.key === "Escape") {
      if (open) {
        // Close dropdown without cancelling the enclosing edit session.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setHighlightedIndex(-1);
        return;
      }
    }
    onKeyDown?.(e);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setFiltering(true);
        }}
        onFocus={() => {
          setOpen(true);
          setFiltering(false);
        }}
        onKeyDown={handleKey}
        placeholder={placeholder}
        readOnly={readOnly}
        className={className}
      />
      {open && !readOnly && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-auto rounded border bg-background shadow-md max-h-48"
        >
          {filtered.map((opt, i) => (
            <li
              key={opt}
              role="option"
              aria-selected={i === highlightedIndex}
              className={`cursor-pointer px-3 py-1.5 text-sm ${i === highlightedIndex ? "bg-accent" : "hover:bg-muted"}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt);
                setOpen(false);
                setHighlightedIndex(-1);
                setFiltering(false);
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Category header row ────────────────────────────────────────────────────────

type CategoryHeaderRowProps = {
  category: string;
  items: InventoryItemResponse[];
  onRename: (args: { to: string; items: InventoryItemResponse[] }) => void;
  isPending: boolean;
};

function CategoryHeaderRow({ category, items, onRename, isPending }: CategoryHeaderRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category);

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
    <tr
      className={`bg-muted/40 ${isPending ? "opacity-60" : ""} ${!editing ? "cursor-pointer" : ""}`}
      onClick={() => {
        if (!editing) {
          setDraft(category);
          setEditing(true);
        }
      }}
    >
      <td colSpan={4} className="px-2 py-2">
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
      </td>
    </tr>
  );
}

export function InventoryTable({ inventoryId, items, newItemName, onNewItemSaved }: Props) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [addingInCategory, setAddingInCategory] = useState<string | null>(null);
  const [addingBatchItemId, setAddingBatchItemId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteItem = useDeleteItem(inventoryId);
  const renameCategory = useRenameCategory(inventoryId);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const allVisibleSelected = items.length > 0 && items.every((i) => selectedItemIds.has(i.id));
  const someSelected = selectedItemIds.size > 0 && !allVisibleSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

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

  function toggleSelect(itemId: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function handleDeleteSingle(id: string) {
    setSelectedItemIds(new Set([id]));
    setShowDeleteModal(true);
  }

  async function handleConfirmDelete() {
    const ids = [...selectedItemIds];
    const results = await Promise.allSettled(ids.map((id) => deleteItem.mutateAsync(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      setDeleteError(`${failed} item${failed !== 1 ? "s" : ""} could not be deleted.`);
      setSelectedItemIds(new Set(ids.filter((_, i) => results[i]!.status === "rejected")));
      setShowDeleteModal(false);
    } else {
      setDeleteError(null);
      setSelectedItemIds(new Set());
      setShowDeleteModal(false);
    }
  }

  return (
    <>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th className="w-16 px-2 py-2">
              <input
                type="checkbox"
                ref={selectAllRef}
                aria-label="Select all items"
                checked={allVisibleSelected}
                onChange={() => {
                  if (allVisibleSelected) {
                    setSelectedItemIds(new Set());
                  } else {
                    setSelectedItemIds(new Set(items.map((i) => i.id)));
                  }
                }}
              />
            </th>
            <th className="px-2 py-2">
              {selectedItemIds.size > 0 ? (
                <>
                  {deleteError && <p className="mb-1 text-xs text-red-600">{deleteError}</p>}
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Delete {selectedItemIds.size} item{selectedItemIds.size !== 1 ? "s" : ""}
                  </button>
                </>
              ) : (
                "Item"
              )}
            </th>
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
                <CategoryHeaderRow
                  category={category}
                  items={inCategory}
                  onRename={renameCategory.mutate}
                  isPending={renameCategory.isPending}
                />
                {inCategory.map((item) => (
                  <ItemRow
                    key={item.id}
                    inventoryId={inventoryId}
                    item={item}
                    isEditing={editingItemId === item.id}
                    isExpanded={expandedItemIds.has(item.id)}
                    isSelected={selectedItemIds.has(item.id)}
                    allCategories={allCategories}
                    initiallyAdding={addingBatchItemId === item.id}
                    onStartEditing={() => startEditing(item.id)}
                    onStopEditing={() => setEditingItemId(null)}
                    onToggleExpanded={() => toggleExpanded(item.id)}
                    onSelect={toggleSelect}
                    onDeleteSingle={handleDeleteSingle}
                    onStartAddBatch={() => {
                      setExpandedItemIds((prev) => {
                        const next = new Set(prev);
                        next.add(item.id);
                        return next;
                      });
                      setAddingBatchItemId(item.id);
                    }}
                    onAddingBatchDone={() => setAddingBatchItemId(null)}
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

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowDeleteModal(false);
          }}
          tabIndex={-1}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl"
          >
            <h2 id="delete-modal-title" className="text-lg font-semibold">
              Delete {selectedItemIds.size} item{selectedItemIds.size !== 1 ? "s" : ""}?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will permanently remove the selected items and all their batches. This action is
              irreversible.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                autoFocus
                className="rounded px-4 py-2 text-sm"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                onClick={() => void handleConfirmDelete()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Item row ───────────────────────────────────────────────────────────────────

type ItemRowProps = {
  inventoryId: string;
  item: InventoryItemResponse;
  isEditing: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  allCategories: string[];
  initiallyAdding: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onToggleExpanded: () => void;
  onSelect: (itemId: string) => void;
  onDeleteSingle: (itemId: string) => void;
  onStartAddBatch: () => void;
  onAddingBatchDone: () => void;
};

function ItemRow({
  inventoryId,
  item,
  isEditing,
  isExpanded,
  isSelected,
  allCategories,
  initiallyAdding,
  onStartEditing,
  onStopEditing,
  onToggleExpanded,
  onSelect,
  onDeleteSingle,
  onStartAddBatch,
  onAddingBatchDone,
}: ItemRowProps) {
  const updateItem = useUpdateItem(inventoryId, item.id);
  const { data: batchesData } = useBatches(inventoryId, item.id, isEditing);
  const patchBatch = usePatchBatch(inventoryId, item.id);

  const [name, setName] = useState(item.name);
  const [target, setTarget] = useState(String(item.target_quantity));
  const [unit, setUnit] = useState(item.unit);
  const [category, setCategory] = useState(item.category);
  const [failed, setFailed] = useState(false);
  const [batchQty, setBatchQty] = useState("");
  const [batchExpiry, setBatchExpiry] = useState("");
  const seededForEdit = useRef(false);

  // Seed batch fields when entering edit mode with a single batch.
  // Guard with a ref so background refetches don't overwrite typed values.
  useEffect(() => {
    if (!isEditing) {
      seededForEdit.current = false;
      return;
    }
    if (batchesData?.[0] && !seededForEdit.current) {
      setBatchQty(String(batchesData[0].quantity));
      setBatchExpiry(batchesData[0].expires_at ? batchesData[0].expires_at.slice(0, 10) : "");
      seededForEdit.current = true;
    }
  }, [isEditing, batchesData]);

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
      await Promise.all([
        updateItem.mutateAsync({
          name: savedName,
          category: savedCategory,
          unit: savedUnit,
          target_quantity: parseFloat(savedTarget) || 0,
          notes: item.notes ?? null,
        }),
        ...(item.batch_count === 1 && batchesData?.[0]
          ? [
              patchBatch.mutateAsync({
                batchId: batchesData[0].id,
                quantity: parseFloat(batchQty) || 0,
                expires_at: batchExpiry ? `${batchExpiry}T00:00:00Z` : null,
              }),
            ]
          : []),
      ]);
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
  const isPending = updateItem.isPending || patchBatch.isPending;
  const isSaveDisabled = isPending || (isEditing && item.batch_count === 1 && !batchesData?.[0]);

  if (isEditing) {
    return (
      <>
        <tr
          className={`border-b ${isPending ? "pointer-events-none opacity-50" : ""}`}
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
                <CategoryCombobox
                  aria-label="Category"
                  value={category}
                  onChange={setCategory}
                  options={allCategories}
                  onKeyDown={onKeyDown}
                  placeholder="Category"
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
          <td className="px-2 py-1">
            {item.batch_count === 1 ? (
              <div className="flex flex-col gap-1">
                <input
                  aria-label="Stored quantity"
                  type="number"
                  value={batchQty}
                  onChange={(e) => setBatchQty(e.target.value)}
                  onKeyDown={onKeyDown}
                  className={inputClass}
                />
                <input
                  aria-label="Expiry date"
                  type="date"
                  value={batchExpiry}
                  onChange={(e) => setBatchExpiry(e.target.value)}
                  className={inputClass}
                />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                {item.stored_quantity} {item.unit}
              </span>
            )}
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
                  disabled={isSaveDisabled}
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
        className={`group cursor-pointer border-b hover:bg-muted/30 ${isSelected ? "bg-blue-50 ring-1 ring-blue-300" : ""}`}
        data-testid={`item-row-${item.id}`}
        onClick={beginEdit}
        onContextMenu={(e) => {
          e.preventDefault();
          onSelect(item.id);
        }}
      >
        <td className="px-2 py-2">
          <span className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              aria-label={`Select ${item.name}`}
              checked={isSelected}
              onChange={() => onSelect(item.id)}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              aria-label="Add a new batch"
              title="Add a new batch"
              onClick={(e) => {
                e.stopPropagation();
                onStartAddBatch();
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              +
            </button>
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
          </span>
        </td>
        <td className="px-2 py-2">
          <span className="font-medium">{item.name}</span>
        </td>
        <td className="px-2 py-2 text-sm">
          {item.stored_quantity} {item.unit}
        </td>
        <td className="px-2 py-2 text-sm">
          <span className="inline-flex items-center justify-between gap-2">
            <span>
              {item.target_quantity} {item.unit}
            </span>
            <button
              type="button"
              aria-label={`Delete ${item.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSingle(item.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
            >
              <TrashIcon />
            </button>
          </span>
        </td>
      </tr>
      {isExpanded && (
        <BatchRows
          inventoryId={inventoryId}
          item={item}
          enabled={isExpanded}
          initiallyAdding={initiallyAdding}
          onAddingDone={onAddingBatchDone}
        />
      )}
    </>
  );
}

// ── Batch sub-rows ──────────────────────────────────────────────────────────────

type BatchRowsProps = {
  inventoryId: string;
  item: InventoryItemResponse;
  enabled: boolean;
  initiallyAdding: boolean;
  onAddingDone: () => void;
};

function BatchRows({ inventoryId, item, enabled, initiallyAdding, onAddingDone }: BatchRowsProps) {
  const { data: batches, isLoading } = useBatches(inventoryId, item.id, enabled);
  const addBatch = useAddBatch(inventoryId, item.id);
  const markEmptied = useMarkBatchEmptied(inventoryId, item.id);
  const deleteBatch = useDeleteBatch(inventoryId, item.id);

  const [adding, setAdding] = useState(false);
  const [removingBatch, setRemovingBatch] = useState<BatchResponse | null>(null);
  const [qty, setQty] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [failedBatch, setFailedBatch] = useState(false);

  // Open add form automatically when triggered via "+" button.
  useEffect(() => {
    if (initiallyAdding) {
      setAdding(true);
    }
  }, [initiallyAdding]);

  const saveBatch = async () => {
    setFailedBatch(false);
    try {
      await addBatch.mutateAsync({
        quantity: parseFloat(qty) || 0,
        expires_at: expiry ? `${expiry}T00:00:00Z` : null,
        notes: notes || null,
      });
      setQty("");
      setExpiry("");
      setNotes("");
      setAdding(false);
      onAddingDone();
    } catch {
      setFailedBatch(true);
    }
  };

  const cancelAdding = () => {
    setAdding(false);
    onAddingDone();
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
      {rows.map((batch) => (
        <tr key={batch.id} className="group border-b bg-muted/10 text-sm">
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
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                aria-label="Remove batch"
                onClick={(e) => {
                  e.stopPropagation();
                  setRemovingBatch(batch);
                }}
                className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-red-600 focus-visible:opacity-100"
              >
                <TrashIcon />
              </button>
            </div>
          </td>
        </tr>
      ))}

      {removingBatch && (
        <tr>
          <td colSpan={4}>
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-batch-title"
            >
              <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl">
                <h2 id="remove-batch-title" className="text-lg font-semibold">
                  Remove this batch?
                </h2>
                <div className="mt-4 flex flex-col gap-3">
                  <div>
                    <button
                      type="button"
                      disabled={markEmptied.isPending || deleteBatch.isPending}
                      onClick={() => {
                        void markEmptied
                          .mutateAsync(removingBatch.id)
                          .then(() => setRemovingBatch(null));
                      }}
                      className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                    >
                      Mark as consumed
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Removes it from active stock. The record is kept for history.
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={markEmptied.isPending || deleteBatch.isPending}
                      onClick={() => {
                        void deleteBatch
                          .mutateAsync(removingBatch.id)
                          .then(() => setRemovingBatch(null));
                      }}
                      className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Delete permanently
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Removes the record entirely. This cannot be undone.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemovingBatch(null)}
                    className="text-sm text-muted-foreground hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}

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
                  onClick={cancelAdding}
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
  allCategories,
  onDone,
  "data-testid": testId = "new-item-row",
}: NewItemRowProps) {
  const createItem = useCreateItem(inventoryId);

  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(initialCategory ?? "");
  const [unit, setUnit] = useState("");
  const [target, setTarget] = useState("1");
  const [storedQty, setStoredQty] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [failed, setFailed] = useState(false);
  const [failedMessage, setFailedMessage] = useState("Save failed");

  const save = async () => {
    if (!name.trim()) return;
    setFailed(false);
    try {
      await createItem.mutateAsync({
        name: name.trim(),
        category: category.trim(),
        unit: unit.trim(),
        target_quantity: parseFloat(target) || 1,
        initial_quantity: parseFloat(storedQty) || 0,
        initial_expires_at: expiryDate ? `${expiryDate}T00:00:00Z` : null,
      });
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("already exists in this category")) {
        setFailedMessage("An item with this name already exists in this category");
      } else {
        setFailedMessage("Save failed");
      }
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
              <CategoryCombobox
                aria-label="New item category"
                value={category}
                onChange={setCategory}
                options={allCategories}
                onKeyDown={onKeyDown}
                placeholder="Category"
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
            <p className="text-xs text-red-600">{failedMessage}</p>
          </td>
        </tr>
      )}
    </>
  );
}
