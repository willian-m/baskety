import { expect, test } from "@playwright/test";

const BASE = "/api/v1";
const RUN_ID = Date.now();
const emailA01 = `test-a01-${RUN_ID}@baskety.test`;

test.describe.serial("Auth", () => {
  let tokenA01: string;

  // A01 — Register new user
  test("A01 register new user", async ({ request }) => {
    const res = await request.post(`${BASE}/auth/register`, {
      data: { email: emailA01, name: "Alice", password: "password123" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeTruthy();
    expect(typeof body.data.id).toBe("string");
    expect(body.data.email).toBe(emailA01);
    expect(body.data).not.toHaveProperty("password");
  });

  // A02 — Register duplicate email
  test("A02 register duplicate email", async ({ request }) => {
    const res = await request.post(`${BASE}/auth/register`, {
      data: { email: emailA01, name: "Bob", password: "other" },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // A03 — Register with missing required fields
  test("A03 register missing fields", async ({ request }) => {
    const res = await request.post(`${BASE}/auth/register`, {
      data: { email: `missing-${RUN_ID}@baskety.test` },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // A04 — Login with valid credentials
  test("A04 login valid credentials", async ({ request }) => {
    const res = await request.post(`${BASE}/auth/login`, {
      data: { email: emailA01, password: "password123" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.token).toBeTruthy();
    tokenA01 = body.data.token as string;
  });

  // A05 — Login with invalid password
  test("A05 login invalid password", async ({ request }) => {
    const res = await request.post(`${BASE}/auth/login`, {
      data: { email: emailA01, password: "wrongpassword" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // A06 — Logout revokes token
  test("A06 logout revokes token", async ({ request }) => {
    const res = await request.delete(`${BASE}/auth/session`, {
      headers: { Authorization: `Bearer ${tokenA01}` },
    });
    expect(res.status()).toBe(204);
  });

  // A07 — Revoked token rejected on protected route
  test("A07 revoked token rejected", async ({ request }) => {
    const res = await request.get(`${BASE}/households`, {
      headers: { Authorization: `Bearer ${tokenA01}` },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
