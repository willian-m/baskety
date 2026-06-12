import { expect, type Page, request as pwRequest, test } from "@playwright/test";

const BASE = "http://localhost:8080";
const EMAIL = `f03-flow-${Date.now()}@baskety.test`;
const PASSWORD = "F03P@ss123";

let token = "";
let householdId = "";

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

test.describe.serial("F03: Auto-generate grocery list from inventory shortfalls", () => {
  test.beforeAll(async () => {
    const api = await pwRequest.newContext({ baseURL: BASE });

    await api.post("/api/v1/auth/register", {
      data: { email: EMAIL, name: "F03 Flow User", password: PASSWORD },
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
        data: { name: "F03 Household" },
      });
      householdId = (await createRes.json()).data.id as string;
    }

    const authH = { Authorization: `Bearer ${token}`, "X-Household-ID": householdId };

    // Get or create inventory
    const invRes = await api.get("/api/v1/inventories", { headers: authH });
    const invBody = await invRes.json();
    let inventoryId: string;
    if (invBody.data && invBody.data.length > 0) {
      inventoryId = invBody.data[0].id as string;
    } else {
      const createInvRes = await api.post("/api/v1/inventories", {
        headers: authH,
        data: { name: "F03 Pantry" },
      });
      inventoryId = (await createInvRes.json()).data.id as string;
    }

    // Create Rice item: target=5, then add batch qty=2 → shortfall=3
    const itemRes = await api.post(`/api/v1/inventories/${inventoryId}/items`, {
      headers: authH,
      data: { name: "Rice", category: "Grains", unit: "kg", target_quantity: 5 },
    });
    const itemId = (await itemRes.json()).data.id as string;

    await api.post(`/api/v1/inventories/${inventoryId}/items/${itemId}/batches`, {
      headers: authH,
      data: { quantity: 2, expires_at: null },
    });

    await api.dispose();
  });

  test("clicking Auto-generate creates a list with the shortfall item", async ({ page }) => {
    await seedAuth(page);
    await page.goto("/grocery");
    await expect(page.getByRole("heading", { name: "Grocery Lists" })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("auto-generate-button").click();

    // GroceryPage navigates to /grocery/$listId on success
    await expect(page).toHaveURL(/\/grocery\/.+/, { timeout: 20_000 });

    // The auto-generated list should contain "Rice" (shortfall from target 5 minus batch 2 = 3)
    await expect(page.getByText("Rice")).toBeVisible({ timeout: 10_000 });
  });

  test("add a manual item 'Butter' to the generated list", async ({ page }) => {
    await seedAuth(page);
    await page.goto("/grocery");
    await expect(page.getByRole("heading", { name: "Grocery Lists" })).toBeVisible({
      timeout: 10_000,
    });

    // Open the most recent list (first in sorted order)
    const firstList = page.locator("a[href*='/grocery/']").first();
    await firstList.click();
    await expect(page).toHaveURL(/\/grocery\/.+/);

    // Add "Butter" manually
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByPlaceholder("Item name").fill("Butter");
    // quantity defaults to 1, unit to "pcs"
    await page.getByTestId("add-item-submit").click();

    await expect(page.getByText("Butter")).toBeVisible({ timeout: 10_000 });
  });
});
