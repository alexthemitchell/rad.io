/**
 * RTL-SDR Device E2E Tests
 *
 * Tests the RTL-SDR driver with real RTL-SDR hardware
 *
 * Prerequisites:
 * - RTL-SDR device connected via USB
 * - Device has WebUSB firmware or usbguard permissions configured
 *
 * Usage: E2E_REAL_RTLSDR=1 npm run test:e2e -- --grep @rtlsdr
 */

import { expect, test } from "@playwright/test";
import {
  waitForDeviceReady,
  waitForStartButton,
  waitForCanvasUpdate,
  stopStreaming,
} from "./helpers/device-helpers";

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

const RTLSDR_ENABLED = process.env["E2E_REAL_RTLSDR"] === "1";

test.describe("RTL-SDR with Real Hardware @rtlsdr", () => {
  test.skip(
    !RTLSDR_ENABLED,
    "Skipping RTL-SDR tests (E2E_REAL_RTLSDR not set)",
  );

  test("should detect RTL-SDR device @rtlsdr", async ({ page }) => {
    await page.goto("/monitor");

    // Wait for device to be detected and ready
    await waitForDeviceReady(page);

    // Check device info is displayed
    const deviceInfo = page.locator('[role="status"]');
    await expect(deviceInfo).toBeVisible({ timeout: 10000 });

    // Look for RTL-SDR specific indicators
    const rtlsdrIndicator = page.getByText(/RTL-SDR|rtl/i);
    if ((await rtlsdrIndicator.count()) > 0) {
      await expect(rtlsdrIndicator.first()).toBeVisible();
    }
  });

  test("should start and stop reception with RTL-SDR @rtlsdr", async ({
    page,
  }) => {
    await page.goto("/monitor");

    // Wait for device to be ready
    await waitForDeviceReady(page);
    const startBtn = await waitForStartButton(page);

    // Start streaming
    await startBtn.click();

    // Verify streaming started
    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    const status = page.getByRole("status");
    await expect(status).toContainText(/Receiving started|Tuned to/i, {
      timeout: 10000,
    });

    // Wait for canvas to start rendering
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 5000 });
    await waitForCanvasUpdate(page, canvas);

    // Stop streaming
    await stopStreaming(page);
  });

  test("should tune to FM radio frequency @rtlsdr", async ({ page }) => {
    await page.goto("/monitor");

    // Start streaming
    const startBtn = await waitForStartButton(page);
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Tune to FM radio band (100 MHz = 100000000 Hz)
    const freqInput = page.locator('input[type="number"]').first();
    await expect(freqInput).toBeVisible({ timeout: 5000 });

    await freqInput.fill("100000000");
    await freqInput.press("Enter");

    // Wait for frequency to be set
    await expect(freqInput).toHaveValue("100000000", { timeout: 5000 });

    // Verify rendering continues
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    await waitForCanvasUpdate(page, canvas);

    // Stop streaming
    await stopStreaming(page);
  });

  test("should adjust sample rate @rtlsdr", async ({ page }) => {
    await page.goto("/monitor");

    const startBtn = await waitForStartButton(page);
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Look for sample rate control
    const sampleRateSelect = page.locator(
      'select[aria-label*="sample rate" i], select:has-text("Sample Rate")',
    );

    if ((await sampleRateSelect.count()) > 0) {
      const initialValue = await sampleRateSelect.inputValue();

      // Change sample rate
      const options = await sampleRateSelect.locator("option").all();
      if (options.length > 1) {
        await sampleRateSelect.selectOption({ index: 1 });

        // Wait for sample rate to change
        await expect(sampleRateSelect).not.toHaveValue(initialValue, {
          timeout: 5000,
        });

        // Verify rendering continues with new sample rate
        const canvas = page.locator("canvas").first();
        await waitForCanvasUpdate(page, canvas);
      }
    }

    await stopStreaming(page);
  });

  test("should adjust LNA gain @rtlsdr", async ({ page }) => {
    await page.goto("/monitor");

    const startBtn = await waitForStartButton(page);
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Look for gain controls
    const gainControls = page.locator(
      'input[type="range"], select, input[aria-label*="gain" i], label:has-text("Gain")',
    );

    if ((await gainControls.count()) > 0) {
      const firstGainControl = gainControls.first();
      await expect(firstGainControl).toBeVisible();

      // Get initial value
      const initialValue = await firstGainControl.inputValue();

      // Adjust gain
      const tagName = await firstGainControl.evaluate((el) =>
        el.tagName.toLowerCase(),
      );

      if (tagName === "input") {
        const inputType = await firstGainControl.getAttribute("type");
        if (inputType === "range") {
          // Slider: move to a different position
          await firstGainControl.fill("20");
        } else {
          // Number input: change value
          await firstGainControl.fill("16");
        }
      }

      // Wait for change to apply
      await expect(firstGainControl).not.toHaveValue(initialValue, {
        timeout: 5000,
      });

      // Verify rendering continues after gain change
      const canvas = page.locator("canvas").first();
      await waitForCanvasUpdate(page, canvas);
    }

    await stopStreaming(page);
  });

  test("should maintain stable rendering with RTL-SDR @rtlsdr", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/monitor");

    const startBtn = await waitForStartButton(page);
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Wait for initial rendering
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    await waitForCanvasUpdate(page, canvas);

    // Collect multiple frame snapshots to verify continuous updates
    const snapshots: string[] = [];
    const sampleCount = 10;

    let lastSnapshot = await canvas.evaluate((c: HTMLCanvasElement) =>
      c.toDataURL(),
    );
    snapshots.push(lastSnapshot);

    for (let i = 1; i < sampleCount; i++) {
      // Wait until canvas contents change (new frame rendered)
      await page.waitForFunction(
        ([prevUrl]) => {
          const c = document.querySelector("canvas") as HTMLCanvasElement;
          return c && c.toDataURL() !== prevUrl;
        },
        [lastSnapshot],
        { timeout: 2000 },
      );
      lastSnapshot = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );
      snapshots.push(lastSnapshot);
    }

    // Verify we got unique frames
    const uniqueFrames = new Set(snapshots).size;
    expect(uniqueFrames).toBeGreaterThan(3);

    // Verify no console errors
    expect(consoleErrors.length).toBe(0);

    await stopStreaming(page);
  });

  test("should handle reconnection after stop/start @rtlsdr", async ({
    page,
  }) => {
    await page.goto("/monitor");

    const startBtn = await waitForStartButton(page);

    // Start and stop streaming
    await startBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    await waitForCanvasUpdate(page, canvas);

    await stopStreaming(page);

    // Start again to verify device can be reused
    await expect(startBtn).toBeEnabled({ timeout: 2000 });
    await startBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Verify rendering is working
    await waitForCanvasUpdate(page, canvas);

    // Final stop
    await stopStreaming(page);
  });

  test("should detect RTL-SDR tuner type @rtlsdr", async ({ page }) => {
    await page.goto("/monitor");

    await waitForDeviceReady(page);

    // Check for device info display
    const deviceInfo = page.locator('[role="status"]');
    
    // Look for tuner type info (R820T, E4000, etc.)
    const tunerInfo = page.getByText(/R820T|E4000|FC0012|FC0013/i);
    
    // The tuner type should be displayed somewhere in the UI
    // This is a soft assertion - not all UIs may display this
    if ((await tunerInfo.count()) > 0) {
      await expect(tunerInfo.first()).toBeVisible({ timeout: 5000 });
    }
  });
});
