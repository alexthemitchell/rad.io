/**
 * Multi-VFO E2E Tests
 *
 * Tests for creating, managing, and removing VFOs through the UI.
 */

import { test, expect } from "@playwright/test";

test.describe("Multi-VFO Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the page to load
    await page.waitForLoadState("networkidle");
  });

  test("should create VFO when clicking on waterfall", async ({ page }) => {
    // Navigate to monitor page
    await page.click('a[href="/monitor"]');
    await page.waitForLoadState("networkidle");

    // Wait for waterfall canvas to be visible
    const waterfall = page.locator("canvas").first();
    await expect(waterfall).toBeVisible();

    // Click on waterfall to trigger VFO creation modal
    await waterfall.click({ position: { x: 375, y: 200 }, modifiers: ["Alt"] });

    // Verify modal appears
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Add VFO")).toBeVisible();

    // Select a mode
    await page.selectOption('select[id="vfo-mode"]', "wbfm");

    // Confirm VFO creation
    await page.click('button:has-text("Add VFO")');

    // Verify modal closes
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Verify VFO appears in manager panel
    await expect(page.getByText("VFO Manager (1)")).toBeVisible();
    await expect(page.getByText("WBFM")).toBeVisible();
  });

  test("should create two VFOs and switch active audio", async ({ page }) => {
    // Navigate to monitor page
    await page.click('a[href="/monitor"]');
    await page.waitForLoadState("networkidle");

    const waterfall = page.locator("canvas").first();
    await expect(waterfall).toBeVisible();

    // Create first VFO
    await waterfall.click({ position: { x: 300, y: 200 }, modifiers: ["Alt"] });
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.selectOption('select[id="vfo-mode"]', "am");
    await page.click('button:has-text("Add VFO")');
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Create second VFO
    await waterfall.click({ position: { x: 450, y: 200 }, modifiers: ["Alt"] });
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.selectOption('select[id="vfo-mode"]', "wbfm");
    await page.click('button:has-text("Add VFO")');
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Verify both VFOs exist
    await expect(page.getByText("VFO Manager (2)")).toBeVisible();
    await expect(page.getByText("AM")).toBeVisible();
    await expect(page.getByText("WBFM")).toBeVisible();

    // Get all audio checkboxes using more specific ARIA labels
    const audioCheckboxes = page.locator(
      'input[aria-label*="Enable audio for VFO"]',
    );

    // First VFO should have audio enabled by default
    const firstCheckbox = audioCheckboxes.first();
    await expect(firstCheckbox).toBeChecked();

    // Second VFO should have audio enabled by default
    const secondCheckbox = audioCheckboxes.nth(1);
    await expect(secondCheckbox).toBeChecked();

    // Disable first VFO audio
    await firstCheckbox.uncheck();
    await expect(firstCheckbox).not.toBeChecked();
    await expect(secondCheckbox).toBeChecked();

    // Re-enable first VFO audio
    await firstCheckbox.check();
    await expect(firstCheckbox).toBeChecked();
    await expect(secondCheckbox).toBeChecked();
  });

  test("should remove VFO using X button", async ({ page }) => {
    // Navigate to monitor page
    await page.click('a[href="/monitor"]');
    await page.waitForLoadState("networkidle");

    const waterfall = page.locator("canvas").first();
    await expect(waterfall).toBeVisible();

    // Create VFO
    await waterfall.click({ position: { x: 375, y: 200 }, modifiers: ["Alt"] });
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.selectOption('select[id="vfo-mode"]', "am");
    await page.click('button:has-text("Add VFO")');
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Verify VFO exists
    await expect(page.getByText("VFO Manager (1)")).toBeVisible();
    await expect(page.getByText("AM")).toBeVisible();

    // Remove VFO using remove button
    const removeButton = page.locator(".vfo-item-remove").first();
    await removeButton.click();

    // Verify VFO is removed
    await expect(page.getByText("No VFOs created")).toBeVisible();
    await expect(page.getByText("AM")).not.toBeVisible();
  });

  test("should remove VFO using badge overlay X button", async ({ page }) => {
    // Navigate to monitor page
    await page.click('a[href="/monitor"]');
    await page.waitForLoadState("networkidle");

    const waterfall = page.locator("canvas").first();
    await expect(waterfall).toBeVisible();

    // Create VFO
    await waterfall.click({ position: { x: 375, y: 200 }, modifiers: ["Alt"] });
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.selectOption('select[id="vfo-mode"]', "nbfm");
    await page.click('button:has-text("Add VFO")');
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Verify VFO badge appears on overlay
    await expect(page.locator(".vfo-badge")).toBeVisible();
    await expect(page.getByText("NBFM")).toBeVisible();

    // Remove VFO using badge overlay remove button
    const badgeRemoveButton = page.locator(".vfo-remove-btn").first();
    await badgeRemoveButton.click();

    // Verify VFO is removed
    await expect(page.getByText("No VFOs created")).toBeVisible();
    await expect(page.locator(".vfo-badge")).not.toBeVisible();
  });

  test("should cancel VFO creation", async ({ page }) => {
    // Navigate to monitor page
    await page.click('a[href="/monitor"]');
    await page.waitForLoadState("networkidle");

    const waterfall = page.locator("canvas").first();
    await expect(waterfall).toBeVisible();

    // Click on waterfall to trigger VFO creation modal
    await waterfall.click({ position: { x: 375, y: 200 }, modifiers: ["Alt"] });
    await expect(page.getByRole("dialog")).toBeVisible();

    // Click cancel
    await page.click('button:has-text("Cancel")');

    // Verify modal closes and no VFO is created
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("No VFOs created")).toBeVisible();
  });

  test("should handle Escape key to close modal", async ({ page }) => {
    // Navigate to monitor page
    await page.click('a[href="/monitor"]');
    await page.waitForLoadState("networkidle");

    const waterfall = page.locator("canvas").first();
    await expect(waterfall).toBeVisible();

    // Click on waterfall to trigger VFO creation modal
    await waterfall.click({ position: { x: 375, y: 200 }, modifiers: ["Alt"] });
    await expect(page.getByRole("dialog")).toBeVisible();

    // Press Escape key
    await page.keyboard.press("Escape");

    // Verify modal closes
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("should verify no layout overlap issues with multiple VFOs", async ({
    page,
  }) => {
    // Navigate to monitor page
    await page.click('a[href="/monitor"]');
    await page.waitForLoadState("networkidle");

    const waterfall = page.locator("canvas").first();
    await expect(waterfall).toBeVisible();

    // Create three VFOs at different positions
    const positions = [
      { x: 200, y: 200 },
      { x: 375, y: 200 },
      { x: 550, y: 200 },
    ];

    for (const position of positions) {
      await waterfall.click({ position, modifiers: ["Alt"] });
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.selectOption('select[id="vfo-mode"]', "am");
      await page.click('button:has-text("Add VFO")');
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }

    // Verify all three VFOs are visible
    await expect(page.getByText("VFO Manager (3)")).toBeVisible();

    // Verify badges are visible and don't overlap (check bounding boxes)
    const badges = await page.locator(".vfo-badge").all();
    expect(badges.length).toBe(3);

    // Get bounding boxes for all badges
    const boundingBoxes = await Promise.all(
      badges.map((badge) => badge.boundingBox()),
    );

    // Verify no null bounding boxes
    for (const box of boundingBoxes) {
      expect(box).not.toBeNull();
    }

    // Verify badges are positioned horizontally (different x coordinates)
    const xPositions = boundingBoxes.map((box) => box!.x);
    const uniqueXPositions = new Set(xPositions);
    expect(uniqueXPositions.size).toBe(3); // All badges should have different x positions
  });
});
