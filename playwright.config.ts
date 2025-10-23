import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for rad.io E2E tests
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",

  /* Maximum time one test can run for */
  timeout: 30 * 1000,

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL for navigation */
    baseURL: "https://localhost:8080",

    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Ignore HTTPS errors for self-signed certificates in development */
    ignoreHTTPSErrors: true,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "npm start",
    url: "https://localhost:8080",
    reuseExistingServer: !process.env.CI,
    ignoreHTTPSErrors: true,
    timeout: 120 * 1000,
  },
});
