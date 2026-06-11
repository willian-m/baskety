import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { request } from "../api/client.js";
import type { GroceryItemResponse, GroceryListResponse } from "../api/types.js";

// ── Request shapes ────────────────────────────────────────────────────────────

interface CreateGroceryListRequest {
  name: string;
}

interface CreateGroceryItemRequest {
  name: string;
  quantity: number;
  unit: string;
  notes?: string | null;
  inventory_item_id?: string | null;
}

// ── Lists ─────────────────────────────────────────────────────────────────────

export function useGroceryLists(inventoryId: string) {
  return useQuery({
    queryKey: ["inventories", inventoryId, "lists"],
    queryFn: () =>
      request<GroceryListResponse[]>(`/inventories/${inventoryId}/lists`),
    enabled: !!inventoryId,
  });
}

export function useGroceryList(inventoryId: string, listId: string) {
  return useQuery({
    queryKey: ["inventories", inventoryId, "lists", listId],
    queryFn: () =>
      request<GroceryListResponse>(
        `/inventories/${inventoryId}/lists/${listId}`,
      ),
    enabled: !!inventoryId && !!listId,
  });
}

export function useCreateList(inventoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGroceryListRequest) =>
      request<GroceryListResponse>(`/inventories/${inventoryId}/lists`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["inventories", inventoryId, "lists"],
      });
    },
  });
}

export function useCompleteList(inventoryId: string, listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<GroceryListResponse>(
        `/inventories/${inventoryId}/lists/${listId}/complete`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["inventories", inventoryId, "lists"],
      });
    },
  });
}

// ── List items ────────────────────────────────────────────────────────────────

export function useGroceryItems(inventoryId: string, listId: string) {
  return useQuery({
    queryKey: ["inventories", inventoryId, "lists", listId, "items"],
    queryFn: () =>
      request<GroceryItemResponse[]>(
        `/inventories/${inventoryId}/lists/${listId}/items`,
      ),
    enabled: !!inventoryId && !!listId,
  });
}

export function useAddListItem(inventoryId: string, listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGroceryItemRequest) =>
      request<GroceryItemResponse>(
        `/inventories/${inventoryId}/lists/${listId}/items`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["inventories", inventoryId, "lists", listId, "items"],
      });
    },
  });
}

export function useUpdateListItem(inventoryId: string, listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      status,
    }: {
      itemId: string;
      status: "pending" | "bought" | "skipped";
    }) =>
      request<GroceryItemResponse>(
        `/inventories/${inventoryId}/lists/${listId}/items/${itemId}/status`,
        { method: "PUT", body: JSON.stringify({ status }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["inventories", inventoryId, "lists", listId, "items"],
      });
    },
  });
}
