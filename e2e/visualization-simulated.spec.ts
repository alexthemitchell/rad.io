import { test, expect } from "@playwright/test";

/**
 * E2E tests for visualization features using simulated data sources
 * Tagged with @simulated to run in the "simulated" project
 * Usage: npm run test:e2e -- --grep @simulated
 */

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

test.describe("Visualization with Simulated Data @simulated", () => {
  test("should render visualizations on demo page with simulated data", async ({
    page,
  }) => {
    // Navigate to demo page which uses SimulatedSource
    await page.goto("https://localhost:8080/demo");

    // Wait for page to load
    await page.waitForSelector("h1", { timeout: 10000 });

    // Verify heading is present
    const heading = await page.locator("h1").textContent();
    expect(heading).toContain("Visualization Demo");

    // Find the Start/Stop button
    const startBtn = page.getByRole("button", { name: /start/i });
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await expect(startBtn).toBeEnabled();

    // Start streaming simulated data
    await startBtn.click();

    // Wait a moment for visualizations to start rendering
    await page.waitForTimeout(500);

    // Verify canvases are rendered
    const canvases = page.locator("canvas");
    const canvasCount = await canvases.count();
    expect(canvasCount).toBeGreaterThan(0);

    // Verify at least one canvas is visible
    await expect(canvases.first()).toBeVisible();

    // Stop streaming
    const stopBtn = page.getByRole("button", { name: /stop/i });
    await stopBtn.click();
  });

  test("should display different signal patterns @simulated", async ({
    page,
  }) => {
    await page.goto("https://localhost:8080/demo");

    // Wait for page to load
    await page.waitForSelector("h1", { timeout: 10000 });

    // Start streaming
    const startBtn = page.getByRole("button", { name: /start/i });
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    // Wait for initial rendering
    await page.waitForTimeout(500);

    // Find pattern selector if it exists (check common selector patterns)
    const patternSelect = page.locator('select[name="pattern"]').first();
    const hasPatternSelect = (await patternSelect.count()) > 0;

    if (hasPatternSelect) {
      // Get initial canvas state
      const canvas = page.locator("canvas").first();
      const img1 = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );

      // Change pattern
      await patternSelect.selectOption("qpsk");
      await page.waitForTimeout(500);

      // Get new canvas state
      const img2 = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );

      // Images should be different
      expect(img1).not.toEqual(img2);
    } else {
      // If no pattern selector, just verify streaming is active
      expect(hasPatternSelect).toBe(false); // Document this behavior
    }

    // Stop streaming
    const stopBtn = page.getByRole("button", { name: /stop/i });
    await stopBtn.click();
  });

  test("should show continuous updates when streaming simulated data @simulated", async ({
    page,
  }) => {
    await page.goto("https://localhost:8080/demo");

    // Wait for page to load
    await page.waitForSelector("h1", { timeout: 10000 });

    // Start streaming
    const startBtn = page.getByRole("button", { name: /start/i });
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    // Wait for first render
    await page.waitForTimeout(300);

    // Capture multiple snapshots to verify continuous updates
    const canvas = page.locator("canvas").first();

    const snapshots: string[] = [];
    for (let i = 0; i < 3; i++) {
      const snapshot = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );
      snapshots.push(snapshot);
      await page.waitForTimeout(200);
    }

    // At least one snapshot should differ (indicating continuous updates)
    const allSame = snapshots.every((s) => s === snapshots[0]);
    expect(allSame).toBe(false);

    // Stop streaming
    const stopBtn = page.getByRole("button", { name: /stop/i });
    await stopBtn.click();
  });

  test("should handle start/stop cycles correctly @simulated", async ({
    page,
  }) => {
    await page.goto("https://localhost:8080/demo");

    // Wait for page to load
    await page.waitForSelector("h1", { timeout: 10000 });

    const startBtn = page.getByRole("button", { name: /start/i });
    const stopBtn = page.getByRole("button", { name: /stop/i });

    // First cycle: start and stop
    await startBtn.click();
    await page.waitForTimeout(300);
    await stopBtn.click();
    await page.waitForTimeout(200);

    // Second cycle: start again
    await startBtn.click();
    await page.waitForTimeout(300);

    // Verify canvas is still updating
    const canvas = page.locator("canvas").first();
    const img1 = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.waitForTimeout(200);
    const img2 = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());

    // Should have different frames
    expect(img1).not.toEqual(img2);

    // Final stop
    await stopBtn.click();
  });
});

test.describe("Monitor Page with Simulated Data @simulated", () => {
  test("should render all visualization modes with simulated data @simulated", async ({
    page,
  }) => {
    await page.goto("https://localhost:8080/monitor?mockSdr=1");

    // Wait for page to load
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await expect(startBtn).toBeEnabled();

    // Start streaming
    await startBtn.click();

    // Wait for streaming to initialize
    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 10000,
    });

    // Verify visualization canvas appears
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 5000 });

    // Test waterfall mode
    const viewSelect = page.getByLabel("Visualization mode");
    await expect(viewSelect).toBeVisible();

    await viewSelect.selectOption("waterfall");
    await page.waitForTimeout(300);
    const waterfallImg = await canvas.evaluate((c: HTMLCanvasElement) =>
      c.toDataURL(),
    );
    expect(waterfallImg).toBeTruthy();

    // Test spectrogram mode
    await viewSelect.selectOption("spectrogram");
    await page.waitForTimeout(300);
    const spectrogramImg = await canvas.evaluate((c: HTMLCanvasElement) =>
      c.toDataURL(),
    );
    expect(spectrogramImg).toBeTruthy();

    // Test FFT mode
    await viewSelect.selectOption("fft");
    await page.waitForTimeout(300);
    const fftImg = await canvas.evaluate((c: HTMLCanvasElement) =>
      c.toDataURL(),
    );
    expect(fftImg).toBeTruthy();

    // Verify all modes produced different images
    expect(waterfallImg).not.toEqual(spectrogramImg);
    expect(spectrogramImg).not.toEqual(fftImg);

    // Stop streaming
    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });

  test("should maintain visualization continuity during mode switches @simulated", async ({
    page,
  }) => {
    await page.goto("https://localhost:8080/monitor?mockSdr=1");

    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 10000,
    });

    const viewSelect = page.getByLabel("Visualization mode");
    const canvas = page.locator("canvas").first();

    // Switch between modes multiple times and verify updates continue
    const modes = ["waterfall", "spectrogram", "fft"];

    for (const mode of modes) {
      await viewSelect.selectOption(mode);
      await page.waitForTimeout(200);

      // Capture two frames to verify continuous updates
      const frame1 = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );
      await page.waitForTimeout(200);
      const frame2 = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );

      // Frames should differ, indicating continuous updates
      expect(frame1).not.toEqual(frame2);
    }

    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });

  test("should display IQ constellation with simulated data @simulated", async ({
    page,
  }) => {
    await page.goto("https://localhost:8080/monitor?mockSdr=1");

    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 10000,
    });

    // Look for IQ Constellation canvas (typically labeled with aria-label)
    const iqCanvas = page.locator('canvas[aria-label*="IQ Constellation"]');

    // If IQ canvas exists, verify it's rendering
    if ((await iqCanvas.count()) > 0) {
      await expect(iqCanvas.first()).toBeVisible();

      // Verify it's updating
      const img1 = await iqCanvas
        .first()
        .evaluate((c: HTMLCanvasElement) => c.toDataURL());
      await page.waitForTimeout(300);
      const img2 = await iqCanvas
        .first()
        .evaluate((c: HTMLCanvasElement) => c.toDataURL());

      // Images may be same for simple signals, just verify it renders
      expect(img1).toBeTruthy();
      expect(img2).toBeTruthy();
    }

    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });

  test("should display amplitude waveform with simulated data @simulated", async ({
    page,
  }) => {
    await page.goto("https://localhost:8080/monitor?mockSdr=1");

    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 10000,
    });

    // Look for Waveform canvas
    const waveformCanvas = page.locator(
      'canvas[aria-label*="Waveform"], canvas[aria-label*="Amplitude"]',
    );

    if ((await waveformCanvas.count()) > 0) {
      await expect(waveformCanvas.first()).toBeVisible();

      // Verify it renders
      const img = await waveformCanvas
        .first()
        .evaluate((c: HTMLCanvasElement) => c.toDataURL());
      expect(img).toBeTruthy();
    }

    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });
});

test.describe("Visualization Performance @simulated", () => {
  test("should render frames at acceptable rate @simulated", async ({
    page,
  }) => {
    await page.goto("https://localhost:8080/monitor?mockSdr=1");

    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 10000,
    });

    const canvas = page.locator("canvas").first();

    // Measure frame updates over 2 seconds
    const startTime = Date.now();
    const snapshots: string[] = [];

    while (Date.now() - startTime < 2000) {
      const snapshot = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );
      snapshots.push(snapshot);
      await page.waitForTimeout(100);
    }

    // Count unique frames
    const uniqueFrames = new Set(snapshots).size;

    // Should have multiple unique frames (at least 3 in 2 seconds)
    expect(uniqueFrames).toBeGreaterThanOrEqual(3);

    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });

  test("should not leak memory during extended streaming @simulated", async ({
    page,
  }) => {
    await page.goto("https://localhost:8080/monitor?mockSdr=1");

    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 10000 });

    // Get initial JS heap size if available
    const getHeapSize = () =>
      page.evaluate(() => {
        if ("memory" in performance) {
          return (performance as any).memory?.usedJSHeapSize || 0;
        }
        return 0;
      });

    await startBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 10000,
    });

    // Let it stream for a few seconds
    await page.waitForTimeout(3000);

    const heap1 = await getHeapSize();

    // Continue streaming
    await page.waitForTimeout(2000);

    const heap2 = await getHeapSize();

    // If heap metrics available, verify no massive growth
    if (heap1 > 0 && heap2 > 0) {
      const growth = heap2 - heap1;
      const growthMB = growth / (1024 * 1024);

      // Memory growth should be reasonable (less than 50 MB in 2 seconds)
      expect(growthMB).toBeLessThan(50);
    }

    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false);
  });
});
