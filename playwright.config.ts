import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  globalSetup: "./apps/web/e2e/global-setup.ts",
  projects: [
    {
      name: "api",
      testMatch: "**/api/**/*.spec.ts",
      use: { baseURL: "http://localhost:8080" },
    },
    {
      name: "chromium",
      testMatch: "**/flows/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5173" },
    },
  ],
  webServer: {
    command: "pnpm --filter @baskety/web dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
