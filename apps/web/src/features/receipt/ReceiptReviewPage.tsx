import { useCommitScan, useScan, useScanItems, useUpdateScanItem } from "@baskety/core";
import type { ScanItemResponse } from "@baskety/core";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(score * 100);
  const color = score > 0.8 ? "bg-green-500" : score > 0.5 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

function ScanItemRow({
  item,
  scanId,
}: {
  item: ScanItemResponse;
  scanId: string;
}) {
  const update = useUpdateScanItem(scanId);
  const [name, setName] = useState(item.corrected_name ?? item.parsed_name ?? "");
  const [qty, setQty] = useState(
    String(item.corrected_quantity ?? item.parsed_quantity ?? ""),
  );
  const [price, setPrice] = useState(
    item.corrected_price_minor != null
      ? String(item.corrected_price_minor / 100)
      : item.parsed_price_minor != null
        ? String(item.parsed_price_minor / 100)
        : "",
  );

  const saveCorrections = () => {
    void update.mutateAsync({
      itemId: item.id,
      body: {
        corrected_name: name || null,
        corrected_quantity: qty !== "" ? parseFloat(qty) : null,
        corrected_price_minor: price !== "" ? Math.round(parseFloat(price) * 100) : null,
      },
    });
  };

  const setStatus = (status: "accepted" | "rejected") => {
    void update.mutateAsync({ itemId: item.id, body: { status } });
  };

  const statusColor =
    item.status === "accepted"
      ? "text-green-700"
      : item.status === "rejected"
        ? "text-red-700"
        : "text-muted-foreground";

  return (
    <tr className="border-t">
      <td className="px-3 py-2 text-xs text-muted-foreground">{item.raw_text}</td>
      <td className="px-3 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveCorrections}
          className="flex h-8 w-full rounded border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={saveCorrections}
          className="flex h-8 w-20 rounded border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={saveCorrections}
          className="flex h-8 w-24 rounded border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </td>
      <td className="px-3 py-2">
        <ConfidenceBadge score={item.confidence_score} />
      </td>
      <td className={`px-3 py-2 text-sm font-medium ${statusColor}`}>{item.status}</td>
      <td className="px-3 py-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setStatus("accepted")}
            disabled={item.status === "accepted" || update.isPending}
            className="inline-flex h-7 items-center rounded px-2 text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => setStatus("rejected")}
            disabled={item.status === "rejected" || update.isPending}
            className="inline-flex h-7 items-center rounded px-2 text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </td>
    </tr>
  );
}

export function ReceiptReviewPage() {
  const { scanId } = useParams({ from: "/_app/receipt/$scanId" });
  const navigate = useNavigate();

  const { data: scan, isLoading: loadingScan } = useScan(scanId);
  const { data: items, isLoading: loadingItems } = useScanItems(scanId);
  const commitScan = useCommitScan();

  const isProcessing = scan?.status === "pending" || scan?.status === "processing";

  const allReviewed =
    !!items &&
    items.length > 0 &&
    items.every((i) => i.status === "accepted" || i.status === "rejected");

  const handleCommit = async () => {
    await commitScan.mutateAsync(scanId);
    void navigate({ to: "/receipt" });
  };

  if (loadingScan || loadingItems) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => void navigate({ to: "/receipt" })}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Review Scan</h1>
        {isProcessing && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-0.5 text-sm font-medium text-blue-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            {scan?.status}
          </span>
        )}
        {scan && !isProcessing && (
          <span
            className={`rounded-full px-3 py-0.5 text-sm font-medium ${
              scan.status === "done"
                ? "bg-green-100 text-green-800"
                : scan.status === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {scan.status}
          </span>
        )}
      </div>

      {scan?.error_message && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {scan.error_message}
        </div>
      )}

      {!items || items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {isProcessing ? "Waiting for scan to complete…" : "No items found in this scan."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Raw text</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ScanItemRow key={item.id} item={item} scanId={scanId} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => void handleCommit()}
          disabled={!allReviewed || commitScan.isPending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {commitScan.isPending ? "Committing…" : "Commit to inventory"}
        </button>
      </div>
      {commitScan.isError && (
        <p className="mt-2 text-right text-sm text-red-600">
          {commitScan.error instanceof Error ? commitScan.error.message : "Commit failed"}
        </p>
      )}
    </div>
  );
}
