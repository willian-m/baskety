import { useInventories, useInventoryItems } from "@baskety/core";
import { useEffect, useRef, useState } from "react";

import { InventoryTable } from "./InventoryTable.js";
import { SetupWizard } from "./SetupWizard.js";

export function InventoryPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [newItemName, setNewItemName] = useState("");

  const tableRef = useRef<HTMLDivElement | null>(null);

  const { data: inventories, isLoading: loadingInv, isError: invError } = useInventories();
  const inventoryId = inventories?.[0]?.id ?? "";
  const { data: items, isLoading: loadingItems } = useInventoryItems(inventoryId);

  useEffect(() => {
    if (newItemName.trim() !== "" && tableRef.current?.scrollIntoView) {
      tableRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [newItemName]);

  const handleNewItemSaved = () => {
    setNewItemName("");
    setSearch("");
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

  const allItems = items ?? [];

  const hasUncategorized = allItems.some((i) => !i.category);
  const categories = [
    ...Array.from(new Set(allItems.map((i) => i.category).filter(Boolean))).sort(),
    ...(hasUncategorized ? ["Uncategorized"] : []),
  ];

  const filtered = allItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const effectiveCategory = item.category || "Uncategorized";
    const matchesCategory = !categoryFilter || effectiveCategory === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const showAddThisItem = filtered.length === 0 && search.trim() !== "";

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
      </div>

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
        {showAddThisItem && (
          <button
            type="button"
            onClick={() => setNewItemName(search.trim())}
            className="inline-flex h-9 items-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add this item
          </button>
        )}
      </div>

      {filtered.length === 0 && newItemName.trim() === "" ? (
        <p className="py-12 text-center text-muted-foreground">No items found.</p>
      ) : (
        <div ref={tableRef} className="rounded-lg border">
          <InventoryTable
            inventoryId={inventoryId}
            items={filtered}
            newItemName={newItemName}
            onNewItemSaved={handleNewItemSaved}
          />
        </div>
      )}
    </div>
  );
}
