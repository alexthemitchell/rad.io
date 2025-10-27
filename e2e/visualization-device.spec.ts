import { test, expect } from "@playwright/test";

/**
 * E2E tests for visualization with physical SDR device
 * Tagged with @device to run in the "device" project
 * 
 * Requirements:
 * - RADIO_E2E_DEVICE=1 environment variable
 * - Previously paired HackRF device (WebUSB permission saved)
 * - Physical device connected
 * 
 * Usage: RADIO_E2E_DEVICE=1 npm run test:e2e -- --grep @device
 */

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

const DEVICE_ENABLED = process.env["RADIO_E2E_DEVICE"] === "1";

test.describe("Visualization with Physical Device @device", () => {
  test.skip(!DEVICE_ENABLED, "Skipping device tests (RADIO_E2E_DEVICE not set)");

  test("should connect to physical device @device", async ({ page }) => {
    await page.goto("/monitor");

    // Wait for device auto-connect (from previously paired device)
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await expect(startBtn).toBeEnabled({ timeout: 5000 });

    // Verify device is detected (button should be ready to start)
    const status = page.getByRole("status");
    await expect(status).toBeVisible();
  });

  test("should start and stop reception with physical device @device", async ({
    page,
  }) => {
    await page.goto("/monitor");

    // Wait for device to be ready
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await expect(startBtn).toBeEnabled({ timeout: 5000 });

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

    // Wait for canvas to start rendering (first frame update)
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 5000 });
    const initialFrame = await canvas.evaluate((c: HTMLCanvasElement) =>
      c.toDataURL(),
    );
    // Wait for canvas to update (streaming is active)
    await page.waitForFunction(
      ([initialFrame]) => {
        const c = document.querySelector("canvas") as HTMLCanvasElement;
        return c && c.toDataURL() !== initialFrame;
      },
      [initialFrame],
      { timeout: 5000 },
    );

    // Stop streaming
    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === false, {
      timeout: 10000,
    });
  });

  test("should tune to different frequencies @device", async ({ page }) => {
    await page.goto("/monitor");

    // Start streaming
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Find frequency input (typically labeled "Center Frequency" or similar)
    const freqInput = page.locator('input[type="number"]').first();
    await expect(freqInput).toBeVisible({ timeout: 5000 });

    // Get initial frequency
    const initialFreq = await freqInput.inputValue();

    // Tune to FM radio band (100 MHz)
    await freqInput.fill("100000000");
    await freqInput.press("Enter");

    // Wait for frequency input to reflect new value
    await expect(freqInput).toHaveValue("100000000", { timeout: 5000 });

    // Verify frequency changed
    const newFreq = await freqInput.inputValue();
    expect(newFreq).not.toBe(initialFreq);
    expect(newFreq).toBe("100000000");

    // Verify rendering continues
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();

    // Capture two frames to verify continuous updates
    const frame1 = await canvas.evaluate((c: HTMLCanvasElement) =>
      c.toDataURL(),
    );
    // Wait for canvas to update (rendering continues)
    await page.waitForFunction(
      ([frame1]) => {
        const c = document.querySelector("canvas") as HTMLCanvasElement;
        return c && c.toDataURL() !== frame1;
      },
      [frame1],
      { timeout: 5000 },
    );

    // Stop streaming
    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });

  test("should adjust gain settings @device", async ({ page }) => {
    await page.goto("/monitor");

    // Start streaming
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Look for gain controls (could be sliders or inputs)
    // HackRF typically has LNA gain, VGA gain, and amp enable
    const gainControls = page.locator(
      'input[type="range"], select, input[aria-label*="gain" i], label:has-text("Gain")',
    );

    if ((await gainControls.count()) > 0) {
      const firstGainControl = gainControls.first();
      await expect(firstGainControl).toBeVisible();

      // Get initial value
      const initialValue = await firstGainControl.inputValue();

      // Adjust gain (depends on control type)
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

      // Wait for change to apply (wait until value changes)
      await expect(firstGainControl).not.toHaveValue(initialValue, {
        timeout: 5000,
      });

      // Verify gain changed
      const newValue = await firstGainControl.inputValue();
      expect(newValue).not.toBe(initialValue);

      // Verify rendering continues after gain change
      const canvas = page.locator("canvas").first();
      const frame1 = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );
      // Wait for canvas to update after gain change
      await page.waitForFunction(
        ([frame1]) => {
          const c = document.querySelector("canvas") as HTMLCanvasElement;
          return c && c.toDataURL() !== frame1;
        },
        [frame1],
        { timeout: 5000 },
      );
    }

    // Stop streaming
    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });

  test("should maintain stable rendering with physical device @device", async ({
    page,
  }) => {
    // Capture console errors during the test
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/monitor");

    // Start streaming
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Wait for initial rendering: wait until canvas contents change (first frame rendered)
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    const initialDataUrl = await canvas.evaluate((c: HTMLCanvasElement) =>
      c.toDataURL(),
    );
    // Wait until canvas contents change (first frame rendered)
    await page.waitForFunction(
      ([initialUrl]) => {
        const c = document.querySelector("canvas") as HTMLCanvasElement;
        return c && c.toDataURL() !== initialUrl;
      },
      [initialDataUrl],
      { timeout: 5000 },
    );

    // Collect multiple frame snapshots over time to verify continuous updates
    const snapshots: string[] = [];
    const sampleCount = 10;
    const intervalMs = 200;

    for (let i = 0; i < sampleCount; i++) {
      const snapshot = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );
      snapshots.push(snapshot);
      await page.waitForTimeout(intervalMs);
    }

    // Verify we got unique frames (rendering is active)
    const uniqueFrames = new Set(snapshots).size;
    expect(uniqueFrames).toBeGreaterThan(3); // At least 4 unique frames in 2 seconds

    // Verify no console errors occurred during streaming
    expect(consoleErrors.length).toBe(0);

    // Stop streaming
    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });

  test("should switch visualization modes with physical device @device", async ({
    page,
  }) => {
    await page.goto("/monitor");

    // Start streaming
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    const canvas = page.locator("canvas").first();
    const viewSelect = page.getByLabel("Visualization mode");
    await expect(viewSelect).toBeVisible();

    // Test switching between visualization modes
    const modes = ["waterfall", "spectrogram", "fft"];

    for (const mode of modes) {
      await viewSelect.selectOption(mode);

      // Wait for the canvas to update after mode change
      const prevFrame = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );
      await page.waitForFunction(
        ([prevFrame]) => {
          const c = document.querySelector("canvas") as HTMLCanvasElement;
          return c && c.toDataURL() !== prevFrame;
        },
        [prevFrame],
        { timeout: 5000 },
      );

      // Verify rendering continues in this mode
      const frame1 = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );
      await page.waitForFunction(
        ([frame1]) => {
          const c = document.querySelector("canvas") as HTMLCanvasElement;
          return c && c.toDataURL() !== frame1;
        },
        [frame1],
        { timeout: 5000 },
      );
    }

    // Stop streaming
    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });

  test("should display IQ constellation with physical device @device", async ({
    page,
  }) => {
    await page.goto("/monitor");

    // Start streaming
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Look for IQ Constellation canvas
    const iqCanvas = page.locator('canvas[aria-label*="IQ Constellation"]');

    if ((await iqCanvas.count()) > 0) {
      await expect(iqCanvas.first()).toBeVisible();

      // Verify it's rendering with real data
      const img1 = await iqCanvas
        .first()
        .evaluate((c: HTMLCanvasElement) => c.toDataURL());
      // Wait for IQ canvas to update
      await page.waitForFunction(
        ([img1]) => {
          const c = document.querySelector(
            'canvas[aria-label*="IQ Constellation"]',
          ) as HTMLCanvasElement;
          return c && c.toDataURL() !== img1;
        },
        [img1],
        { timeout: 5000 },
      );
    }

    // Stop streaming
    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });

  test("should handle device reconnection gracefully @device", async ({
    page,
  }) => {
    await page.goto("/monitor");

    // Initial connection
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await expect(startBtn).toBeEnabled({ timeout: 5000 });

    // Start and stop streaming
    await startBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Wait for canvas to start rendering
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    const initialFrame = await canvas.evaluate((c: HTMLCanvasElement) =>
      c.toDataURL(),
    );
    await page.waitForFunction(
      ([initialFrame]) => {
        const c = document.querySelector("canvas") as HTMLCanvasElement;
        return c && c.toDataURL() !== initialFrame;
      },
      [initialFrame],
      { timeout: 5000 },
    );

    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);

    // Start again to verify device can be reused
    await expect(startBtn).toBeEnabled({ timeout: 2000 });
    await startBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Verify rendering is working
    const frame1 = await canvas.evaluate((c: HTMLCanvasElement) =>
      c.toDataURL(),
    );
    // Wait for canvas to update (verify rendering continues)
    await page.waitForFunction(
      ([frame1]) => {
        const c = document.querySelector("canvas") as HTMLCanvasElement;
        return c && c.toDataURL() !== frame1;
      },
      [frame1],
      { timeout: 5000 },
    );

    // Final stop
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });
});
