import { useInventories, useInventoryItems } from "@baskety/core";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { ExpiryBadge } from "./ExpiryBadge.js";

export function InventoryPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const { data: inventories, isLoading: loadingInv } = useInventories();
  const inventoryId = inventories?.[0]?.id ?? "";
  const { data: items, isLoading: loadingItems } = useInventoryItems(inventoryId);

  if (loadingInv || loadingItems) {
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

  const categories = Array.from(
    new Set((items ?? []).map((i) => i.category).filter(Boolean)),
  ).sort();

  const filtered = (items ?? []).filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesCategory =
      !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <Link
          to="/inventory/new"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add item
        </Link>
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
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No items found.
        </p>
      ) : (
        <div className="rounded-lg border">
          {filtered.map((item, idx) => {
            const pct = Math.min(
              100,
              item.target_quantity > 0
                ? Math.round((item.target_quantity / item.target_quantity) * 100)
                : 0,
            );
            const low = item.target_quantity > 0 && pct < 50;
            return (
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
                  <ExpiryBadge expiresAt={null} />
                  <span
                    className={`text-sm font-medium ${low ? "text-destructive" : "text-foreground"}`}
                  >
                    {item.target_quantity} {item.unit}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
