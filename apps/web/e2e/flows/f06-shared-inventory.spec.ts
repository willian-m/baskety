import { expect, type Page, request as pwRequest, test } from "@playwright/test";

const BASE = "http://localhost:8080";
const EMAIL = "f06-flow@baskety.test";
const PASSWORD = "F06P@ss123";
const SHARE_PASSWORD = "sharepass6";

let token = "";
let householdId = "";
let inventoryId = "";
let shareToken = "";

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

test.describe.serial("F06: Share link creation and password-protected public access", () => {
  test.beforeAll(async () => {
    const api = await pwRequest.newContext({ baseURL: BASE });

    await api.post("/api/v1/auth/register", {
      data: { email: EMAIL, name: "F06 Flow User", password: PASSWORD },
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
        data: { name: "F06 Household" },
      });
      householdId = (await createRes.json()).data.id as string;
    }

    const authH = { Authorization: `Bearer ${token}`, "X-Household-ID": householdId };

    // Create inventory
    const createInvRes = await api.post("/api/v1/inventories", {
      headers: authH,
      data: { name: "F06 Pantry" },
    });
    inventoryId = (await createInvRes.json()).data.id as string;

    // Add an item so the shared view is non-empty
    await api.post(`/api/v1/inventories/${inventoryId}/items`, {
      headers: authH,
      data: { name: "Pasta", category: "Grains", unit: "kg", target_quantity: 2 },
    });

    await api.dispose();
  });

  test("F06-a: create a password-protected share link via settings UI", async ({ page }) => {
    await seedAuth(page);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 10_000 });

    // Select the F06 Pantry inventory from the dropdown
    await page.getByTestId("share-inventory-select").selectOption({ label: "F06 Pantry" });
    await page.getByTestId("share-password-input").fill(SHARE_PASSWORD);
    await page.getByTestId("share-create-button").click();

    // The share link URL should appear
    const urlInput = page.getByTestId("share-link-url");
    await expect(urlInput).toBeVisible({ timeout: 10_000 });

    const fullUrl = await urlInput.inputValue();
    const tokenMatch = fullUrl.match(/\/share\/([a-zA-Z0-9_-]+)/);
    if (tokenMatch) shareToken = tokenMatch[1];

    expect(shareToken).not.toBe("");
  });

  test("F06-b: wrong password shows error; correct password shows inventory", async ({
    browser,
  }) => {
    if (!shareToken) test.skip(true, "No share token from previous step");

    // Use an incognito-like context (no localStorage, no auth)
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();

    try {
      await page.goto(`/share/${shareToken}`);

      // Should see the password prompt immediately (share has no-auth endpoint → 401)
      await expect(page.getByRole("heading", { name: "Password required" })).toBeVisible({
        timeout: 10_000,
      });

      // Wrong password
      await page.locator('input[type="password"]').fill("wrongpass");
      await page.getByRole("button", { name: "Unlock" }).click();
      await expect(page.getByText("Incorrect password, please try again.")).toBeVisible({
        timeout: 10_000,
      });

      // Correct password
      await page.locator('input[type="password"]').fill(SHARE_PASSWORD);
      await page.getByRole("button", { name: "Unlock" }).click();

      // Should render shared inventory view
      await expect(page.getByRole("heading", { name: "Shared Inventory" })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText("Pasta")).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });
});
