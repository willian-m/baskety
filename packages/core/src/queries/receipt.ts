import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { request } from "../api/client.js";
import { useUiStore } from "../stores/uiStore.js";
import type { ScanItemResponse, ScanResponse } from "../api/types.js";

// ── Request shapes ────────────────────────────────────────────────────────────

interface UpdateScanItemRequest {
  status?: string;
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

export function useScan(scanId: string) {
  return useQuery({
    queryKey: ["receipts", scanId],
    queryFn: () => request<ScanResponse>(`/receipts/${scanId}`),
    enabled: !!scanId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 3000 : false;
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

// useStartScan uses fetch directly because the request() helper would strip
// the Content-Type boundary when sending FormData if we set it manually,
// but request() already handles FormData correctly by not setting Content-Type.
// We use request() here since it handles FormData detection.
export function useStartScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const { activeServerUrl, token, activeHouseholdId } = useUiStore.getState();
      const base = activeServerUrl ?? "";
      const fd = new FormData();
      fd.append("image", file);
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (activeHouseholdId) headers.set("X-Household-ID", activeHouseholdId);
      return fetch(`${base}/api/v1/receipts`, {
        method: "POST",
        headers,
        body: fd,
      }).then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          throw new Error(
            typeof body["error"] === "string" ? body["error"] : res.statusText,
          );
        }
        return body["data"] as ScanResponse;
      });
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
        method: "PATCH",
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
    mutationFn: (scanId: string) =>
      request<ScanResponse>(`/receipts/${scanId}/commit`, { method: "POST" }),
    onSuccess: (_data, scanId) => {
      void qc.invalidateQueries({ queryKey: ["receipts"] });
      void qc.invalidateQueries({ queryKey: ["receipts", scanId] });
    },
  });
}
