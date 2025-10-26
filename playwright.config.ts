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
  // Parallelism can spike Chromium memory usage due to multiple renderers.
  // Keep per-file parallelism off to reduce peak memory.
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env["CI"],

  /* Retry on CI only */
  retries: process.env["CI"] ? 2 : 0,

  /* Constrain workers to prevent local OOM from too many Chromium instances */
  workers: process.env["CI"] ? 1 : 2,

  /* Reporter to use */
  // Include GitHub reporter for richer annotations in CI
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["list"],
    ["github"],
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL for navigation */
    baseURL: "https://localhost:8080",

    /* Collect trace when retrying the failed test */
    // Keep traces only on failure to avoid accumulating large artifacts in long runs
    trace: "retain-on-failure",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Ignore HTTPS errors for self-signed certificates in development */
    ignoreHTTPSErrors: true,

    // Ensure headless by default; headed runs can consume more GPU memory
    headless: true,

    // Reduce renderer/GPU memory spikes in constrained environments (Linux CI), harmless elsewhere
    launchOptions: {
      args: [
        "--disable-dev-shm-usage",
        // Keep process count modest; avoids too many renderer processes in some environments
        "--renderer-process-limit=2",
        // Avoid site isolation spawning too many processes for same-site frames
        "--disable-site-isolation-trials",
      ],
    },
  },

  /* Configure projects to separate mock vs real tests */
  projects: (() => {
    const baseProject = {
      name: "mock-chromium",
      use: { ...devices["Desktop Chrome"] },
      // Run everything except @real tests
      grepInvert: /@real/,
    } as const;

    // Only add the real device project when explicitly enabled to avoid spinning
    // up an extra Chrome instance that does no work but consumes memory.
    if (process.env["E2E_REAL_HACKRF"] === "1") {
      return [
        baseProject,
        {
          name: "real-chromium",
          use: { ...devices["Desktop Chrome"] },
          grep: /@real/,
        },
      ];
    }

    return [baseProject];
  })(),

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "npm start",
    url: "https://localhost:8080",
    reuseExistingServer: !process.env["CI"],
    ignoreHTTPSErrors: true,
    timeout: 120 * 1000,
  },
});
