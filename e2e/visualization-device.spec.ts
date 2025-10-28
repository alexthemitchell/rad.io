import { test, expect, Page, Locator } from "@playwright/test";

/**
 * Helper function to wait for the start button to be ready
 */
async function waitForStartButton(page: Page) {
  const startBtn = page.getByRole("button", { name: "Start reception" });
  await expect(startBtn).toBeVisible({ timeout: 15000 });
  await expect(startBtn).toBeEnabled({ timeout: 5000 });
  return startBtn;
}

/**
 * Helper function to wait for canvas to update (render a new frame)
 */
async function waitForCanvasUpdate(
  page: Page,
  canvas: Locator,
  timeout = 5000,
) {
  const currentFrame = await canvas.evaluate((c: HTMLCanvasElement) =>
    c.toDataURL(),
  );
  await page.waitForFunction(
    ([currentFrame]) => {
      const c = document.querySelector("canvas") as HTMLCanvasElement;
      return c && c.toDataURL() !== currentFrame;
    },
    [currentFrame],
    { timeout },
  );
}

/**
 * Helper function to stop streaming and wait for it to stop
 */
async function stopStreaming(page: Page) {
  const stopBtn = page.getByRole("button", { name: "Stop reception" });
  await stopBtn.click();
  await page.waitForFunction(() => (window as any).dbgReceiving === false, {
    timeout: 10000,
  });
}

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
  test.skip(
    !DEVICE_ENABLED,
    "Skipping device tests (RADIO_E2E_DEVICE not set)",
  );

  test("should connect to physical device @device", async ({ page }) => {
    await page.goto("/monitor");

    // Wait for device auto-connect (from previously paired device)
    await waitForStartButton(page);

    // Verify device is detected (button should be ready to start)
    const status = page.getByRole("status");
    await expect(status).toBeVisible();
  });

  test("should start and stop reception with physical device @device", async ({
    page,
  }) => {
    await page.goto("/monitor");

    // Wait for device to be ready
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

    // Wait for canvas to start rendering (first frame update)
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 5000 });
    await waitForCanvasUpdate(page, canvas);

    // Stop streaming
    await stopStreaming(page);
  });

  test("should tune to different frequencies @device", async ({ page }) => {
    await page.goto("/monitor");

    // Start streaming
    const startBtn = await waitForStartButton(page);
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
    await waitForCanvasUpdate(page, canvas);

    // Stop streaming
    await stopStreaming(page);
  });

  test("should adjust gain settings @device", async ({ page }) => {
    await page.goto("/monitor");

    // Start streaming
    const startBtn = await waitForStartButton(page);
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
      await waitForCanvasUpdate(page, canvas);
    }

    // Stop streaming
    await stopStreaming(page);
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
    const startBtn = await waitForStartButton(page);
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Wait for initial rendering: wait until canvas contents change (first frame rendered)
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

    // Verify we got unique frames (rendering is active)
    const uniqueFrames = new Set(snapshots).size;
    expect(uniqueFrames).toBeGreaterThan(3); // At least 4 unique frames

    // Verify no console errors occurred during streaming
    expect(consoleErrors.length).toBe(0);

    // Stop streaming
    await stopStreaming(page);
  });

  test("should toggle waterfall while streaming with physical device @device", async ({
    page,
  }) => {
    await page.goto("/monitor");

    // Start streaming
    const startBtn = await waitForStartButton(page);
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    const canvas = page.locator("canvas").first();
    const waterfallToggle = page.getByRole("checkbox", {
      name: /Toggle waterfall visualization/i,
    });

    // Toggle waterfall on/off a few times and ensure rendering continues
    for (let i = 0; i < 3; i++) {
      await waterfallToggle.check();
      await waitForCanvasUpdate(page, canvas);
      await waterfallToggle.uncheck();
      await waitForCanvasUpdate(page, canvas);
    }

    // Stop streaming
    await stopStreaming(page);
  });

  test("should display IQ constellation with physical device @device", async ({
    page,
  }) => {
    await page.goto("/monitor");

    // Start streaming
    const startBtn = await waitForStartButton(page);
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Look for IQ Constellation canvas
    const iqCanvas = page.locator('canvas[aria-label*="IQ Constellation"]');

    if ((await iqCanvas.count()) > 0) {
      await expect(iqCanvas.first()).toBeVisible();

      // Verify it's rendering with real data - wait for canvas to update
      await waitForCanvasUpdate(page, iqCanvas.first());
    }

    // Stop streaming
    await stopStreaming(page);
  });

  test("should handle device reconnection gracefully @device", async ({
    page,
  }) => {
    await page.goto("/monitor");

    // Initial connection
    const startBtn = await waitForStartButton(page);

    // Start and stop streaming
    await startBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Wait for canvas to start rendering
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
});
