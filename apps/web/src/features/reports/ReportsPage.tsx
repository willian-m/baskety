import { useCatalogEntries, usePriceHistory, useStores } from "@baskety/core";
import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

function formatPrice(minor: number | null, currency: string): string {
  if (minor === null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export function ReportsPage() {
  const [selectedEntryId, setSelectedEntryId] = useState<string>("");

  const { data: entries, isLoading: loadingEntries } = useCatalogEntries();
  const { data: stores, isLoading: loadingStores } = useStores();
  const { data: transactions, isLoading: loadingTx } = usePriceHistory(
    selectedEntryId || undefined,
  );

  const storeMap = new Map((stores ?? []).map((s) => [s.id, s.name]));

  const storeIds = Array.from(
    new Set((transactions ?? []).map((t) => t.store_id).filter((id): id is string => !!id)),
  );

  type ChartRow = Record<string, string | number>;

  const chartData = (() => {
    if (!transactions?.length) return [];

    const byDate = new Map<string, ChartRow>();
    for (const tx of transactions) {
      if (tx.price_per_unit_minor === null) continue;
      const date = tx.purchased_at.slice(0, 10);
      const storeKey = tx.store_id ?? "unknown";
      if (!byDate.has(date)) byDate.set(date, { date });
      const row = byDate.get(date)!;
      row[storeKey] = tx.price_per_unit_minor / 100;
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, row]) => row);
  })();

  if (loadingEntries || loadingStores) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Price History Reports</h1>
      </div>

      <div className="mb-6">
        <label htmlFor="entry-select" className="mb-1 block text-sm font-medium">
          Catalog entry
        </label>
        <select
          id="entry-select"
          value={selectedEntryId}
          onChange={(e) => setSelectedEntryId(e.target.value)}
          className="flex h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Select an item…</option>
          {(entries ?? []).map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
              {entry.brand ? ` (${entry.brand})` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedEntryId && (
        <>
          {loadingTx ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <p className="text-muted-foreground">Loading price history…</p>
            </div>
          ) : !transactions?.length ? (
            <p className="py-12 text-center text-muted-foreground">
              No transactions found for this item.
            </p>
          ) : (
            <>
              <div className="mb-8 rounded-lg border p-4">
                <h2 className="mb-4 text-base font-semibold">Price over time</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(v: number) => v.toFixed(2)}
                      tick={{ fontSize: 12 }}
                      width={60}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        value.toFixed(2),
                        storeMap.get(name) ?? name,
                      ]}
                    />
                    <Legend
                      formatter={(value: string) => storeMap.get(value) ?? value}
                    />
                    {storeIds.map((storeId, i) => (
                      <Line
                        key={storeId}
                        type="monotone"
                        dataKey={storeId}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                      <th className="px-4 py-2 text-left font-medium">Store</th>
                      <th className="px-4 py-2 text-right font-medium">Price / unit</th>
                      <th className="px-4 py-2 text-right font-medium">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, idx) => (
                      <tr
                        key={tx.id}
                        className={idx !== 0 ? "border-t" : ""}
                      >
                        <td className="px-4 py-2 tabular-nums">
                          {tx.purchased_at.slice(0, 10)}
                        </td>
                        <td className="px-4 py-2">
                          {tx.store_id ? (storeMap.get(tx.store_id) ?? tx.store_id) : "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatPrice(tx.price_per_unit_minor, tx.currency)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {tx.quantity ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {!selectedEntryId && (
        <p className="py-12 text-center text-muted-foreground">
          Select a catalog entry above to view price history.
        </p>
      )}
    </div>
  );
}
