import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { request, requestShare } from "../api/client.js";
import type {
  BatchResponse,
  InventoryItemResponse,
  InventoryResponse,
  ShareInventoryResponse,
} from "../api/types.js";

// ── Request shapes ────────────────────────────────────────────────────────────

interface CreateItemRequest {
  name: string;
  category: string;
  unit: string;
  target_quantity: number;
  notes?: string | null;
}

interface UpdateItemRequest {
  name: string;
  category: string;
  unit: string;
  target_quantity: number;
  notes?: string | null;
}

interface CreateBatchRequest {
  quantity: number;
  expires_at?: string | null;
  notes?: string | null;
}

// ── Inventories ───────────────────────────────────────────────────────────────

export function useInventories() {
  return useQuery({
    queryKey: ["inventories"],
    queryFn: () => request<InventoryResponse[]>("/inventories"),
  });
}

export function useCreateInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string | null }) =>
      request<InventoryResponse>("/inventories", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventories"] });
    },
  });
}

export function useInventory(inventoryId: string) {
  return useQuery({
    queryKey: ["inventories", inventoryId],
    queryFn: () => request<InventoryResponse>(`/inventories/${inventoryId}`),
    enabled: !!inventoryId,
  });
}

// ── Items ─────────────────────────────────────────────────────────────────────

export function useInventoryItems(inventoryId: string) {
  return useQuery({
    queryKey: ["inventories", inventoryId, "items"],
    queryFn: () => request<InventoryItemResponse[]>(`/inventories/${inventoryId}/items`),
    enabled: !!inventoryId,
  });
}

export function useInventoryItem(inventoryId: string, itemId: string) {
  return useQuery({
    queryKey: ["inventories", inventoryId, "items", itemId],
    queryFn: () => request<InventoryItemResponse>(`/inventories/${inventoryId}/items/${itemId}`),
    enabled: !!inventoryId && !!itemId,
  });
}

export function useCreateItem(inventoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateItemRequest) =>
      request<InventoryItemResponse>(`/inventories/${inventoryId}/items`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["inventories", inventoryId, "items"],
      });
    },
  });
}

export function useUpdateItem(inventoryId: string, itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateItemRequest) =>
      request<InventoryItemResponse>(`/inventories/${inventoryId}/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["inventories", inventoryId, "items"],
      });
    },
  });
}

export function useDeleteItem(inventoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      request<void>(`/inventories/${inventoryId}/items/${itemId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["inventories", inventoryId, "items"],
      });
    },
  });
}

// ── Share ─────────────────────────────────────────────────────────────────────

export function useShareInventory(token: string, password?: string) {
  return useQuery({
    queryKey: ["share", token],
    queryFn: () =>
      requestShare<ShareInventoryResponse>(`/api/v1/share/${token}/inventory`, password),
    enabled: !!token,
    retry: false,
  });
}

// ── Batches ───────────────────────────────────────────────────────────────────

export function useBatches(inventoryId: string, itemId: string) {
  return useQuery({
    queryKey: ["inventories", inventoryId, "items", itemId, "batches"],
    queryFn: () => request<BatchResponse[]>(`/inventories/${inventoryId}/items/${itemId}/batches`),
    enabled: !!inventoryId && !!itemId,
  });
}

export function useAddBatch(inventoryId: string, itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBatchRequest) =>
      request<BatchResponse>(`/inventories/${inventoryId}/items/${itemId}/batches`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["inventories", inventoryId, "items", itemId, "batches"],
      });
      void qc.invalidateQueries({
        queryKey: ["inventories", inventoryId, "items"],
      });
    },
  });
}
