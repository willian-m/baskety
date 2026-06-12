import { expect, test } from "@playwright/test";

const BASE = "/api/v1";
const RUN_ID = Date.now();
const emailI = `user-i-${RUN_ID}@baskety.test`;

test.describe.serial("Inventory", () => {
  let tokenI: string;
  let householdId: string;
  let invId: string;
  let itemId: string;
  let itemId2: string;
  let batchId1: string;
  let itemMultiId: string;

  test.beforeAll(async ({ request }) => {
    await request.post(`${BASE}/auth/register`, {
      data: { email: emailI, name: "User I", password: "password123" },
    });
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: emailI, password: "password123" },
    });
    tokenI = (await loginRes.json()).data.token as string;
    const hhRes = await request.post(`${BASE}/households`, {
      headers: { Authorization: `Bearer ${tokenI}`, "Content-Type": "application/json" },
      data: { name: "Inventory Household" },
    });
    householdId = (await hhRes.json()).data.id as string;
  });

  const h = (extra?: Record<string, string>) => ({
    Authorization: `Bearer ${tokenI}`,
    "X-Household-ID": householdId,
    "Content-Type": "application/json",
    ...extra,
  });

  // I01 — Create inventory
  test("I01 create inventory", async ({ request }) => {
    const res = await request.post(`${BASE}/inventories`, {
      headers: h(),
      data: { name: "Kitchen Pantry", description: "Main pantry items" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    invId = body.data.id as string;
    expect(invId).toBeTruthy();
    expect(body.data.household_id).toBe(householdId);
    expect(body.data.name).toBe("Kitchen Pantry");
  });

  // I02 — List inventories
  test("I02 list inventories", async ({ request }) => {
    const res = await request.get(`${BASE}/inventories`, { headers: h() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = (body.data as Array<{ id: string }>).map((inv) => inv.id);
    expect(ids).toContain(invId);
  });

  // I03 — Update inventory
  test("I03 update inventory", async ({ request }) => {
    const res = await request.put(`${BASE}/inventories/${invId}`, {
      headers: h(),
      data: { name: "Updated Pantry" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Updated Pantry");
  });

  // I04 — Delete inventory
  test("I04 delete inventory", async ({ request }) => {
    const createRes = await request.post(`${BASE}/inventories`, {
      headers: h(),
      data: { name: "To Delete", description: null },
    });
    const invDelId = (await createRes.json()).data.id as string;

    const delRes = await request.delete(`${BASE}/inventories/${invDelId}`, { headers: h() });
    expect(delRes.status()).toBe(204);

    const getRes = await request.get(`${BASE}/inventories/${invDelId}`, { headers: h() });
    expect(getRes.status()).toBe(404);
  });

  // I05 — Create item with all fields
  test("I05 create item with all fields", async ({ request }) => {
    const res = await request.post(`${BASE}/inventories/${invId}/items`, {
      headers: h(),
      data: {
        name: "Rice",
        category: "Grains",
        unit: "kg",
        target_quantity: 5.0,
        notes: "Jasmine rice",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    itemId = body.data.id as string;
    expect(body.data.name).toBe("Rice");
    expect(body.data.target_quantity).toBe(5);
  });

  // I06 — Create item with missing name
  test("I06 create item missing name", async ({ request }) => {
    const res = await request.post(`${BASE}/inventories/${invId}/items`, {
      headers: h(),
      data: { category: "Grains", unit: "kg", target_quantity: 5.0 },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // I07 — List items excludes soft-deleted
  test("I07 list items excludes soft-deleted", async ({ request }) => {
    // Create and immediately delete an item
    const createRes = await request.post(`${BASE}/inventories/${invId}/items`, {
      headers: h(),
      data: { name: "To Delete Item", category: "Other", unit: "pcs", target_quantity: 1 },
    });
    const itemDelId = (await createRes.json()).data.id as string;
    await request.delete(`${BASE}/inventories/${invId}/items/${itemDelId}`, { headers: h() });

    // List items - deleted item should not appear
    const listRes = await request.get(`${BASE}/inventories/${invId}/items`, { headers: h() });
    expect(listRes.status()).toBe(200);
    const ids = ((await listRes.json()).data as Array<{ id: string }>).map((i) => i.id);
    expect(ids).not.toContain(itemDelId);
    expect(ids).toContain(itemId);
  });

  // I08 — Update item
  test("I08 update item", async ({ request }) => {
    const res = await request.put(`${BASE}/inventories/${invId}/items/${itemId}`, {
      headers: h(),
      data: {
        name: "Basmati Rice",
        category: "Grains",
        unit: "kg",
        target_quantity: 3.0,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Basmati Rice");
    expect(body.data.target_quantity).toBe(3);
  });

  // I09 — Delete item (soft delete)
  test("I09 delete item soft delete", async ({ request }) => {
    const delRes = await request.delete(`${BASE}/inventories/${invId}/items/${itemId}`, {
      headers: h(),
    });
    expect(delRes.status()).toBe(204);

    const getRes = await request.get(`${BASE}/inventories/${invId}/items/${itemId}`, {
      headers: h(),
    });
    expect(getRes.status()).toBe(404);

    // Create replacement item for I10-I14
    const createRes = await request.post(`${BASE}/inventories/${invId}/items`, {
      headers: h(),
      data: { name: "New Rice", category: "Grains", unit: "kg", target_quantity: 5 },
    });
    itemId2 = (await createRes.json()).data.id as string;
  });

  // I10 — Add batch with positive quantity
  test("I10 add batch positive quantity", async ({ request }) => {
    const res = await request.post(`${BASE}/inventories/${invId}/items/${itemId2}/batches`, {
      headers: h(),
      data: { quantity: 2.0, notes: "bought at Costco" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    batchId1 = body.data.id as string;
    expect(body.data.quantity).toBe(2);
    expect(body.data.emptied_at).toBeNull();
  });

  // I11 — Add batch with quantity <= 0
  test("I11 add batch zero quantity", async ({ request }) => {
    const res = await request.post(`${BASE}/inventories/${invId}/items/${itemId2}/batches`, {
      headers: h(),
      data: { quantity: 0 },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // I12 — List active batches
  test("I12 list active batches", async ({ request }) => {
    const res = await request.get(`${BASE}/inventories/${invId}/items/${itemId2}/batches`, {
      headers: h(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const batch = (body.data as Array<{ id: string; emptied_at: null }>).find(
      (b) => b.id === batchId1,
    );
    expect(batch).toBeDefined();
    expect(batch?.emptied_at).toBeNull();
  });

  // I13 — Mark batch emptied
  test("I13 mark batch emptied", async ({ request }) => {
    const res = await request.post(
      `${BASE}/inventories/${invId}/items/${itemId2}/batches/${batchId1}/empty`,
      { headers: h() },
    );
    expect(res.status()).toBe(200);

    // Verify batch no longer in active list
    const listRes = await request.get(`${BASE}/inventories/${invId}/items/${itemId2}/batches`, {
      headers: h(),
    });
    const ids = ((await listRes.json()).data as Array<{ id: string }>).map((b) => b.id);
    expect(ids).not.toContain(batchId1);
  });

  // I14 — Get effective quantity
  test("I14 get effective quantity", async ({ request }) => {
    // Create a fresh item for this test
    const itemRes = await request.post(`${BASE}/inventories/${invId}/items`, {
      headers: h(),
      data: { name: "Multi-batch Item", category: "Test", unit: "units", target_quantity: 10 },
    });
    itemMultiId = (await itemRes.json()).data.id as string;

    // Add batch A: qty 2.0
    await request.post(`${BASE}/inventories/${invId}/items/${itemMultiId}/batches`, {
      headers: h(),
      data: { quantity: 2.0 },
    });
    // Add batch B: qty 1.5
    await request.post(`${BASE}/inventories/${invId}/items/${itemMultiId}/batches`, {
      headers: h(),
      data: { quantity: 1.5 },
    });
    // Add batch C: qty 5.0 (will be emptied)
    const batchCRes = await request.post(
      `${BASE}/inventories/${invId}/items/${itemMultiId}/batches`,
      { headers: h(), data: { quantity: 5.0 } },
    );
    const batchCId = (await batchCRes.json()).data.id as string;

    // Empty batch C
    await request.post(
      `${BASE}/inventories/${invId}/items/${itemMultiId}/batches/${batchCId}/empty`,
      { headers: h() },
    );

    // Check effective quantity = 2.0 + 1.5 = 3.5
    const qtyRes = await request.get(`${BASE}/inventories/${invId}/items/${itemMultiId}/quantity`, {
      headers: h(),
    });
    expect(qtyRes.status()).toBe(200);
    const qtyBody = await qtyRes.json();
    expect(Math.abs((qtyBody.data.quantity as number) - 3.5)).toBeLessThan(0.001);
  });
});
