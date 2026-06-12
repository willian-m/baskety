import { expect, test } from "@playwright/test";

const BASE = "/api/v1";
const RUN_ID = Date.now();
const emailG = `user-g-${RUN_ID}@baskety.test`;

test.describe.serial("Grocery", () => {
  let tokenG: string;
  let householdId: string;
  let invId: string;
  let invFullId: string;
  let itemGId: string;
  let listId: string;
  let gItemId: string;
  let gItemDelId: string;

  test.beforeAll(async ({ request }) => {
    await request.post(`${BASE}/auth/register`, {
      data: { email: emailG, name: "User G", password: "password123" },
    });
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: emailG, password: "password123" },
    });
    tokenG = (await loginRes.json()).data.token as string;

    const hhRes = await request.post(`${BASE}/households`, {
      headers: { Authorization: `Bearer ${tokenG}`, "Content-Type": "application/json" },
      data: { name: "Grocery Household" },
    });
    householdId = (await hhRes.json()).data.id as string;

    // Create main inventory
    const invRes = await request.post(`${BASE}/inventories`, {
      headers: h(tokenG, householdId),
      data: { name: "Grocery Pantry", description: null },
    });
    invId = (await invRes.json()).data.id as string;

    // Create item with target=5
    const itemRes = await request.post(`${BASE}/inventories/${invId}/items`, {
      headers: h(tokenG, householdId),
      data: { name: "Rice", category: "Grains", unit: "kg", target_quantity: 5 },
    });
    itemGId = (await itemRes.json()).data.id as string;

    // Add batch qty=2 (shortfall=3)
    await request.post(`${BASE}/inventories/${invId}/items/${itemGId}/batches`, {
      headers: h(tokenG, householdId),
      data: { quantity: 2.0 },
    });

    // Create fully-stocked inventory for G10
    const invFullRes = await request.post(`${BASE}/inventories`, {
      headers: h(tokenG, householdId),
      data: { name: "Full Inventory", description: null },
    });
    invFullId = (await invFullRes.json()).data.id as string;
    const fullItemRes = await request.post(`${BASE}/inventories/${invFullId}/items`, {
      headers: h(tokenG, householdId),
      data: { name: "Salt", category: "Spices", unit: "kg", target_quantity: 1 },
    });
    const fullItemId = (await fullItemRes.json()).data.id as string;
    await request.post(`${BASE}/inventories/${invFullId}/items/${fullItemId}/batches`, {
      headers: h(tokenG, householdId),
      data: { quantity: 1.0 }, // exactly meets target
    });
  });

  function h(token: string, hhId: string) {
    return {
      Authorization: `Bearer ${token}`,
      "X-Household-ID": hhId,
      "Content-Type": "application/json",
    };
  }

  // G01 — Create grocery list
  test("G01 create grocery list", async ({ request }) => {
    const res = await request.post(`${BASE}/inventories/${invId}/lists`, {
      headers: h(tokenG, householdId),
      data: { name: "Weekly Shopping" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    listId = body.data.id as string;
    expect(body.data.name).toBe("Weekly Shopping");
    expect(body.data.status).toBe("active");
  });

  // G02 — List grocery lists
  test("G02 list grocery lists", async ({ request }) => {
    const res = await request.get(`${BASE}/inventories/${invId}/lists`, {
      headers: h(tokenG, householdId),
    });
    expect(res.status()).toBe(200);
    const ids = ((await res.json()).data as Array<{ id: string }>).map((l) => l.id);
    expect(ids).toContain(listId);
  });

  // G03 — Add item with inventory link
  test("G03 add item with inventory link", async ({ request }) => {
    const res = await request.post(`${BASE}/inventories/${invId}/lists/${listId}/items`, {
      headers: h(tokenG, householdId),
      data: {
        inventory_item_id: itemGId,
        name: "Rice",
        quantity: 3.0,
        unit: "kg",
        sort_order: 1,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    gItemId = body.data.id as string;
    expect(body.data.inventory_item_id).toBe(itemGId);
    expect(body.data.status).toBe("pending");
  });

  // G04 — Add manual item (no inventory link)
  test("G04 add manual item", async ({ request }) => {
    const res = await request.post(`${BASE}/inventories/${invId}/lists/${listId}/items`, {
      headers: h(tokenG, householdId),
      data: { name: "Olive Oil", quantity: 1.0, unit: "bottle", sort_order: 2 },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    gItemDelId = body.data.id as string;
    expect(body.data.inventory_item_id).toBeNull();
    expect(body.data.status).toBe("pending");
  });

  // G05 — Update item status to bought
  test("G05 update item status to bought", async ({ request }) => {
    const res = await request.put(
      `${BASE}/inventories/${invId}/lists/${listId}/items/${gItemId}/status`,
      { headers: h(tokenG, householdId), data: { status: "bought" } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("bought");
  });

  // G06 — Update item status with invalid value
  test("G06 update item status invalid value", async ({ request }) => {
    const res = await request.put(
      `${BASE}/inventories/${invId}/lists/${listId}/items/${gItemId}/status`,
      { headers: h(tokenG, householdId), data: { status: "consumed" } },
    );
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });

  // G07 — Reorder item
  test("G07 reorder item", async ({ request }) => {
    const res = await request.put(
      `${BASE}/inventories/${invId}/lists/${listId}/items/${gItemId}/order`,
      { headers: h(tokenG, householdId), data: { sort_order: 10 } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.sort_order).toBe(10);
  });

  // G08 — Delete item from list
  test("G08 delete item from list", async ({ request }) => {
    const res = await request.delete(
      `${BASE}/inventories/${invId}/lists/${listId}/items/${gItemDelId}`,
      { headers: h(tokenG, householdId) },
    );
    expect(res.status()).toBe(204);
  });

  // G09 — Auto-generate list from inventory shortfalls
  test("G09 auto-generate list from shortfalls", async ({ request }) => {
    const res = await request.post(`${BASE}/inventories/${invId}/lists/auto-generate`, {
      headers: h(tokenG, householdId),
      data: {},
    });
    expect(res.status()).toBe(201);
    const autoListId = (await res.json()).data.id as string;

    const itemsRes = await request.get(`${BASE}/inventories/${invId}/lists/${autoListId}/items`, {
      headers: h(tokenG, householdId),
    });
    expect(itemsRes.status()).toBe(200);
    const items = (await itemsRes.json()).data as Array<{ name: string; quantity: number }>;
    const riceItem = items.find((i) => i.name === "Rice");
    expect(riceItem).toBeDefined();
    expect(riceItem?.quantity).toBe(3);
  });

  // G10 — Auto-generate with no shortfalls
  test("G10 auto-generate no shortfalls", async ({ request }) => {
    const res = await request.post(`${BASE}/inventories/${invFullId}/lists/auto-generate`, {
      headers: h(tokenG, householdId),
      data: {},
    });
    expect(res.status()).toBe(201);
    const emptyAutoId = (await res.json()).data.id as string;

    const itemsRes = await request.get(
      `${BASE}/inventories/${invFullId}/lists/${emptyAutoId}/items`,
      { headers: h(tokenG, householdId) },
    );
    const items = (await itemsRes.json()).data as unknown[];
    expect(items).toHaveLength(0);
  });

  // G11 — Complete list
  test("G11 complete list", async ({ request }) => {
    const res = await request.post(`${BASE}/inventories/${invId}/lists/${listId}/complete`, {
      headers: h(tokenG, householdId),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("completed");
    expect(body.data.completed_at).toBeTruthy();
  });

  // G12 — Archive list
  test("G12 archive list", async ({ request }) => {
    // Create a fresh list to archive
    const createRes = await request.post(`${BASE}/inventories/${invId}/lists`, {
      headers: h(tokenG, householdId),
      data: { name: "List to Archive" },
    });
    const listArchId = (await createRes.json()).data.id as string;

    const res = await request.post(`${BASE}/inventories/${invId}/lists/${listArchId}/archive`, {
      headers: h(tokenG, householdId),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("archived");
  });
});
