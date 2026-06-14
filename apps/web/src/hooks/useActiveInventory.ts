import { useInventories, useUiStore } from "@baskety/core";

export function useActiveInventory(): string {
  const { data: inventories } = useInventories();
  const activeInventoryId = useUiStore((s) => s.activeInventoryId);
  if (activeInventoryId) return activeInventoryId;
  return inventories?.[0]?.id ?? "";
}
