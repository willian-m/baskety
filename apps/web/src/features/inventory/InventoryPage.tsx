import { useCreateItem, useInventories, useInventoryItems } from "@baskety/core";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { SetupWizard } from "./SetupWizard.js";

export function InventoryPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newTarget, setNewTarget] = useState("1");

  const { data: inventories, isLoading: loadingInv, isError: invError } = useInventories();
  const inventoryId = inventories?.[0]?.id ?? "";
  const { data: items, isLoading: loadingItems } = useInventoryItems(inventoryId);
  const createItem = useCreateItem(inventoryId);

  const handleAddItem = async () => {
    if (!newName.trim() || !newCategory.trim() || !newUnit.trim()) return;
    await createItem.mutateAsync({
      name: newName.trim(),
      category: newCategory.trim(),
      unit: newUnit.trim(),
      target_quantity: parseFloat(newTarget) || 1,
    });
    setNewName("");
    setNewCategory("");
    setNewUnit("");
    setNewTarget("1");
    setShowAdd(false);
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

  if (loadingItems) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const categories = Array.from(
    new Set((items ?? []).map((i) => i.category).filter(Boolean)),
  ).sort();

  const filtered = (items ?? []).filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add item
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 rounded-lg border p-4">
          <h3 className="mb-3 font-medium">New item</h3>
          <div className="flex flex-wrap gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Category"
              className="flex h-9 w-36 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="Unit (e.g. kg)"
              className="flex h-9 w-28 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              type="number"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="Target qty"
              className="flex h-9 w-24 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button
              type="button"
              data-testid="add-item-submit"
              onClick={() => void handleAddItem()}
              disabled={
                !newName.trim() || !newCategory.trim() || !newUnit.trim() || createItem.isPending
              }
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createItem.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-3">
        <input
          type="search"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No items found.</p>
      ) : (
        <div className="rounded-lg border">
          {filtered.map((item, idx) => (
            <Link
              key={item.id}
              to="/inventory/$itemId"
              params={{ itemId: item.id }}
              className={`flex items-center justify-between px-4 py-3 hover:bg-muted/50 ${idx !== 0 ? "border-t" : ""}`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.category}
                  {item.notes ? ` · ${item.notes}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">
                  {item.target_quantity} {item.unit}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
