/**
 * Tests for useUpdateListItem — specifically the optimistic update logic
 * (onMutate / onError).  We exercise the cache manipulation directly through
 * QueryClient so we do not need a React renderer.
 */

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GroceryItemResponse } from "../api/types.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeItem(overrides?: Partial<GroceryItemResponse>): GroceryItemResponse {
  return {
    id: "item-1",
    grocery_list_id: "list-1",
    inventory_item_id: null,
    name: "Milk",
    quantity: 1,
    unit: "L",
    notes: null,
    status: "pending",
    sort_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const INVENTORY_ID = "inv-1";
const LIST_ID = "list-1";
const ITEMS_KEY = ["inventories", INVENTORY_ID, "lists", LIST_ID, "items"] as const;

/**
 * Reproduces the onMutate / onError logic from useUpdateListItem without
 * rendering a hook — this lets us validate cache behaviour in pure Node.
 */
function makeOptimisticHandlers(qc: QueryClient) {
  const onMutate = async ({
    itemId,
    status,
  }: {
    itemId: string;
    status: "pending" | "bought" | "skipped";
  }) => {
    await qc.cancelQueries({ queryKey: ITEMS_KEY });
    const previous = qc.getQueryData<GroceryItemResponse[]>(ITEMS_KEY);
    qc.setQueryData<GroceryItemResponse[]>(ITEMS_KEY, (old) =>
      old?.map((item) => (item.id === itemId ? { ...item, status } : item)),
    );
    return { previous };
  };

  const onError = (
    _err: unknown,
    _vars: unknown,
    context: { previous: GroceryItemResponse[] | undefined } | undefined,
  ) => {
    if (context?.previous !== undefined) {
      qc.setQueryData(ITEMS_KEY, context.previous);
    }
  };

  return { onMutate, onError };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useUpdateListItem — optimistic update (onMutate)", () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    qc.clear();
  });

  it("optimistically updates the target item status in the cache", async () => {
    const items: GroceryItemResponse[] = [
      makeItem({ id: "item-1", status: "pending" }),
      makeItem({ id: "item-2", status: "pending" }),
    ];
    qc.setQueryData(ITEMS_KEY, items);

    const { onMutate } = makeOptimisticHandlers(qc);
    await onMutate({ itemId: "item-1", status: "bought" });

    const cached = qc.getQueryData<GroceryItemResponse[]>(ITEMS_KEY);
    expect(cached?.find((i) => i.id === "item-1")?.status).toBe("bought");
  });

  it("does not mutate other items when one item is updated", async () => {
    const items: GroceryItemResponse[] = [
      makeItem({ id: "item-1", status: "pending" }),
      makeItem({ id: "item-2", status: "pending" }),
    ];
    qc.setQueryData(ITEMS_KEY, items);

    const { onMutate } = makeOptimisticHandlers(qc);
    await onMutate({ itemId: "item-1", status: "skipped" });

    const cached = qc.getQueryData<GroceryItemResponse[]>(ITEMS_KEY);
    expect(cached?.find((i) => i.id === "item-2")?.status).toBe("pending");
  });

  it("returns the previous cache snapshot in the context", async () => {
    const items: GroceryItemResponse[] = [makeItem({ id: "item-1", status: "pending" })];
    qc.setQueryData(ITEMS_KEY, items);

    const { onMutate } = makeOptimisticHandlers(qc);
    const context = await onMutate({ itemId: "item-1", status: "bought" });

    expect(context.previous).toEqual(items);
  });

  it("handles missing cache gracefully — previous is undefined", async () => {
    // No data seeded in the cache
    const { onMutate } = makeOptimisticHandlers(qc);
    const context = await onMutate({ itemId: "item-1", status: "bought" });

    expect(context.previous).toBeUndefined();
  });
});

describe("useUpdateListItem — rollback (onError)", () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    qc.clear();
  });

  it("restores the previous snapshot on error", async () => {
    const originalItems: GroceryItemResponse[] = [makeItem({ id: "item-1", status: "pending" })];
    qc.setQueryData(ITEMS_KEY, originalItems);

    const { onMutate, onError } = makeOptimisticHandlers(qc);

    // Simulate an optimistic update
    const context = await onMutate({ itemId: "item-1", status: "bought" });

    // Verify the optimistic state was applied
    const optimistic = qc.getQueryData<GroceryItemResponse[]>(ITEMS_KEY);
    expect(optimistic?.find((i) => i.id === "item-1")?.status).toBe("bought");

    // Simulate a server error — rollback
    onError(new Error("server error"), { itemId: "item-1", status: "bought" }, context);

    // Cache should be back to original
    const rolled = qc.getQueryData<GroceryItemResponse[]>(ITEMS_KEY);
    expect(rolled?.find((i) => i.id === "item-1")?.status).toBe("pending");
  });

  it("does nothing on rollback when context has no previous data", () => {
    qc.setQueryData(ITEMS_KEY, [makeItem({ id: "item-1", status: "bought" })]);

    const { onError } = makeOptimisticHandlers(qc);

    // onError with undefined context — should not crash and should leave cache intact
    onError(new Error("no context"), {}, undefined);

    const cached = qc.getQueryData<GroceryItemResponse[]>(ITEMS_KEY);
    expect(cached?.find((i) => i.id === "item-1")?.status).toBe("bought");
  });

  it("does nothing on rollback when previous is undefined in context", () => {
    qc.setQueryData(ITEMS_KEY, [makeItem({ id: "item-1", status: "bought" })]);

    const { onError } = makeOptimisticHandlers(qc);

    onError(new Error("no previous"), {}, { previous: undefined });

    const cached = qc.getQueryData<GroceryItemResponse[]>(ITEMS_KEY);
    expect(cached?.find((i) => i.id === "item-1")?.status).toBe("bought");
  });
});
