import * as path from "path";

import { expect, type Page, request as pwRequest, test } from "@playwright/test";

const BASE = "http://localhost:8080";
const EMAIL = "f05-flow@baskety.test";
const PASSWORD = "F05P@ss123";
const FIXTURE = path.resolve(__dirname, "../../../..", "docs/fixtures/sample_receipt.jpg");

let token = "";
let householdId = "";
let scanId = "";
let scanStatus = "";

function seedAuth(page: Page) {
  return page.addInitScript(
    ([t, hh]: [string, string]) => {
      localStorage.setItem(
        "baskety-ui",
        JSON.stringify({
          state: {
            token: t,
            activeHouseholdId: hh,
            externalUrl: null,
            networkProfiles: [],
            sidebarCollapsed: false,
          },
          version: 0,
        }),
      );
    },
    [token, householdId] as [string, string],
  );
}

test.describe.serial("F05: Receipt upload and review", () => {
  test.beforeAll(async () => {
    const api = await pwRequest.newContext({ baseURL: BASE });

    await api.post("/api/v1/auth/register", {
      data: { email: EMAIL, name: "F05 Flow User", password: PASSWORD },
    });

    const loginRes = await api.post("/api/v1/auth/login", {
      data: { email: EMAIL, password: PASSWORD },
    });
    token = (await loginRes.json()).data.token;

    const hhRes = await api.get("/api/v1/households", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const hhBody = await hhRes.json();
    if (hhBody.data && hhBody.data.length > 0) {
      householdId = hhBody.data[0].id as string;
    } else {
      const createRes = await api.post("/api/v1/households", {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: "F05 Household" },
      });
      householdId = (await createRes.json()).data.id as string;
    }

    // Create an inventory so the app doesn't block on SetupWizard
    const invRes = await api.get("/api/v1/inventories", {
      headers: { Authorization: `Bearer ${token}`, "X-Household-ID": householdId },
    });
    const invBody = await invRes.json();
    if (!invBody.data || invBody.data.length === 0) {
      await api.post("/api/v1/inventories", {
        headers: { Authorization: `Bearer ${token}`, "X-Household-ID": householdId },
        data: { name: "F05 Pantry" },
      });
    }

    await api.dispose();
  });

  test("F05-a: upload receipt and see success message", async ({ page }) => {
    await seedAuth(page);
    await page.goto("/receipt");
    await expect(page.getByRole("heading", { name: "Receipts" })).toBeVisible({ timeout: 10_000 });

    // Select file
    await page.setInputFiles('input[type="file"]', FIXTURE);

    // Upload
    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByText("Scan started successfully.")).toBeVisible({ timeout: 15_000 });
  });

  test("F05-b: scan appears in list; navigate to review page", async ({ page }) => {
    await seedAuth(page);
    await page.goto("/receipt");
    await expect(page.getByRole("heading", { name: "Receipts" })).toBeVisible({ timeout: 10_000 });

    // Wait for the scan row to appear
    const scanLink = page.locator("a[href*='/receipt/']").first();
    await expect(scanLink).toBeVisible({ timeout: 15_000 });

    // Extract the scanId from the href
    const href = await scanLink.getAttribute("href");
    const match = href?.match(/\/receipt\/([^/]+)\/review/);
    if (match) scanId = match[1];

    await scanLink.click();
    await expect(page).toHaveURL(/\/receipt\/.+\/review/);
  });

  test("F05-c: poll for pipeline result; accept items and commit if available", async ({
    page,
  }) => {
    if (!scanId) test.skip(true, "No scan ID from previous step — skipping review");

    // Poll the API directly for scan status (up to 30s)
    const api = await pwRequest.newContext({ baseURL: BASE });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const res = await api.get(`/api/v1/receipts/${scanId}`, {
        headers: { Authorization: `Bearer ${token}`, "X-Household-ID": householdId },
      });
      const body = await res.json();
      scanStatus = body.data?.status as string;
      if (scanStatus === "pending_review" || scanStatus === "failed") break;
      await new Promise((r) => setTimeout(r, 2_000));
    }
    await api.dispose();

    if (scanStatus !== "pending_review") {
      test.fixme(
        true,
        "OCR/LLM pipeline unavailable — install Tesseract and run Ollama to enable this test",
      );
      return;
    }

    await seedAuth(page);
    await page.goto(`/receipt/${scanId}/review`);
    await expect(page.getByRole("heading", { name: "Review Scan" })).toBeVisible({
      timeout: 10_000,
    });

    // Accept all items
    const acceptButtons = page.getByRole("button", { name: "Accept" });
    const count = await acceptButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = acceptButtons.nth(i);
      if (await btn.isEnabled()) await btn.click();
    }

    // Commit to inventory
    await expect(page.getByRole("button", { name: "Commit to inventory" })).toBeEnabled({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Commit to inventory" }).click();

    await expect(page).toHaveURL(/\/receipt$/, { timeout: 10_000 });
  });
});
