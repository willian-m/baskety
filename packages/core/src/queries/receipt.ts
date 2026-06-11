import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { request } from "../api/client.js";
import type { ScanItemResponse, ScanResponse } from "../api/types.js";

// ── Request shapes ────────────────────────────────────────────────────────────

// Backend-defined scan status values (model.go).
type ScanStatus = "uploading" | "ocr_processing" | "llm_processing" | "pending_review" | "committed" | "failed";

// Backend-defined scan item status values (model.go).
type ScanItemStatus = "pending" | "accepted" | "rejected" | "corrected";

interface UpdateScanItemRequest {
  status: ScanItemStatus;
  corrected_name?: string | null;
  corrected_brand?: string | null;
  corrected_quantity?: number | null;
  corrected_price_minor?: number | null;
  corrected_currency?: string | null;
  corrected_store_name?: string | null;
}

// ── Scans ─────────────────────────────────────────────────────────────────────

export function useScans() {
  return useQuery({
    queryKey: ["receipts"],
    queryFn: () => request<ScanResponse[]>("/receipts"),
  });
}

const POLLING_STATUSES = new Set<ScanStatus>(["uploading", "ocr_processing", "llm_processing"]);

export function useScan(scanId: string) {
  return useQuery({
    queryKey: ["receipts", scanId],
    queryFn: () => request<ScanResponse>(`/receipts/${scanId}`),
    enabled: !!scanId,
    refetchInterval: (query) => {
      const status = query.state.data?.status as ScanStatus | undefined;
      return status && POLLING_STATUSES.has(status) ? 3000 : false;
    },
  });
}

export function useScanItems(scanId: string) {
  return useQuery({
    queryKey: ["receipts", scanId, "items"],
    queryFn: () => request<ScanItemResponse[]>(`/receipts/${scanId}/items`),
    enabled: !!scanId,
  });
}

// request() already skips Content-Type for FormData bodies (client.ts:9-15),
// so we can route through it directly rather than duplicating the auth/header logic.
export function useStartScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("image", file);
      return request<ScanResponse>("/receipts", { method: "POST", body: fd });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["receipts"] });
    },
  });
}

export function useUpdateScanItem(scanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: UpdateScanItemRequest }) =>
      request<ScanItemResponse>(`/receipts/${scanId}/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["receipts", scanId, "items"] });
    },
  });
}

export function useCommitScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scanId, purchasedAt }: { scanId: string; purchasedAt: string }) =>
      request<ScanResponse>(`/receipts/${scanId}/commit`, {
        method: "POST",
        body: JSON.stringify({ purchased_at: purchasedAt }),
      }),
    onSuccess: (_data, { scanId }) => {
      void qc.invalidateQueries({ queryKey: ["receipts"] });
      void qc.invalidateQueries({ queryKey: ["receipts", scanId] });
    },
  });
}
