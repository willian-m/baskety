import { expect, test } from "@playwright/test";

const BASE = "/api/v1";
const RUN_ID = Date.now();
const emailH = `user-h-${RUN_ID}@baskety.test`;
const emailH2 = `user-h2-${RUN_ID}@baskety.test`;
const emailH3 = `user-h3-${RUN_ID}@baskety.test`;

test.describe.serial("Household", () => {
  let tokenH: string;
  let userH2Id: string;
  let householdId: string;
  let invId: string;
  let shareToken: string;
  let expiredShareToken: string;

  test.beforeAll(async ({ request }) => {
    // Register primary user
    await request.post(`${BASE}/auth/register`, {
      data: { email: emailH, name: "User H", password: "password123" },
    });
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: emailH, password: "password123" },
    });
    tokenH = (await loginRes.json()).data.token as string;

    // Register second user to get their ID
    const reg2Res = await request.post(`${BASE}/auth/register`, {
      data: { email: emailH2, name: "User H2", password: "password123" },
    });
    userH2Id = (await reg2Res.json()).data.id as string;
  });

  // H01 — Create household
  test("H01 create household", async ({ request }) => {
    const res = await request.post(`${BASE}/households`, {
      headers: { Authorization: `Bearer ${tokenH}`, "Content-Type": "application/json" },
      data: { name: "Test Household" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("Test Household");
    householdId = body.data.id as string;
    expect(householdId).toBeTruthy();
  });

  // H02 — List households
  test("H02 list households", async ({ request }) => {
    const res = await request.get(`${BASE}/households`, {
      headers: { Authorization: `Bearer ${tokenH}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = (body.data as Array<{ id: string }>).map((h) => h.id);
    expect(ids).toContain(householdId);
  });

  // H03 — Get household by ID
  test("H03 get household by ID", async ({ request }) => {
    const res = await request.get(`${BASE}/households/${householdId}`, {
      headers: { Authorization: `Bearer ${tokenH}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(householdId);
  });

  // H04 — Get household not belonging to user → 404
  test("H04 get other user household returns 404", async ({ request }) => {
    // Register third user and create their household
    await request.post(`${BASE}/auth/register`, {
      data: { email: emailH3, name: "User H3", password: "password123" },
    });
    const login3Res = await request.post(`${BASE}/auth/login`, {
      data: { email: emailH3, password: "password123" },
    });
    const token3 = (await login3Res.json()).data.token as string;
    const hh3Res = await request.post(`${BASE}/households`, {
      headers: { Authorization: `Bearer ${token3}`, "Content-Type": "application/json" },
      data: { name: "H3 Household" },
    });
    const otherHhId = (await hh3Res.json()).data.id as string;

    // tokenH should get 404 when accessing other user's household
    const res = await request.get(`${BASE}/households/${otherHhId}`, {
      headers: { Authorization: `Bearer ${tokenH}` },
    });
    expect(res.status()).toBe(404);
  });

  // H05 — Add member to household
  test("H05 add member to household", async ({ request }) => {
    const res = await request.post(`${BASE}/households/${householdId}/members`, {
      headers: { Authorization: `Bearer ${tokenH}`, "Content-Type": "application/json" },
      data: { user_id: userH2Id, role: "member" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.user_id).toBe(userH2Id);
    expect(body.data.role).toBe("member");
  });

  // H06 — Remove member from household
  test("H06 remove member from household", async ({ request }) => {
    const res = await request.delete(`${BASE}/households/${householdId}/members/${userH2Id}`, {
      headers: { Authorization: `Bearer ${tokenH}` },
    });
    expect(res.status()).toBe(204);
  });

  // H07 — Create share link without password
  test("H07 create share link no password", async ({ request }) => {
    // First create an inventory (needed for share links)
    const invRes = await request.post(`${BASE}/inventories`, {
      headers: {
        Authorization: `Bearer ${tokenH}`,
        "X-Household-ID": householdId,
        "Content-Type": "application/json",
      },
      data: { name: "Share Test Inventory", description: null },
    });
    invId = (await invRes.json()).data.id as string;

    const res = await request.post(`${BASE}/households/${householdId}/share-links`, {
      headers: { Authorization: `Bearer ${tokenH}`, "Content-Type": "application/json" },
      data: { inventory_id: invId },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.token).toBeTruthy();
    shareToken = body.data.token as string;
    expect(body.data.expires_at).toBeNull();

    // Also create an expired share link (1.5s TTL) for H10
    const expiry = new Date(Date.now() + 1500).toISOString();
    const expRes = await request.post(`${BASE}/households/${householdId}/share-links`, {
      headers: { Authorization: `Bearer ${tokenH}`, "Content-Type": "application/json" },
      data: { inventory_id: invId, expires_at: expiry },
    });
    expiredShareToken = (await expRes.json()).data.token as string;
  });

  // H08 — Create share link with password and expiry
  test("H08 create share link with password", async ({ request }) => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${BASE}/households/${householdId}/share-links`, {
      headers: { Authorization: `Bearer ${tokenH}`, "Content-Type": "application/json" },
      data: { inventory_id: invId, password: "secret123", expires_at: expiresAt },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.token).toBeTruthy();
    expect(body.data.expires_at).toBeTruthy();
    expect(body.data).not.toHaveProperty("password");
  });

  // H09 — Access share link (no password)
  test("H09 access share link no password", async ({ request }) => {
    const res = await request.get(`${BASE}/share/${shareToken}/inventory`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.inventory_id).toBe(invId);
  });

  // H10 — Access expired share link returns 410
  test("H10 expired share link returns 410", async () => {
    // Wait for the 1.5s TTL to expire
    await new Promise((r) => setTimeout(r, 2000));
  });

  test("H10 expired share link returns 410 (request)", async ({ request }) => {
    const res = await request.get(`${BASE}/share/${expiredShareToken}/inventory`);
    expect(res.status()).toBe(410);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
