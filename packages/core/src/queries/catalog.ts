import { useQuery } from "@tanstack/react-query";

import { request } from "../api/client.js";
import type { CatalogEntryResponse, StoreResponse, TransactionResponse } from "../api/types.js";

export function useStores() {
  return useQuery({
    queryKey: ["catalog", "stores"],
    queryFn: () => request<StoreResponse[]>("/catalog/stores"),
  });
}

export function useCatalogEntries() {
  return useQuery({
    queryKey: ["catalog", "entries"],
    queryFn: () => request<CatalogEntryResponse[]>("/catalog/entries"),
  });
}

interface PriceHistoryFilters {
  catalog_entry_id?: string;
}

export function usePriceHistory(catalogEntryId?: string, filters?: PriceHistoryFilters) {
  const entryId = filters?.catalog_entry_id ?? catalogEntryId;
  return useQuery({
    queryKey: ["catalog", "transactions", entryId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (entryId) params.set("catalog_entry_id", entryId);
      const qs = params.toString();
      return request<TransactionResponse[]>(`/catalog/transactions${qs ? `?${qs}` : ""}`);
    },
    enabled: !!entryId,
  });
}
