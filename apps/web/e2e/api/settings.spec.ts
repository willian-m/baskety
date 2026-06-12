import { expect, test } from "@playwright/test";

const BASE = "/api/v1";
const RUN_ID = Date.now();
const emailS = `user-s-${RUN_ID}@baskety.test`;

test.describe.serial("Settings", () => {
  let tokenS: string;
  let householdId: string;
  let llmId: string;
  let ocrId: string;

  test.beforeAll(async ({ request }) => {
    await request.post(`${BASE}/auth/register`, {
      data: { email: emailS, name: "User S", password: "password123" },
    });
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: emailS, password: "password123" },
    });
    tokenS = (await loginRes.json()).data.token as string;

    const hhRes = await request.post(`${BASE}/households`, {
      headers: { Authorization: `Bearer ${tokenS}`, "Content-Type": "application/json" },
      data: { name: "Settings Household" },
    });
    householdId = (await hhRes.json()).data.id as string;
  });

  const authHeaders = (extraHeaders?: Record<string, string>) => ({
    Authorization: `Bearer ${tokenS}`,
    "X-Household-ID": householdId,
    "Content-Type": "application/json",
    ...extraHeaders,
  });

  // S01 — Upsert household setting
  test("S01 upsert household setting", async ({ request }) => {
    const res = await request.put(`${BASE}/settings/household/theme`, {
      headers: authHeaders(),
      data: { value: "dark" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.key).toBe("theme");
    expect(body.data.value).toBe("dark");
  });

  // S02 — Get household setting
  test("S02 get household setting", async ({ request }) => {
    const res = await request.get(`${BASE}/settings/household/theme`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.value).toBe("dark");
  });

  // S03 — Get non-existent household setting
  test("S03 get nonexistent setting returns 404", async ({ request }) => {
    const res = await request.get(`${BASE}/settings/household/nonexistent_key`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // S04 — Upsert user setting
  test("S04 upsert user setting", async ({ request }) => {
    const res = await request.put(`${BASE}/settings/user/language`, {
      headers: { Authorization: `Bearer ${tokenS}`, "Content-Type": "application/json" },
      data: { value: "pt-BR" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.key).toBe("language");
    expect(body.data.value).toBe("pt-BR");
  });

  // S05 — Get user setting
  test("S05 get user setting", async ({ request }) => {
    const res = await request.get(`${BASE}/settings/user/language`, {
      headers: { Authorization: `Bearer ${tokenS}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.value).toBe("pt-BR");
  });

  // S06 — Create LLM provider
  test("S06 create LLM provider", async ({ request }) => {
    const res = await request.post(`${BASE}/settings/providers/llm`, {
      headers: authHeaders(),
      data: {
        provider: "ollama",
        model: "llama3",
        endpoint_url: "http://localhost:11434",
        is_default: true,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.provider).toBe("ollama");
    expect(body.data.model).toBe("llama3");
    expect(body.data.has_api_key).toBe(false);
    expect(body.data.is_default).toBe(true);
    expect(body.data).not.toHaveProperty("api_key");
    llmId = body.data.id as string;
  });

  // S07 — List LLM providers
  test("S07 list LLM providers", async ({ request }) => {
    const res = await request.get(`${BASE}/settings/providers/llm`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = (body.data as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(llmId);
  });

  // S08 — Create and list OCR provider
  test("S08 create and list OCR provider", async ({ request }) => {
    const createRes = await request.post(`${BASE}/settings/providers/ocr`, {
      headers: authHeaders(),
      data: { provider: "tesseract", is_default: true },
    });
    expect(createRes.status()).toBe(201);
    ocrId = (await createRes.json()).data.id as string;

    const listRes = await request.get(`${BASE}/settings/providers/ocr`, {
      headers: authHeaders(),
    });
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    const ids = (listBody.data as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(ocrId);
  });
});
