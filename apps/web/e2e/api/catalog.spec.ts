import { expect, test } from "@playwright/test";

const BASE = "/api/v1";

test.describe.serial("Catalog", () => {
  let tokenC: string;
  let householdId: string;
  let storeId: string;
  let entryPriv: string;
  let entryPub: string;

  test.beforeAll(async ({ request }) => {
    await request.post(`${BASE}/auth/register`, {
      data: { email: "user-c@baskety.test", name: "User C", password: "password123" },
    });
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: "user-c@baskety.test", password: "password123" },
    });
    tokenC = (await loginRes.json()).data.token as string;
    const hhRes = await request.post(`${BASE}/households`, {
      headers: { Authorization: `Bearer ${tokenC}`, "Content-Type": "application/json" },
      data: { name: "Catalog Household" },
    });
    householdId = (await hhRes.json()).data.id as string;
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${tokenC}`,
    "X-Household-ID": householdId,
    "Content-Type": "application/json",
  });

  // C01 — Create store
  test("C01 create store", async ({ request }) => {
    const res = await request.post(`${BASE}/catalog/stores`, {
      headers: authHeaders(),
      data: { name: "Whole Foods Market", chain_name: "Whole Foods", address: "123 Main St" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    storeId = body.data.id as string;
    expect(body.data.name).toBe("Whole Foods Market");
  });

  // C02 — List stores
  test("C02 list stores", async ({ request }) => {
    const res = await request.get(`${BASE}/catalog/stores`, { headers: authHeaders() });
    expect(res.status()).toBe(200);
    const ids = ((await res.json()).data as Array<{ id: string }>).map((s) => s.id);
    expect(ids).toContain(storeId);
  });

  // C03 — Create private catalog entry
  test("C03 create private catalog entry", async ({ request }) => {
    const res = await request.post(`${BASE}/catalog/entries`, {
      headers: authHeaders(),
      data: {
        name: "Jasmine Rice 5lb",
        brand: "Golden Star",
        unit: "bag",
        category: "Grains",
        scope: "private",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    entryPriv = body.data.id as string;
    expect(body.data.scope).toBe("private");
    expect(body.data.household_id).toBe(householdId);
  });

  // C04 — Create public catalog entry
  test("C04 create public catalog entry", async ({ request }) => {
    const res = await request.post(`${BASE}/catalog/entries`, {
      headers: authHeaders(),
      data: { name: "Table Salt 1kg", unit: "kg", scope: "public" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    entryPub = body.data.id as string;
    expect(body.data.scope).toBe("public");
    expect(body.data.household_id).toBeNull();
  });

  // C05 — List catalog entries
  test("C05 list catalog entries", async ({ request }) => {
    const res = await request.get(`${BASE}/catalog/entries`, { headers: authHeaders() });
    expect(res.status()).toBe(200);
    const ids = ((await res.json()).data as Array<{ id: string }>).map((e) => e.id);
    expect(ids).toContain(entryPriv);
    expect(ids).toContain(entryPub);
  });

  // C06 — List transactions
  test("C06 list transactions", async ({ request }) => {
    const res = await request.get(`${BASE}/catalog/transactions`, { headers: authHeaders() });
    expect(res.status()).toBe(200);
    // Transactions may be empty if receipt pipeline was not available
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);

    // Filter by catalog entry (should return empty or matching entries)
    const filteredRes = await request.get(
      `${BASE}/catalog/transactions?catalog_entry_id=${entryPriv}`,
      { headers: authHeaders() },
    );
    expect(filteredRes.status()).toBe(200);
    const filteredData = (await filteredRes.json()).data as Array<{
      catalog_entry_id: string | null;
    }>;
    for (const tx of filteredData) {
      expect(tx.catalog_entry_id).toBe(entryPriv);
    }
  });
});
