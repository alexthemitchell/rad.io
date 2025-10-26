import { test, expect } from "@playwright/test";

// Basic E2E smoke with mock SDR device for CI
// Usage: default in CI. Navigates with ?mockSdr=1 to force MockSDRDevice.

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

test.describe("Monitor (mock SDR @ CI)", () => {
  test("should start and stop reception using mock SDR", async ({ page }) => {
    await page.goto("https://localhost:8080/monitor?mockSdr=1");

    // Wait for Start button to appear and be enabled
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await expect(startBtn).toBeEnabled();

    // Click Start to satisfy any audio unlock gesture and begin streaming
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

    // Find first canvas (FFT chart)
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Snapshot #1 (current view is Waterfall by default)
    const img1 = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());

    // Toggle view to Spectrogram and snapshot #2
    const viewSelect = page.getByLabel("Visualization mode");
    await viewSelect.selectOption("spectrogram");
    await page.waitForTimeout(250);
    const img2 = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());

    // Toggle back to Waterfall and snapshot #3
    await viewSelect.selectOption("waterfall");
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
});
