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
    queryFn: () => request<GroceryListResponse[]>(`/inventories/${inventoryId}/lists`),
    enabled: !!inventoryId,
  });
}

export function useGroceryList(inventoryId: string, listId: string) {
  return useQuery({
    queryKey: ["inventories", inventoryId, "lists", listId],
    queryFn: () => request<GroceryListResponse>(`/inventories/${inventoryId}/lists/${listId}`),
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
      request<GroceryListResponse>(`/inventories/${inventoryId}/lists/${listId}/complete`, {
        method: "POST",
      }),
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
      request<GroceryItemResponse[]>(`/inventories/${inventoryId}/lists/${listId}/items`),
    enabled: !!inventoryId && !!listId,
  });
}

export function useAddListItem(inventoryId: string, listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGroceryItemRequest) =>
      request<GroceryItemResponse>(`/inventories/${inventoryId}/lists/${listId}/items`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["inventories", inventoryId, "lists", listId, "items"],
      });
    },
  });
}

export function useUpdateListItem(inventoryId: string, listId: string) {
  const qc = useQueryClient();
  const itemsKey = ["inventories", inventoryId, "lists", listId, "items"] as const;
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
    onMutate: async ({ itemId, status }) => {
      // Cancel in-flight fetches so they don't overwrite the optimistic update
      await qc.cancelQueries({ queryKey: itemsKey });
      const previous = qc.getQueryData<GroceryItemResponse[]>(itemsKey);
      qc.setQueryData<GroceryItemResponse[]>(itemsKey, (old) =>
        old?.map((item) => (item.id === itemId ? { ...item, status } : item)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back to the snapshot taken before the mutation
      if (context?.previous !== undefined) {
        qc.setQueryData(itemsKey, context.previous);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: itemsKey });
    },
  });
}

export function useDeleteListItem(inventoryId: string, listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      request<void>(`/inventories/${inventoryId}/lists/${listId}/items/${itemId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["inventories", inventoryId, "lists", listId, "items"],
      });
    },
  });
}

export function useAutoGenerateList(inventoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<GroceryListResponse>(`/inventories/${inventoryId}/lists/auto-generate`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventories", inventoryId, "lists"] });
    },
  });
}

export function useRenameList(inventoryId: string, listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      request<GroceryListResponse>(`/inventories/${inventoryId}/lists/${listId}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventories", inventoryId, "lists"] });
    },
  });
}

export function useDeleteList(inventoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) =>
      request<void>(`/inventories/${inventoryId}/lists/${listId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventories", inventoryId, "lists"] });
    },
  });
}

export function useArchiveList(inventoryId: string, listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<void>(`/inventories/${inventoryId}/lists/${listId}/archive`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventories", inventoryId, "lists"] });
    },
  });
}

export function useDeleteListItem(inventoryId: string, listId: string) {
  const qc = useQueryClient();
  const itemsKey = ["inventories", inventoryId, "lists", listId, "items"] as const;
  return useMutation({
    mutationFn: (itemId: string) =>
      request<void>(`/inventories/${inventoryId}/lists/${listId}/items/${itemId}`, {
        method: "DELETE",
      }),
    onMutate: async (itemId: string) => {
      await qc.cancelQueries({ queryKey: itemsKey });
      const previous = qc.getQueryData<GroceryItemResponse[]>(itemsKey);
      qc.setQueryData<GroceryItemResponse[]>(itemsKey, (old) =>
        old?.filter((item) => item.id !== itemId),
      );
      return { previous };
    },
    onError: (_err, itemId, context) => {
      const prev = context?.previous;
      if (!prev) return;
      qc.setQueryData<GroceryItemResponse[]>(itemsKey, (current) => {
        if (!Array.isArray(current)) return current;
        const already = current.find((it) => it.id === itemId);
        if (already) return current; // already present, no-op
        const originalIndex = prev.findIndex((it) => it.id === itemId);
        const item = prev[originalIndex];
        if (!item) return current;
        const result = [...current];
        result.splice(Math.min(originalIndex, result.length), 0, item);
        return result;
      });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: itemsKey });
    },
  });
}
