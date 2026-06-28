import {
  useCommitScan,
  useInventoryItems,
  useScan,
  useScanItems,
  useUpdateScanItem,
} from "@baskety/core";
import type { InventoryItemResponse, ScanItemResponse } from "@baskety/core";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";

import { useActiveInventory } from "../../hooks/useActiveInventory.js";

const PROCESSING_STATUSES = new Set(["uploading", "ocr_processing", "llm_processing"]);

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? "bg-green-500" : score >= 0.5 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

// minorToMajor renders a cents value as a decimal string for an input (or "").
function minorToMajor(minor: number | null): string {
  return minor != null ? String(minor / 100) : "";
}

// majorToMinor parses a decimal-string input back to integer cents, or null.
function majorToMinor(major: string): number | null {
  if (major === "") return null;
  const n = parseFloat(major);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function ScanItemRow({
  item,
  scanId,
  inventoryItems,
}: {
  item: ScanItemResponse;
  scanId: string;
  inventoryItems: InventoryItemResponse[];
}) {
  const update = useUpdateScanItem(scanId);
  const [name, setName] = useState(item.corrected_name ?? item.parsed_name ?? "");
  const [qty, setQty] = useState(String(item.corrected_quantity ?? item.parsed_quantity ?? ""));
  const [unitPrice, setUnitPrice] = useState(
    minorToMajor(item.corrected_price_minor ?? item.parsed_price_minor),
  );
  const [total, setTotal] = useState(
    minorToMajor(item.corrected_total_price_minor ?? item.parsed_total_price_minor),
  );
  const [unit, setUnit] = useState(item.corrected_unit ?? item.parsed_unit ?? "");
  const [inventoryItemId, setInventoryItemId] = useState(item.inventory_item_id ?? "");

  // When the item is linked to an existing inventory item, that item's unit is
  // authoritative — the backend forces it. Display it locked so the user
  // reconciles quantities against it rather than changing the unit.
  const linkedItem = inventoryItems.find((i) => i.id === inventoryItemId);
  const lockedUnit = linkedItem?.unit ?? null;
  const effectiveUnit = lockedUnit ?? unit;

  // Sanity hint: unit price x quantity should equal the line total. Flag a
  // mismatch larger than a rounding cent so the reviewer notices.
  const up = majorToMinor(unitPrice);
  const tot = majorToMinor(total);
  const q = qty !== "" ? parseFloat(qty) : null;
  const priceMismatch =
    up != null && tot != null && q != null && Number.isFinite(q) && q > 0
      ? Math.abs(Math.round(up * q) - tot) > 1
      : false;

  // Reciprocal price math: unit price x quantity = total. Editing any of the
  // three recomputes the dependent field live, so the reviewer only has to fill
  // one price. round2 keeps results at cent precision to avoid float drift.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const handleUnitPriceChange = (value: string) => {
    setUnitPrice(value);
    const p = parseFloat(value);
    const qn = parseFloat(qty);
    if (Number.isFinite(p) && Number.isFinite(qn) && qn > 0) setTotal(String(round2(p * qn)));
  };
  const handleTotalChange = (value: string) => {
    setTotal(value);
    const t = parseFloat(value);
    const qn = parseFloat(qty);
    if (Number.isFinite(t) && Number.isFinite(qn) && qn > 0) setUnitPrice(String(round2(t / qn)));
  };
  const handleQtyChange = (value: string) => {
    setQty(value);
    const qn = parseFloat(value);
    if (!Number.isFinite(qn) || qn <= 0) return;
    const p = parseFloat(unitPrice);
    if (Number.isFinite(p)) {
      setTotal(String(round2(p * qn)));
      return;
    }
    const t = parseFloat(total);
    if (Number.isFinite(t)) setUnitPrice(String(round2(t / qn)));
  };

  // The backend overwrites every corrected_* column on each update, so we must
  // always send the full field set (and the current link) to avoid wiping
  // earlier corrections when only the status changes.
  const submit = (status: "accepted" | "rejected" | "corrected", linkId = inventoryItemId) => {
    const parsedQty = qty !== "" ? parseFloat(qty) : null;
    void update.mutateAsync({
      itemId: item.id,
      body: {
        status,
        inventory_item_id: linkId || null,
        corrected_name: name || null,
        corrected_quantity: parsedQty != null && Number.isFinite(parsedQty) ? parsedQty : null,
        corrected_price_minor: majorToMinor(unitPrice),
        corrected_total_price_minor: majorToMinor(total),
        // When linked, the backend forces the inventory unit; otherwise persist
        // the edited unit.
        corrected_unit: effectiveUnit || null,
      },
    });
  };

  const onLinkChange = (id: string) => {
    setInventoryItemId(id);
    submit("corrected", id);
  };

  const statusColor =
    item.status === "accepted" || item.status === "corrected"
      ? "text-green-700"
      : item.status === "rejected"
        ? "text-red-700"
        : "text-muted-foreground";

  const inputClass =
    "flex h-8 rounded border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50";

  return (
    <tr className="border-t">
      <td className="px-3 py-2 text-xs text-muted-foreground">{item.raw_text}</td>
      <td className="px-3 py-2">
        <input
          aria-label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => submit("corrected")}
          disabled={update.isPending}
          className={`${inputClass} w-full`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          aria-label="Quantity"
          type="number"
          value={qty}
          onChange={(e) => handleQtyChange(e.target.value)}
          onBlur={() => submit("corrected")}
          disabled={update.isPending}
          className={`${inputClass} w-20`}
        />
      </td>
      <td className="px-3 py-2">
        {lockedUnit != null ? (
          <span
            className="inline-flex h-8 items-center rounded bg-muted px-2 text-sm text-muted-foreground"
            title="Unit is fixed by the linked inventory item"
          >
            {lockedUnit || "—"} 🔒
          </span>
        ) : (
          <input
            aria-label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            onBlur={() => submit("corrected")}
            disabled={update.isPending}
            placeholder="ea"
            className={`${inputClass} w-16`}
          />
        )}
      </td>
      <td className="px-3 py-2">
        <input
          aria-label="Unit price"
          type="number"
          step="0.01"
          value={unitPrice}
          onChange={(e) => handleUnitPriceChange(e.target.value)}
          onBlur={() => submit("corrected")}
          disabled={update.isPending}
          className={`${inputClass} w-24`}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            aria-label="Total"
            type="number"
            step="0.01"
            value={total}
            onChange={(e) => handleTotalChange(e.target.value)}
            onBlur={() => submit("corrected")}
            disabled={update.isPending}
            className={`${inputClass} w-24`}
          />
          {priceMismatch && (
            <span
              className="text-yellow-600"
              title="Unit price × quantity does not match the total"
            >
              ⚠
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <select
          aria-label="Inventory item"
          value={inventoryItemId}
          onChange={(e) => onLinkChange(e.target.value)}
          disabled={update.isPending}
          className={`${inputClass} w-40`}
        >
          <option value="">— not linked —</option>
          {inventoryItems.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.name}
              {inv.unit ? ` (${inv.unit})` : ""}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <ConfidenceBadge score={item.confidence_score} />
      </td>
      <td className={`px-3 py-2 text-sm font-medium ${statusColor}`}>{item.status}</td>
      <td className="px-3 py-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => submit("accepted")}
            disabled={item.status === "accepted" || update.isPending}
            className="inline-flex h-7 items-center rounded px-2 text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => submit("rejected")}
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
  const { scanId } = useParams({ from: "/_app/receipt/$scanId/review" });
  const navigate = useNavigate();

  const { data: scan, isLoading: loadingScan } = useScan(scanId);
  const { data: items, isLoading: loadingItems } = useScanItems(scanId);
  const inventoryId = useActiveInventory();
  const { data: inventoryItems } = useInventoryItems(inventoryId);
  const commitScan = useCommitScan();

  const isProcessing = PROCESSING_STATUSES.has(scan?.status ?? "");

  const allReviewed =
    !!items &&
    items.length > 0 &&
    items.every(
      (i) => i.status === "accepted" || i.status === "rejected" || i.status === "corrected",
    );

  const handleCommit = async () => {
    await commitScan.mutateAsync({ scanId, purchasedAt: new Date().toISOString() });
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
              scan.status === "committed"
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
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Unit price</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Inventory item</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ScanItemRow
                  key={`${item.id}-${item.updated_at}`}
                  item={item}
                  scanId={scanId}
                  inventoryItems={inventoryItems ?? []}
                />
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
