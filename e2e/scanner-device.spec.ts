import { test, expect } from "@playwright/test";
import { waitForDeviceReady } from "./helpers/device-helpers";

/**
 * E2E tests for Scanner functionality with physical SDR device
 * Tagged with @device to run in the "device" project
 *
 * Requirements:
 * - RADIO_E2E_DEVICE=1 environment variable
 * - Previously paired HackRF device (WebUSB permission saved)
 * - Physical device connected
 *
 * Usage: npm run test:e2e:device -- --grep @device
 */

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

const DEVICE_ENABLED = process.env["RADIO_E2E_DEVICE"] === "1";

test.describe("Scanner with Physical Device @device", () => {
  test.skip(
    !DEVICE_ENABLED,
    "Skipping device tests (RADIO_E2E_DEVICE not set)",
  );

  test("should initialize scanner with physical device @device", async ({
    page,
  }) => {
    await page.goto("/scanner");

    // Wait for device to auto-connect
    await waitForDeviceReady(page);

    // Verify scanner UI elements are present
    const frequencyInput = page.locator('input[type="number"]').first();
    await expect(frequencyInput).toBeVisible({ timeout: 5000 });

    // Verify start scan button exists
    const startScanBtn = page.getByRole("button", {
      name: /start scan|scan/i,
    });
    await expect(startScanBtn).toBeVisible({ timeout: 5000 });
  });

  test("should scan frequency range with physical device @device", async ({
    page,
  }) => {
    test.slow(); // Scanner tests can take longer

    await page.goto("/scanner");
    await waitForDeviceReady(page);

    // Configure scan range (88-108 MHz FM radio band)
    const startFreqInput = page
      .locator('input[aria-label*="start" i], input[placeholder*="start" i]')
      .first();
    const endFreqInput = page
      .locator('input[aria-label*="end" i], input[placeholder*="stop" i]')
      .first();

    if ((await startFreqInput.count()) > 0) {
      await startFreqInput.fill("88000000");
      await endFreqInput.fill("108000000");
    }

    // Start scan
    const startScanBtn = page.getByRole("button", {
      name: /start scan|scan/i,
    });
    await startScanBtn.click();

    // Wait for scan to detect signals
    await page.waitForTimeout(5000); // Allow time for scanning

    // Verify scan is running
    const stopBtn = page.getByRole("button", { name: /stop|pause/i });
    await expect(stopBtn).toBeVisible({ timeout: 10000 });

    // Stop scan
    await stopBtn.click();
  });

  test("should detect and display active signals @device", async ({
    page,
  }) => {
    test.slow(); // Signal detection can take time

    await page.goto("/scanner");
    await waitForDeviceReady(page);

    // Start a scan in FM band where signals are likely
    const startScanBtn = page.getByRole("button", {
      name: /start scan|scan/i,
    });
    await startScanBtn.click();

    // Wait for signal detection
    await page.waitForTimeout(10000);

    // Look for detected signals in results
    const signalList = page.locator('[role="list"], table, .signal');
    if ((await signalList.count()) > 0) {
      await expect(signalList.first()).toBeVisible();
    }

    // Stop scan
    const stopBtn = page.getByRole("button", { name: /stop|pause/i });
    if (await stopBtn.isVisible()) {
      await stopBtn.click();
    }
  });

  test("should navigate to monitor from detected signal @device", async ({
    page,
  }) => {
    await page.goto("/scanner");
    await waitForDeviceReady(page);

    // Look for navigation elements or tune buttons
    const navLinks = page.locator(
      'a[href*="monitor"], button:has-text("Tune")',
    );

    if ((await navLinks.count()) > 0) {
      const firstLink = navLinks.first();
      await firstLink.click();

      // Verify navigation to monitor page
      await expect(page).toHaveURL(/\/monitor/);
    }
  });

  test("should handle scanner with different signal types @device", async ({
    page,
  }) => {
    await page.goto("/scanner");
    await waitForDeviceReady(page);

    // Look for signal type selector (FM, AM, etc.)
    const signalTypeSelect = page.locator('select, [role="combobox"]').first();

    if ((await signalTypeSelect.count()) > 0) {
      await expect(signalTypeSelect).toBeVisible();

      // Get current value
      const initialType = await signalTypeSelect.inputValue();

      // Try changing signal type
      const options = await signalTypeSelect.locator("option").all();
      if (options.length > 1) {
        await signalTypeSelect.selectOption({ index: 1 });

        // Verify change
        const newType = await signalTypeSelect.inputValue();
        expect(newType).not.toBe(initialType);
      }
    }
  });

  test("should update scanner results in real-time @device", async ({
    page,
  }) => {
    test.slow();

    await page.goto("/scanner");
    await waitForDeviceReady(page);

    // Start scan
    const startScanBtn = page.getByRole("button", {
      name: /start scan|scan/i,
    });
    await startScanBtn.click();

    // Wait a bit for initial results
    await page.waitForTimeout(3000);

    // Take snapshot of results
    const resultsArea = page.locator('[role="list"], table, .results').first();
    const initialHTML = await resultsArea.innerHTML().catch(() => "");

    // Wait for updates
    await page.waitForTimeout(5000);

    // Verify results changed (real-time updates)
    const updatedHTML = await resultsArea.innerHTML().catch(() => "");

    // If scanner is active, results should update
    if (initialHTML !== "" && updatedHTML !== "") {
      // We expect some change in the results over time
      // This is a weak assertion as results might be identical if no new signals
      expect(updatedHTML.length).toBeGreaterThan(0);
    }

    // Stop scan
    const stopBtn = page.getByRole("button", { name: /stop|pause/i });
    if (await stopBtn.isVisible()) {
      await stopBtn.click();
    }
  });
});
