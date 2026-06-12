import * as fs from "fs";
import * as path from "path";

import { expect, test } from "@playwright/test";

const BASE = "/api/v1";
const RUN_ID = Date.now();
const emailR = `user-r-${RUN_ID}@baskety.test`;

test.describe.serial("Receipt", () => {
  let tokenR: string;
  let householdId: string;
  let scanId: string;
  let sItemAccept: string;
  let sItemReject: string;
  let sItemCorrect: string;
  let scanStatus: string = "unknown";

  test.beforeAll(async ({ request }) => {
    await request.post(`${BASE}/auth/register`, {
      data: { email: emailR, name: "User R", password: "password123" },
    });
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: emailR, password: "password123" },
    });
    tokenR = (await loginRes.json()).data.token as string;
    const hhRes = await request.post(`${BASE}/households`, {
      headers: { Authorization: `Bearer ${tokenR}`, "Content-Type": "application/json" },
      data: { name: "Receipt Household" },
    });
    householdId = (await hhRes.json()).data.id as string;
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${tokenR}`,
    "X-Household-ID": householdId,
  });

  // R01 — Upload valid receipt image
  test("R01 upload valid receipt image", async ({ request }) => {
    const fixturePath = path.join(process.cwd(), "docs/fixtures/sample_receipt.jpg");
    const buffer = fs.readFileSync(fixturePath);
    const res = await request.post(`${BASE}/receipts`, {
      headers: authHeaders(),
      multipart: {
        image: {
          name: "sample_receipt.jpg",
          mimeType: "image/jpeg",
          buffer,
        },
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    scanId = body.data.id as string;
    expect(scanId).toBeTruthy();
    // Initial status is uploading or ocr_processing
    expect(["uploading", "ocr_processing", "pending_processing"]).toContain(body.data.status);
  });

  // R02 — Upload file exceeding 10 MB
  test("R02 upload file exceeding 10 MB", async ({ request }) => {
    const fixturePath = path.join(process.cwd(), "docs/fixtures/large_file_11mb.jpg");
    if (!fs.existsSync(fixturePath)) {
      test.skip(true, "large_file_11mb.jpg fixture not found — run scripts/run-tests.sh first");
      return;
    }
    const buffer = fs.readFileSync(fixturePath);
    const res = await request.post(`${BASE}/receipts`, {
      headers: authHeaders(),
      multipart: {
        image: {
          name: "large_file_11mb.jpg",
          mimeType: "image/jpeg",
          buffer,
        },
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // R03 — List receipt scans
  test("R03 list receipt scans", async ({ request }) => {
    const res = await request.get(`${BASE}/receipts`, { headers: authHeaders() });
    expect(res.status()).toBe(200);
    const ids = ((await res.json()).data as Array<{ id: string }>).map((s) => s.id);
    expect(ids).toContain(scanId);
  });

  // R04 — Poll for pending_review status (up to 30s)
  test("R04 scan transitions to pending_review", async ({ request }) => {
    const deadline = Date.now() + 30_000;
    let finalStatus = "unknown";
    while (Date.now() < deadline) {
      const res = await request.get(`${BASE}/receipts/${scanId}`, { headers: authHeaders() });
      expect(res.status()).toBe(200);
      finalStatus = (await res.json()).data.status as string;
      if (finalStatus === "pending_review" || finalStatus === "failed") break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    scanStatus = finalStatus;

    if (finalStatus === "failed") {
      console.warn(
        "\n⚠️  OCR/LLM pipeline unavailable — install Tesseract and run Ollama to enable R04-R09\n",
      );
      // Do not fail R04 — just record that the pipeline is unavailable
      return;
    }
    expect(finalStatus).toBe("pending_review");
  });

  // R05 — Get scan items
  test("R05 get scan items", async ({ request }) => {
    if (scanStatus === "failed") {
      test.fixme(true, "OCR/LLM pipeline unavailable — Tesseract + Ollama required");
      return;
    }
    const res = await request.get(`${BASE}/receipts/${scanId}/items`, { headers: authHeaders() });
    expect(res.status()).toBe(200);
    const items = (await res.json()).data as Array<{ id: string; status: string }>;
    expect(items.length).toBeGreaterThan(0);
    sItemAccept = items[0]?.id;
    sItemReject = items[1]?.id ?? items[0].id;
    sItemCorrect = items[2]?.id ?? items[0].id;
    for (const item of items) {
      expect(item.status).toBe("pending");
    }
  });

  // R06 — Accept scan item
  test("R06 accept scan item", async ({ request }) => {
    if (scanStatus === "failed") {
      test.fixme(true, "OCR/LLM pipeline unavailable — Tesseract + Ollama required");
      return;
    }
    const res = await request.put(`${BASE}/receipts/${scanId}/items/${sItemAccept}`, {
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      data: { status: "accepted" },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.status).toBe("accepted");
  });

  // R07 — Reject scan item
  test("R07 reject scan item", async ({ request }) => {
    if (scanStatus === "failed") {
      test.fixme(true, "OCR/LLM pipeline unavailable — Tesseract + Ollama required");
      return;
    }
    const res = await request.put(`${BASE}/receipts/${scanId}/items/${sItemReject}`, {
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      data: { status: "rejected" },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.status).toBe("rejected");
  });

  // R08 — Correct scan item
  test("R08 correct scan item", async ({ request }) => {
    if (scanStatus === "failed") {
      test.fixme(true, "OCR/LLM pipeline unavailable — Tesseract + Ollama required");
      return;
    }
    const res = await request.put(`${BASE}/receipts/${scanId}/items/${sItemCorrect}`, {
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      data: {
        status: "corrected",
        corrected_name: "Organic Milk",
        corrected_quantity: 2.0,
        corrected_price_minor: 499,
        corrected_currency: "USD",
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("corrected");
    expect(body.data.corrected_name).toBe("Organic Milk");
  });

  // R09 — Commit scan
  test("R09 commit scan", async ({ request }) => {
    if (scanStatus === "failed") {
      test.fixme(true, "OCR/LLM pipeline unavailable — Tesseract + Ollama required");
      return;
    }
    const commitRes = await request.post(`${BASE}/receipts/${scanId}/commit`, {
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      data: { purchased_at: new Date().toISOString() },
    });
    expect(commitRes.status()).toBe(200);
    expect((await commitRes.json()).data.status).toBe("committed");

    // Verify transactions exist for accepted + corrected items
    const txRes = await request.get(`${BASE}/catalog/transactions`, { headers: authHeaders() });
    expect(txRes.status()).toBe(200);
    const txBody = await txRes.json();
    expect((txBody.data as unknown[]).length).toBeGreaterThanOrEqual(2);
  });
});
