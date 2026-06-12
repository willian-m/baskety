import { expect, type Page, request as pwRequest, test } from "@playwright/test";

const BASE = "http://localhost:8080";
const EMAIL = "f04-flow@baskety.test";
const PASSWORD = "F04P@ss123";

let token = "";
let householdId = "";
let inventoryId = "";
let listId = "";

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

test.describe.serial("F04: Shopping trip — check off items and complete the list", () => {
  test.beforeAll(async () => {
    const api = await pwRequest.newContext({ baseURL: BASE });

    await api.post("/api/v1/auth/register", {
      data: { email: EMAIL, name: "F04 Flow User", password: PASSWORD },
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
        data: { name: "F04 Household" },
      });
      householdId = (await createRes.json()).data.id as string;
    }

    const authH = { Authorization: `Bearer ${token}`, "X-Household-ID": householdId };

    // Create inventory
    const createInvRes = await api.post("/api/v1/inventories", {
      headers: authH,
      data: { name: "F04 Pantry" },
    });
    inventoryId = (await createInvRes.json()).data.id as string;

    // Create grocery list
    const listRes = await api.post(`/api/v1/inventories/${inventoryId}/lists`, {
      headers: authH,
      data: { name: "F04 Shopping List" },
    });
    listId = (await listRes.json()).data.id as string;

    // Add two items to the list
    for (const name of ["Apples", "Milk"]) {
      await api.post(`/api/v1/inventories/${inventoryId}/lists/${listId}/items`, {
        headers: authH,
        data: { name, quantity: 1, unit: "pcs" },
      });
    }

    await api.dispose();
  });

  test("check off an item (pending → bought)", async ({ page }) => {
    await seedAuth(page);
    await page.goto(`/grocery/${listId}`);
    await expect(page.getByRole("heading", { name: "F04 Shopping List" })).toBeVisible({
      timeout: 10_000,
    });

    // Check the first item checkbox
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(firstCheckbox).not.toBeChecked();
    await firstCheckbox.click();
    await expect(firstCheckbox).toBeChecked({ timeout: 10_000 });
  });

  test("complete the list and return to grocery list view", async ({ page }) => {
    await seedAuth(page);
    await page.goto(`/grocery/${listId}`);
    await expect(page.getByRole("heading", { name: "F04 Shopping List" })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "Complete list" }).click();

    // After completing, GroceryListPage navigates to /grocery
    await expect(page).toHaveURL(/\/grocery$/, { timeout: 10_000 });

    // The list should now show as "completed"
    await expect(page.getByText("completed")).toBeVisible({ timeout: 10_000 });
  });
});
