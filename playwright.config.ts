import { defineConfig, devices } from "@playwright/test";

/**
 * Test tag patterns for organizing e2e tests
 */
const REAL_TAG = /@real/;
const SIMULATED_TAG = /@simulated/;
const DEVICE_TAG = /@device/;

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
    ["html", { outputFolder: "playwright-report", open: "never" }],
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

  /* Configure projects to separate mock vs real vs device tests */
  projects: (() => {
    const mockProject = {
      name: "mock-chromium",
      use: { ...devices["Desktop Chrome"] },
      // Run everything except @real, @simulated, and @device tests
      grepInvert: new RegExp(
        `${REAL_TAG.source}|${SIMULATED_TAG.source}|${DEVICE_TAG.source}`,
      ),
    };

    const simulatedProject = {
      name: "simulated",
      use: { ...devices["Desktop Chrome"] },
      // Run only @simulated tests
      grep: SIMULATED_TAG,
    };

    const projects = [mockProject, simulatedProject];

    // Only add the real device project when explicitly enabled to avoid spinning
    // up an extra Chrome instance that does no work but consumes memory.
    if (process.env["E2E_REAL_HACKRF"] === "1") {
      projects.push({
        name: "real-chromium",
        use: { ...devices["Desktop Chrome"] },
        grep: REAL_TAG,
      });
    }

    // Add the device project when RADIO_E2E_DEVICE=1 is set
    // This runs hardware-in-the-loop visualization tests with a physical device
    if (process.env["RADIO_E2E_DEVICE"] === "1") {
      projects.push({
        name: "device",
        use: { ...devices["Desktop Chrome"] },
        grep: DEVICE_TAG,
      });
    }

    // Optional GPU-accelerated local project.
    // Enables WebGL/WebGPU in headed Chrome for richer visualization testing.
    // Usage: RADIO_E2E_GPU=1 npm run test:e2e -- --project=gpu-chromium
    if (process.env["RADIO_E2E_GPU"] === "1") {
      projects.push({
        name: "gpu-chromium",
        use: {
          ...(devices["Desktop Chrome"] as any),
          headless: false as any,
          launchOptions: {
            args: [
              "--ignore-gpu-blocklist",
              "--enable-webgl",
              "--enable-accelerated-2d-canvas",
              "--use-gl=desktop",
              // Enable WebGPU on browsers that gate it behind a flag
              "--enable-unsafe-webgpu",
            ],
          } as any,
        } as any,
        grep: new RegExp(`${SIMULATED_TAG.source}|${DEVICE_TAG.source}`),
      });
    }

    return projects;
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
