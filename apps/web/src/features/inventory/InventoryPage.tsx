import { useInventories, useInventoryItems } from "@baskety/core";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "../../components/PageHeader.js";
import { SearchIcon } from "../../components/icons.js";
import { useActiveInventory } from "../../hooks/useActiveInventory.js";

import { InventoryTable } from "./InventoryTable.js";
import { SetupWizard } from "./SetupWizard.js";

export function InventoryPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [newItemName, setNewItemName] = useState("");

  const tableRef = useRef<HTMLDivElement | null>(null);

  const { isLoading: loadingInv, isError: invError } = useInventories();
  const inventoryId = useActiveInventory();
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
    <div className="mx-auto max-w-[1060px] px-8 pb-20 pt-8">
      <PageHeader title="Pantry" subtitle="Track your household inventory and target levels" />

      <div className="mb-5 flex items-center gap-2.5">
        <div className="relative max-w-[300px] flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="search"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border-[1.5px] border-border bg-card px-3 py-1.5 pl-[30px] text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 cursor-pointer rounded-lg border-[1.5px] border-border bg-card px-3 text-[13px] text-secondary-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
            className="inline-flex h-9 items-center whitespace-nowrap rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Add this item
          </button>
        )}
      </div>

      {filtered.length === 0 && newItemName.trim() === "" ? (
        <p className="py-12 text-center text-muted-foreground">No items found.</p>
      ) : (
        <div ref={tableRef}>
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
