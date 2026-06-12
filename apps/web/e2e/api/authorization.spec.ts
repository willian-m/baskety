import { expect, test } from "@playwright/test";

const BASE = "/api/v1";
const RUN_ID = Date.now();
const emailHAuth = `user-h-auth-${RUN_ID}@baskety.test`;
const emailZAuth = `user-z-auth-${RUN_ID}@baskety.test`;

async function createUserAndHousehold(
  request: Parameters<Parameters<typeof test>[1]>[0]["request"],
  email: string,
): Promise<{ token: string; householdId: string }> {
  await request.post(`${BASE}/auth/register`, {
    data: { email, name: "Test User", password: "password123" },
  });
  const loginRes = await request.post(`${BASE}/auth/login`, {
    data: { email, password: "password123" },
  });
  const loginBody = await loginRes.json();
  const token = loginBody.data.token as string;
  const hhRes = await request.post(`${BASE}/households`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { name: "Auth Test Household" },
  });
  const hhBody = await hhRes.json();
  const householdId = hhBody.data.id as string;
  return { token, householdId };
}

test.describe.serial("Authorization", () => {
  let tokenH: string;
  let hhH: string;
  let tokenZ: string;
  let hhZ: string;
  let invZ: string;

  test.beforeAll(async ({ request }) => {
    // User H
    ({ token: tokenH, householdId: hhH } = await createUserAndHousehold(request, emailHAuth));
    // User Z
    ({ token: tokenZ, householdId: hhZ } = await createUserAndHousehold(request, emailZAuth));
    // Create inventory in hhZ (owned by user Z)
    const invRes = await request.post(`${BASE}/inventories`, {
      headers: {
        Authorization: `Bearer ${tokenZ}`,
        "X-Household-ID": hhZ,
        "Content-Type": "application/json",
      },
      data: { name: "Z Inventory", description: null },
    });
    const invBody = await invRes.json();
    invZ = invBody.data.id as string;
  });

  // Z01 — Cross-household inventory access is forbidden/not found
  test("Z01 cross-household inventory access", async ({ request }) => {
    // tokenH belongs to hhH, but invZ belongs to hhZ
    const res = await request.get(`${BASE}/inventories/${invZ}`, {
      headers: {
        Authorization: `Bearer ${tokenH}`,
        "X-Household-ID": hhH,
      },
    });
    // The handler returns 404 when the inventory doesn't exist in the user's household scope
    expect([403, 404]).toContain(res.status());
  });

  // Z02 — Missing X-Household-ID falls back to user's first household
  test("Z02 missing household header falls back", async ({ request }) => {
    // Request without X-Household-ID header
    const resWithout = await request.get(`${BASE}/inventories`, {
      headers: { Authorization: `Bearer ${tokenH}` },
    });
    expect(resWithout.status()).toBe(200);

    // Request with explicit X-Household-ID
    const resWith = await request.get(`${BASE}/inventories`, {
      headers: { Authorization: `Bearer ${tokenH}`, "X-Household-ID": hhH },
    });
    expect(resWith.status()).toBe(200);

    const withoutBody = await resWithout.json();
    const withBody = await resWith.json();
    expect(withoutBody.data).toEqual(withBody.data);
  });

  // Z03 — X-Household-ID for non-member household returns 403
  test("Z03 non-member household returns 403", async ({ request }) => {
    // tokenH is not a member of hhZ
    const res = await request.get(`${BASE}/inventories`, {
      headers: {
        Authorization: `Bearer ${tokenH}`,
        "X-Household-ID": hhZ,
      },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // Z04 — Unauthenticated access to protected route
  test("Z04 unauthenticated access returns 401", async ({ request }) => {
    const res = await request.get(`${BASE}/inventories`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // Z05 — Share link password enforcement
  test("Z05 share link password enforcement", async ({ request }) => {
    // Create a password-protected share link for invZ using tokenZ
    const slRes = await request.post(`${BASE}/households/${hhZ}/share-links`, {
      headers: {
        Authorization: `Bearer ${tokenZ}`,
        "X-Household-ID": hhZ,
        "Content-Type": "application/json",
      },
      data: { inventory_id: invZ, password: "secret123" },
    });
    expect(slRes.status()).toBe(201);
    const slBody = await slRes.json();
    const shareTokenPw = slBody.data.token as string;

    // Wrong password → 401
    const wrongRes = await request.get(`${BASE}/share/${shareTokenPw}/inventory`, {
      headers: { "X-Share-Password": "wrongpassword" },
    });
    expect(wrongRes.status()).toBe(401);

    // Correct password → 200
    const correctRes = await request.get(`${BASE}/share/${shareTokenPw}/inventory`, {
      headers: { "X-Share-Password": "secret123" },
    });
    expect(correctRes.status()).toBe(200);
    const correctBody = await correctRes.json();
    expect(correctBody.data.inventory_id).toBe(invZ);
  });
});
