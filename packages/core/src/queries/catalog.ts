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

export function usePriceHistory(catalogEntryId?: string) {
  return useQuery({
    queryKey: ["catalog", "transactions", catalogEntryId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (catalogEntryId) params.set("catalog_entry_id", catalogEntryId);
      const qs = params.toString();
      return request<TransactionResponse[]>(`/catalog/transactions${qs ? `?${qs}` : ""}`);
    },
    enabled: !!catalogEntryId,
  });
}
