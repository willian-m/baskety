import { expect, test } from "@playwright/test";

// Use a timestamp suffix so re-runs don't collide with the persisted DB row
const SUFFIX = Date.now().toString(36);
const EMAIL = `f01-${SUFFIX}@baskety.test`;
const PASSWORD = "F01P@ss123";

test.describe.serial("F01: Registration, login, and logout", () => {
  test("register a new account, auto-login, see nav, then logout", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Baskety" })).toBeVisible();

    await page.fill("#name", "F01 User");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    // RegisterPage auto-logs in on success and redirects to "/"
    await expect(page).toHaveURL(/^\/(inventory)?(\?.*)?$/, { timeout: 15_000 });

    // Nav bar rendered by AppLayout should be visible
    await expect(page.getByTestId("logout-button")).toBeVisible({ timeout: 10_000 });

    // Clicking logout clears session and sends user back to /login
    await page.getByTestId("logout-button").click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("login with existing account and reach the app", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/^\/(inventory)?(\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByTestId("logout-button")).toBeVisible();
  });
});
