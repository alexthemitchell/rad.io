import { test, expect } from "@playwright/test";

/**
 * E2E tests for interactive marker and peak hold analysis features
 * Tagged with @simulated to run in simulated mode
 * Usage: npm run test:e2e:sim -- --grep @marker
 */

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

test.describe("Marker Analysis Features @simulated @marker", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to monitor page with simulated device
    await page.goto("/?simulatedDevice=1");
    await page.waitForLoadState("networkidle");

    // Wait for Spectrum Explorer to appear
    await expect(
      page.getByRole("heading", { name: "Spectrum Explorer" }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should allow placing markers on spectrum", async ({ page }) => {
    // Find the spectrum canvas
    const spectrumCanvas = page
      .locator('canvas[aria-label*="Spectrum plot"]')
      .first();
    await expect(spectrumCanvas).toBeVisible();

    // Click on the spectrum to place a marker
    const boundingBox = await spectrumCanvas.boundingBox();
    if (!boundingBox) {
      throw new Error("Could not get canvas bounding box");
    }

    // Click at a position on the spectrum (middle of the canvas)
    await spectrumCanvas.click({
      position: { x: boundingBox.width / 2, y: boundingBox.height / 2 },
    });

    // Wait for marker table to appear
    await expect(page.getByText(/Markers/i)).toBeVisible({ timeout: 5000 });

    // Verify marker table has at least one row
    const markerRows = page.locator("table tbody tr");
    await expect(markerRows).toHaveCount(1, { timeout: 3000 });

    // Verify power level is displayed in the Power (dB) column
    const firstMarkerRow = page.locator("table tbody tr").first();
    const powerCell = firstMarkerRow.locator("td").nth(2); // Third column (0-based index)
    await expect(powerCell).toHaveText(/^-?\d+\.\d+$/);
  });

  test("should display deltas between multiple markers", async ({ page }) => {
    const spectrumCanvas = page
      .locator('canvas[aria-label*="Spectrum plot"]')
      .first();
    await expect(spectrumCanvas).toBeVisible();

    const boundingBox = await spectrumCanvas.boundingBox();
    if (!boundingBox) {
      throw new Error("Could not get canvas bounding box");
    }

    // Place first marker
    await spectrumCanvas.click({
      position: { x: boundingBox.width * 0.3, y: boundingBox.height / 2 },
    });

    // Wait for first marker to appear
    const markerRows = page.locator("table tbody tr");
    await expect(markerRows).toHaveCount(1, { timeout: 3000 });

    // Place second marker
    await spectrumCanvas.click({
      position: { x: boundingBox.width * 0.7, y: boundingBox.height / 2 },
    });

    // Wait for second marker to appear
    await expect(markerRows).toHaveCount(2, { timeout: 3000 });

    // Verify delta columns are present
    await expect(page.getByText("Δ Freq (Hz)")).toBeVisible();
    await expect(page.getByText("Δ Power (dB)")).toBeVisible();

    // Second row should have delta values (not em-dash)
    const secondRow = markerRows.nth(1);
    const cells = secondRow.locator("td");
    const deltaFreqCell = cells.nth(3); // Δ Freq column
    const deltaFreqText = await deltaFreqCell.textContent();

    // Delta frequency should not be "—" (em-dash)
    expect(deltaFreqText).not.toBe("—");
  });

  test("should export markers to CSV", async ({ page }) => {
    const spectrumCanvas = page
      .locator('canvas[aria-label*="Spectrum plot"]')
      .first();
    await expect(spectrumCanvas).toBeVisible();

    const boundingBox = await spectrumCanvas.boundingBox();
    if (!boundingBox) {
      throw new Error("Could not get canvas bounding box");
    }

    // Place a marker
    await spectrumCanvas.click({
      position: { x: boundingBox.width / 2, y: boundingBox.height / 2 },
    });

    // Wait for marker table
    await expect(page.getByText(/Markers/i)).toBeVisible({ timeout: 5000 });

    // Setup download listener
    const downloadPromise = page.waitForEvent("download");

    // Click export button
    const exportBtn = page.getByRole("button", { name: /Export.*CSV/i });
    await exportBtn.click();

    // Wait for download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("markers.csv");

    // Verify CSV content includes headers
    const path = await download.path();
    if (path) {
      const fs = await import("fs");
      const content = fs.readFileSync(path, "utf-8");
      expect(content).toContain("id,freqHz,freqMHz,powerDb");
      expect(content).toContain("deltaFreqHz,deltaPowerDb");
    }
  });

  test("should clear all markers", async ({ page }) => {
    const spectrumCanvas = page
      .locator('canvas[aria-label*="Spectrum plot"]')
      .first();
    await expect(spectrumCanvas).toBeVisible();

    const boundingBox = await spectrumCanvas.boundingBox();
    if (!boundingBox) {
      throw new Error("Could not get canvas bounding box");
    }

    // Place a marker
    await spectrumCanvas.click({
      position: { x: boundingBox.width / 2, y: boundingBox.height / 2 },
    });

    // Wait for marker table and verify it's visible
    await expect(page.getByText(/Markers/i)).toBeVisible({ timeout: 5000 });

    // Find and click "Clear Markers" button
    const clearBtn = page.getByRole("button", { name: /Clear Markers/i });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Verify marker table is gone
    await expect(page.getByText(/Markers/i)).not.toBeVisible({
      timeout: 3000,
    });
  });

  test("should toggle and clear peak hold", async ({ page }) => {
    // Find peak hold checkbox by accessible name
    const peakHoldCheckbox = page.getByRole("checkbox", { name: /Peak Hold/i });

    // Enable peak hold
    await peakHoldCheckbox.check();

    // Verify "Clear Peak Hold" button appears
    const clearPeakBtn = page.getByRole("button", {
      name: /Clear Peak Hold/i,
    });
    await expect(clearPeakBtn).toBeVisible();

    // Click to clear peak hold data
    await clearPeakBtn.click();

    // Disable peak hold
    await peakHoldCheckbox.uncheck();

    // Verify "Clear Peak Hold" button is gone
    await expect(clearPeakBtn).not.toBeVisible();
  });

  test("should handle double-click to tune", async ({ page }) => {
    const spectrumCanvas = page
      .locator('canvas[aria-label*="Spectrum plot"]')
      .first();
    await expect(spectrumCanvas).toBeVisible();

    const boundingBox = await spectrumCanvas.boundingBox();
    if (!boundingBox) {
      throw new Error("Could not get canvas bounding box");
    }

    // Double-click on spectrum to tune
    // Note: This test verifies the action doesn't throw an error
    // The actual tuning behavior would require checking frequency change
    await spectrumCanvas.dblclick({
      position: { x: boundingBox.width / 2, y: boundingBox.height / 2 },
    });

    // Wait a bit to ensure no errors
    await page.waitForTimeout(500);

    // Test passes if no errors occurred during double-click action
    // No assertion needed - if an error is thrown, the test will fail automatically
  });

  test("should remove individual markers", async ({ page }) => {
    const spectrumCanvas = page
      .locator('canvas[aria-label*="Spectrum plot"]')
      .first();
    await expect(spectrumCanvas).toBeVisible();

    const boundingBox = await spectrumCanvas.boundingBox();
    if (!boundingBox) {
      throw new Error("Could not get canvas bounding box");
    }

    // Place two markers
    await spectrumCanvas.click({
      position: { x: boundingBox.width * 0.3, y: boundingBox.height / 2 },
    });

    // Wait for first marker to appear
    const markerRows = page.locator("table tbody tr");
    await expect(markerRows).toHaveCount(1, { timeout: 3000 });

    await spectrumCanvas.click({
      position: { x: boundingBox.width * 0.7, y: boundingBox.height / 2 },
    });

    // Wait for second marker to appear
    await expect(markerRows).toHaveCount(2, { timeout: 3000 });

    // Click the remove button for the first marker
    const removeBtn = page.getByRole("button", { name: /Remove marker 1/i });
    await removeBtn.click();

    // Verify we now have 1 marker
    await expect(markerRows).toHaveCount(1, { timeout: 3000 });
  });
});
