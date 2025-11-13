import { test, expect } from "@playwright/test";

// Basic E2E smoke with mock SDR device for CI
// Usage: default in CI. Navigates with ?mockSdr=1 to force MockSDRDevice.

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

test.describe("Monitor (mock SDR @ CI)", () => {
  async function findStartButton(page) {
    const selectors = [
      'button[aria-label*="Start receiving" i]',
      'button:has-text("Start Reception")',
      'button:has-text("Start receiving")',
      'button[aria-label*="Start reception" i]',
      'button[title*="Start reception" i]',
    ];
    for (const s of selectors) {
      const loc = page.locator(s).first();
      try {
        if ((await loc.count()) > 0) {
          return loc;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }
  test("should start and stop reception using mock SDR", async ({ page }) => {
    await page.goto("https://localhost:8080/monitor?mockSdr=1");

    // Wait for Start button to appear and be enabled; be tolerant of varying UI locations
    let startBtn = await findStartButton(page);
    if (!startBtn) {
      const connectBtn = page.getByRole("button", { name: /connect/i }).first();
      if ((await connectBtn.count()) > 0) {
        await connectBtn.click();
        await page.waitForTimeout(500);
        startBtn = await findStartButton(page);
      }
    }
    if (!startBtn) {
      throw new Error("Start Reception button not found for mock SDR test");
    }
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await expect(startBtn).toBeEnabled();

    // Click Start to begin streaming
    await startBtn.click();

    // Status text should update
    const status = page.getByRole("status");
    await expect(status).toContainText(/Receiving started|Tuned to/i, {
      timeout: 10000,
    });

    // Verify diagnostic flag on window gets set
    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 10000,
    });

    // Allow a couple of frames to accumulate for the visualizer
    await page.waitForTimeout(400);

    // Stop reception
    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });

  test("visualization image should change when view toggles", async ({
    page,
  }) => {
    await page.goto("https://localhost:8080/monitor?mockSdr=1");

    // Start streaming (ensures canvas is being updated)
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 10000,
    });

    // Find first canvas (spectrum)
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Snapshot #1 (current view may or may not include Waterfall by default)
    const img1 = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());

    // Toggle Waterfall on and snapshot #2
    const waterfallToggle = page.getByRole("checkbox", {
      name: /Toggle waterfall visualization/i,
    });
    await waterfallToggle.check();
    await page.waitForTimeout(250);
    const img2 = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());

    // Toggle Waterfall off and snapshot #3
    await waterfallToggle.uncheck();
    await page.waitForTimeout(250);
    const img3 = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());

    // At least one of the toggles should change the image output
    expect(img1).not.toEqual(img2);
    expect(img2).not.toEqual(img3);

    // Stop streaming
    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });

  test("status bar shows rendering tier (GPU or fallback)", async ({
    page,
  }) => {
    await page.goto("https://localhost:8080/monitor?mockSdr=1");

    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 10000,
    });

    const statusRegion = page.getByRole("status");
    // Accept any concrete tier except Unknown so tests pass in environments
    // without GPU acceleration (e.g., Canvas2D or Worker fallbacks)
    const tierText = statusRegion.getByText(
      /WebGPU|WebGL2|WebGL|Worker|Canvas2D/i,
    );
    await expect(tierText).toBeVisible({ timeout: 5000 });

    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });
});
