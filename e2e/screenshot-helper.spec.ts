/**
 * Helper test for capturing screenshots via Playwright
 * This is a workaround for the Playwright MCP server not supporting ignoreHTTPSErrors
 *
 * Usage:
 *   CI='' npx playwright test e2e/screenshot-helper.spec.ts --project=mock-chromium
 *
 * Note: This test is designed to help GitHub Copilot Coding Agents capture screenshots
 * when the Playwright MCP browser tools fail due to TLS certificate errors.
 * See docs/PLAYWRIGHT_TLS_WORKAROUND.md for details.
 */

import { test, expect } from "@playwright/test";

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

test.describe("Screenshot Helper", () => {
  test("capture homepage screenshot", async ({ page }) => {
    // Navigate to the app
    await page.goto("https://localhost:8080");

    // Wait for the app to load
    await page.waitForSelector("#app", { timeout: 10000 });

    // Take a screenshot
    await page.screenshot({
      path: "screenshot-homepage.png",
      fullPage: true,
    });

    console.log("✓ Screenshot saved to screenshot-homepage.png");
  });

  test("capture app loaded state", async ({ page }) => {
    // Navigate to the app
    await page.goto("https://localhost:8080");

    // Wait for React to render
    await page.waitForSelector("#app", { timeout: 10000 });

    // Wait a bit more for any dynamic content
    await page.waitForTimeout(2000);

    // Take a screenshot
    await page.screenshot({
      path: "screenshot-app-loaded.png",
      fullPage: true,
    });

    console.log("✓ Screenshot saved to screenshot-app-loaded.png");
  });

  test("capture monitor page with mock SDR", async ({ page }) => {
    // Navigate to the monitor page with mock SDR
    await page.goto("https://localhost:8080/monitor?mockSdr=1");

    // Wait for the page to load
    await page.waitForSelector("#app", { timeout: 10000 });

    // Wait for UI to stabilize
    await page.waitForTimeout(1000);

    // Take a screenshot
    await page.screenshot({
      path: "screenshot-monitor-mock.png",
      fullPage: true,
    });

    console.log("✓ Screenshot saved to screenshot-monitor-mock.png");
  });

  test("capture specific element screenshot", async ({ page }) => {
    // Navigate to the app
    await page.goto("https://localhost:8080");

    // Wait for the app to load
    await page.waitForSelector("#app", { timeout: 10000 });

    // Wait for content
    await page.waitForTimeout(1000);

    // Take a screenshot of just the app container
    const appElement = await page.locator("#app");
    await appElement.screenshot({
      path: "screenshot-app-element.png",
    });

    console.log("✓ Screenshot saved to screenshot-app-element.png");
  });

  test("capture viewport screenshot", async ({ page }) => {
    // Navigate to the app
    await page.goto("https://localhost:8080");

    // Wait for the app to load
    await page.waitForSelector("#app", { timeout: 10000 });

    // Wait for content
    await page.waitForTimeout(1000);

    // Take a screenshot of just the viewport (not full page)
    await page.screenshot({
      path: "screenshot-viewport.png",
      fullPage: false,
    });

    console.log("✓ Screenshot saved to screenshot-viewport.png");
  });
});
