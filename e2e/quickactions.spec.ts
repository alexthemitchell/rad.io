/**
 * E2E test for QuickActions component on Monitor page
 */

import { test, expect } from "@playwright/test";

test.describe("QuickActions on Monitor Page", () => {
  test("should display quick actions toolbar", async ({ page }) => {
    await page.goto("/monitor");

    // Wait for the page to load
    await page.waitForSelector('[aria-label="Quick actions toolbar"]');

    // Take screenshot of the Monitor page with Quick Actions
    await page.screenshot({
      path: "test-results/quick-actions-monitor-page.png",
      fullPage: true,
    });

    // Check that Quick Actions toolbar is visible
    const quickActions = page.locator('[aria-label="Quick actions toolbar"]');
    await expect(quickActions).toBeVisible();

    // Check that all 4 buttons are present
    const bookmarkButton = page.locator(
      'button[aria-label="Bookmark current frequency (B)"]',
    );
    const recordButton = page.locator('button[aria-label*="recording"]');
    const gridButton = page.locator(
      'button[aria-label*="grid"][aria-label*="(G)"]',
    );
    const helpButton = page.locator(
      'button[aria-label="Show keyboard shortcuts (?)"]',
    );

    await expect(bookmarkButton).toBeVisible();
    await expect(recordButton).toBeVisible();
    await expect(gridButton).toBeVisible();
    await expect(helpButton).toBeVisible();
  });

  test("should show tooltip on hover", async ({ page }) => {
    await page.goto("/monitor");

    // Wait for Quick Actions to be visible
    await page.waitForSelector('[aria-label="Quick actions toolbar"]');

    // Hover over bookmark button
    const bookmarkButton = page.locator(
      'button[aria-label="Bookmark current frequency (B)"]',
    );
    await bookmarkButton.hover();

    // Check for tooltip
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText("Bookmark (B)");

    // Take screenshot with tooltip
    await page.screenshot({
      path: "test-results/quick-actions-tooltip.png",
    });
  });

  test("should toggle recording state", async ({ page }) => {
    await page.goto("/monitor");

    // Wait for Quick Actions to be visible
    await page.waitForSelector('[aria-label="Quick actions toolbar"]');

    const recordButton = page.locator('button[aria-label*="recording"]');

    // Check initial state
    await expect(recordButton).toHaveAttribute("aria-pressed", "false");

    // Click to start recording
    await recordButton.click();

    // Wait for aria-pressed to become true
    await expect(recordButton).toHaveAttribute("aria-pressed", "true", {
      timeout: 1000,
    });

    // Check that the button has the recording class
    await expect(recordButton).toHaveClass(/recording/);

    // Take screenshot of recording state
    await page.screenshot({
      path: "test-results/quick-actions-recording-active.png",
    });
  });

  test("should toggle grid visibility", async ({ page }) => {
    await page.goto("/monitor");

    // Wait for Quick Actions to be visible
    await page.waitForSelector('[aria-label="Quick actions toolbar"]');

    const gridButton = page.locator(
      'button[aria-label*="grid"][aria-label*="(G)"]',
    );

    // Get initial aria-pressed value
    const initialPressed = await gridButton.getAttribute("aria-pressed");

    // Click to toggle grid
    await gridButton.click();

    // Wait for aria-pressed to toggle
    const toggledPressed = initialPressed === "true" ? "false" : "true";
    await expect(gridButton).toHaveAttribute("aria-pressed", toggledPressed, {
      timeout: 1000,
    });

    // Take screenshot
    await page.screenshot({
      path: "test-results/quick-actions-grid-toggled.png",
    });
  });
});
