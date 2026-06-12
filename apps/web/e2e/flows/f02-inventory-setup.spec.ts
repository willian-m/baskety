import { expect, type Page, request as pwRequest, test } from "@playwright/test";

const BASE = "http://localhost:8080";
const EMAIL = `f02-flow-${Date.now()}@baskety.test`;
const PASSWORD = "F02P@ss123";

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

test.describe.serial("F02: Inventory item and batch management via UI", () => {
  test.beforeAll(async () => {
    const api = await pwRequest.newContext({ baseURL: BASE });

    // Idempotent: ignore 409 if user already exists
    await api.post("/api/v1/auth/register", {
      data: { email: EMAIL, name: "F02 Flow User", password: PASSWORD },
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
        data: { name: "F02 Household" },
      });
      householdId = (await createRes.json()).data.id as string;
    }

    // Ensure at least one inventory exists so InventoryPage renders instead of SetupWizard
    const invRes = await api.get("/api/v1/inventories", {
      headers: { Authorization: `Bearer ${token}`, "X-Household-ID": householdId },
    });
    const invBody = await invRes.json();
    if (!invBody.data || invBody.data.length === 0) {
      await api.post("/api/v1/inventories", {
        headers: { Authorization: `Bearer ${token}`, "X-Household-ID": householdId },
        data: { name: "F02 Pantry" },
      });
    }

    await api.dispose();
  });

  test("add an item to the inventory via UI", async ({ page }) => {
    await seedAuth(page);
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Add item" }).click();

    const unique = `Rice-${Date.now().toString(36)}`;
    await page.getByPlaceholder("Name").fill(unique);
    await page.getByPlaceholder("Category").fill("Grains");
    await page.getByPlaceholder("Unit (e.g. kg)").fill("kg");
    await page.getByPlaceholder("Target qty").fill("5");
    // "Add" button inside the add-item panel
    await page.getByTestId("add-item-submit").click();

    await expect(page.getByText(unique)).toBeVisible({ timeout: 10_000 });
  });

  test("navigate into item detail and add a batch", async ({ page }) => {
    await seedAuth(page);
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible({ timeout: 10_000 });

    // Click the first item in the list (the one we just created)
    const firstLink = page.locator("a[href*='/inventory/']").first();
    await firstLink.click();

    await expect(page).toHaveURL(/\/inventory\/.+/);
    await expect(page.getByRole("button", { name: "Add batch" })).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Add batch" }).click();
    await page.getByPlaceholder("Quantity").fill("2");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    // Batch row should show "2 kg"
    await expect(page.getByText(/2 kg/)).toBeVisible({ timeout: 10_000 });
  });
});
