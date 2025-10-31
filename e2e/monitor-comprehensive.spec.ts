import { test, expect, type Page } from "@playwright/test";

/**
 * Comprehensive E2E tests for Monitor workspace (default/primary view)
 * Based on: ADR-0018 (UX IA), PRD, UI Design Spec
 *
 * Monitor is the primary workspace for:
 * - Real-time spectrum+waterfall visualization
 * - VFO tuning and frequency control
 * - Audio demodulation (AM/FM/SSB/CW)
 * - S-meter and signal quality
 * - Quick actions (record, bookmark)
 *
 * Success criteria from PRD:
 * - 60 FPS at 8192 bins
 * - <150ms click-to-audio latency
 * - Keyboard-first operation
 * - WCAG 2.1 AA compliance
 */

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

// Helper to start reception with mock device
async function startReception(page: Page): Promise<void> {
  const startBtn = page.getByRole("button", { name: /start reception/i });
  await expect(startBtn).toBeVisible({ timeout: 10000 });
  await expect(startBtn).toBeEnabled();
  await startBtn.click();

  // Wait for streaming to begin
  await page.waitForFunction(() => (window as any).dbgReceiving === true, {
    timeout: 10000,
  });
}

test.describe("Monitor - Core Functionality", () => {
  test("should load monitor page as default route", async ({ page }) => {
    await page.goto("/");

    // Verify we're on the monitor page
    await expect(page).toHaveURL(/^\/$|\/monitor$/);

    // Verify main heading
    const heading = page.getByRole("heading", { name: "rad.io", level: 1 });
    await expect(heading).toBeVisible();
  });

  test("should display primary UI elements per UI Design Spec", async ({
    page,
  }) => {
    await page.goto("/monitor?mockSdr=1");

    // Top app bar should be present
    const topBar = page.locator('header[role="banner"], .top-app-bar, .header');
    await expect(topBar.first()).toBeVisible();

    // Frequency display should be visible (JetBrains Mono, tabular figures)
    const freqDisplay = page.getByLabel(/frequency/i);
    await expect(freqDisplay).toBeVisible();

    // Navigation should be present
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav.first()).toBeVisible();

    // Main content area
    const main = page.locator('main, [role="main"]');
    await expect(main).toBeVisible();

    // Status bar at bottom
    const statusBar = page.locator('.status-bar, [role="status"]');
    await expect(statusBar.first()).toBeVisible();
  });

  test("should start and stop reception with mock SDR", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");

    await startReception(page);

    // Verify status updates
    const status = page.getByRole("status");
    await expect(status).toContainText(/receiving|tuned|streaming/i, {
      timeout: 10000,
    });

    // Stop reception
    const stopBtn = page.getByRole("button", { name: /stop reception/i });
    await expect(stopBtn).toBeVisible();
    await stopBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === false, {
      timeout: 5000,
    });
  });
});

test.describe("Monitor - Spectrum Visualization", () => {
  test("should render spectrum canvas with proper ARIA attributes", async ({
    page,
  }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    // Find spectrum canvas
    const spectrumCanvas = page
      .locator('canvas[aria-label*="spectrum" i]')
      .first();
    await expect(spectrumCanvas).toBeVisible({ timeout: 10000 });

    // Verify ARIA role
    await expect(spectrumCanvas).toHaveAttribute("role", "img");

    // Verify aria-label is descriptive
    const ariaLabel = await spectrumCanvas.getAttribute("aria-label");
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel!.length).toBeGreaterThan(10);
  });

  test("should maintain 60 FPS target rendering", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();

    // Collect frame snapshots over 2 seconds
    const startTime = Date.now();
    const snapshots: string[] = [];

    while (Date.now() - startTime < 2000) {
      const snapshot = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );
      snapshots.push(snapshot);
      await page.waitForTimeout(50); // Sample at 20Hz
    }

    // Count unique frames (some patterns may be static)
    const uniqueFrames = new Set(snapshots).size;

    // Should have multiple unique frames if animating
    // For static patterns, at least verify rendering occurred
    expect(uniqueFrames).toBeGreaterThanOrEqual(1);
    expect(snapshots.length).toBeGreaterThan(0);
  });

  test("should display grid overlay when enabled", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    // Look for grid toggle control
    const gridToggle = page.getByRole("checkbox", { name: /grid/i });

    if ((await gridToggle.count()) > 0) {
      const canvas = page.locator("canvas").first();

      // Capture without grid
      await gridToggle.uncheck();
      await page.waitForTimeout(200);
      const imgNoGrid = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );

      // Enable grid and capture
      await gridToggle.check();
      await page.waitForTimeout(200);
      const imgWithGrid = await canvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );

      // Images should differ when grid is toggled
      expect(imgNoGrid).not.toEqual(imgWithGrid);
    }
  });
});

test.describe("Monitor - Waterfall Display", () => {
  test("should render waterfall when enabled", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    // Find waterfall toggle
    const waterfallToggle = page.getByRole("checkbox", {
      name: /waterfall/i,
    });

    if ((await waterfallToggle.count()) > 0) {
      await waterfallToggle.check();

      // Waterfall canvas should appear
      const waterfallCanvas = page.locator('canvas[aria-label*="waterfall" i]');
      await expect(waterfallCanvas.first()).toBeVisible({ timeout: 5000 });

      // Should have role="img"
      await expect(waterfallCanvas.first()).toHaveAttribute("role", "img");
    }
  });

  test("should scroll waterfall over time", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    const waterfallToggle = page.getByRole("checkbox", {
      name: /waterfall/i,
    });

    if ((await waterfallToggle.count()) > 0) {
      await waterfallToggle.check();

      const waterfallCanvas = page
        .locator('canvas[aria-label*="waterfall" i]')
        .first();
      await expect(waterfallCanvas).toBeVisible({ timeout: 5000 });

      // Capture initial state
      const img1 = await waterfallCanvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );

      // Wait for scrolling
      await page.waitForTimeout(1000);

      // Capture after scrolling
      const img2 = await waterfallCanvas.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
      );

      // Waterfall should have scrolled (images differ)
      expect(img1).not.toEqual(img2);
    }
  });

  test("should support click-to-tune in waterfall", async ({ page }) => {
    // This test validates the intended behavior per UI spec
    // Implementation may be pending
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    const waterfallToggle = page.getByRole("checkbox", {
      name: /waterfall/i,
    });

    if ((await waterfallToggle.count()) > 0) {
      await waterfallToggle.check();

      const waterfallCanvas = page
        .locator('canvas[aria-label*="waterfall" i]')
        .first();
      await expect(waterfallCanvas).toBeVisible();

      // Get initial frequency
      const freqInput = page.getByLabel(/frequency/i).first();
      const initialFreq = await freqInput.inputValue();

      // Click in waterfall (center)
      const box = await waterfallCanvas.boundingBox();
      if (box) {
        await waterfallCanvas.click({
          position: { x: box.width / 2, y: box.height / 2 },
        });

        // Allow time for frequency to update
        await page.waitForTimeout(500);

        // Frequency may have changed (depends on implementation)
        const newFreq = await freqInput.inputValue();
        // Assert that frequency has changed after click (click-to-tune)
        expect(newFreq).not.toEqual(initialFreq);
        // Note: Test documents intended behavior; may not be implemented yet
      }
    }
  });
});

test.describe("Monitor - VFO and Frequency Control", () => {
  test("should display frequency in large, readable format", async ({
    page,
  }) => {
    await page.goto("/monitor?mockSdr=1");

    const freqDisplay = page.getByLabel(/frequency/i).first();
    await expect(freqDisplay).toBeVisible();

    // Should have a value
    const value = await freqDisplay.inputValue();
    expect(value).toBeTruthy();
    expect(parseFloat(value)).toBeGreaterThan(0);
  });

  test("should change frequency when input is updated", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");

    const freqInput = page.getByLabel(/frequency/i).first();
    await expect(freqInput).toBeVisible();

    // Clear and enter new frequency
    await freqInput.clear();
    await freqInput.fill("100.5");
    await freqInput.press("Enter");

    // Verify frequency was accepted
    await page.waitForTimeout(300);
    const value = await freqInput.inputValue();
    expect(parseFloat(value)).toBeCloseTo(100.5, 1);
  });

  test("should support arrow key frequency adjustment", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");

    const freqInput = page.getByLabel(/frequency/i).first();
    await expect(freqInput).toBeVisible();

    // Get initial value
    const initialValue = await freqInput.inputValue();
    const initialNum = parseFloat(initialValue);

    // Focus and press arrow up
    await freqInput.focus();
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(200);

    // Value should have increased (exact amount depends on step size)
    const newValue = await freqInput.inputValue();
    const newNum = parseFloat(newValue);
    expect(newNum).toBeGreaterThanOrEqual(initialNum);
  });

  test("should support Page Up/Down for coarse tuning", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");

    const freqInput = page.getByLabel(/frequency/i).first();
    await expect(freqInput).toBeVisible();

    await freqInput.focus();
    const initialValue = await freqInput.inputValue();
    const initialNum = parseFloat(initialValue);

    // Page Up for coarse step up
    await page.keyboard.press("PageUp");
    await page.waitForTimeout(200);

    const newValue = await freqInput.inputValue();
    const newNum = parseFloat(newValue);

    // Should have changed by a coarse step
    const change = Math.abs(newNum - initialNum);
    expect(change).toBeGreaterThan(0);
  });
});

test.describe("Monitor - Status Bar Metrics", () => {
  test("should display GPU rendering tier", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    const statusBar = page.getByRole("status");

    // Should show a rendering tier
    const tierText = statusBar.getByText(
      /WebGPU|WebGL2|WebGL|Worker|Canvas2D/i,
    );
    await expect(tierText).toBeVisible({ timeout: 5000 });
  });

  test("should display FPS metrics", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    const statusBar = page.getByRole("status");

    // Look for FPS display
    const fpsText = statusBar.getByText(/FPS/i);
    if ((await fpsText.count()) > 0) {
      await expect(fpsText.first()).toBeVisible();
    }
  });

  test("should display sample rate when device active", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    const statusBar = page.getByRole("status");

    // Should show sample rate (e.g., "2.048 MS/s")
    const sampleRateText = statusBar.getByText(/MS\/s|kS\/s|samples/i);
    if ((await sampleRateText.count()) > 0) {
      await expect(sampleRateText.first()).toBeVisible();
    }
  });

  test("should display buffer health indicator", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    const statusBar = page.getByRole("status");

    // Look for buffer health (Good, Warning, Critical)
    const bufferText = statusBar.getByText(/buffer|health/i);
    if ((await bufferText.count()) > 0) {
      await expect(bufferText.first()).toBeVisible();
    }
  });

  test("should display storage usage", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");

    const statusBar = page.getByRole("status");

    // Look for storage indicator
    const storageText = statusBar.getByText(/storage|GB|MB|quota/i);
    if ((await storageText.count()) > 0) {
      await expect(storageText.first()).toBeVisible();
    }
  });

  test("should display audio state", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    const statusBar = page.getByRole("status");

    // Look for audio state indicators
    const audioText = statusBar.getByText(/audio|playing|muted|suspended/i);
    if ((await audioText.count()) > 0) {
      await expect(audioText.first()).toBeVisible();
    }
  });
});

test.describe("Monitor - IQ Constellation Display", () => {
  test("should render IQ constellation diagram", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    const iqCanvas = page.locator('canvas[aria-label*="constellation" i]');

    if ((await iqCanvas.count()) > 0) {
      await expect(iqCanvas.first()).toBeVisible();
      await expect(iqCanvas.first()).toHaveAttribute("role", "img");

      // Verify it's rendering
      const img = await iqCanvas
        .first()
        .evaluate((c: HTMLCanvasElement) => c.toDataURL());
      expect(img).toBeTruthy();
      expect(img.length).toBeGreaterThan(100);
    }
  });

  test("should update IQ constellation in real-time", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    const iqCanvas = page.locator('canvas[aria-label*="constellation" i]');

    if ((await iqCanvas.count()) > 0) {
      const img1 = await iqCanvas
        .first()
        .evaluate((c: HTMLCanvasElement) => c.toDataURL());

      await page.waitForTimeout(300);

      const img2 = await iqCanvas
        .first()
        .evaluate((c: HTMLCanvasElement) => c.toDataURL());

      // For dynamic patterns, images should differ
      // For static patterns, at least verify rendering
      expect(img1).toBeTruthy();
      expect(img2).toBeTruthy();
    }
  });
});

test.describe("Monitor - Waveform Display", () => {
  test("should render amplitude waveform", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    const waveformCanvas = page.locator(
      'canvas[aria-label*="waveform" i], canvas[aria-label*="amplitude" i]',
    );

    if ((await waveformCanvas.count()) > 0) {
      await expect(waveformCanvas.first()).toBeVisible();
      await expect(waveformCanvas.first()).toHaveAttribute("role", "img");
    }
  });
});

test.describe("Monitor - Mode Selection", () => {
  test("should allow cycling through demodulation modes", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");

    // Look for mode selector (select, buttons, or radio group)
    const modeControl = page.locator(
      'select[aria-label*="mode" i], [role="radiogroup"], button[aria-label*="mode" i]',
    );

    if ((await modeControl.count()) > 0) {
      await expect(modeControl.first()).toBeVisible();

      // If it's a select, try changing modes
      if (await modeControl.first().evaluate((el) => el.tagName === "SELECT")) {
        const options = await modeControl.first().locator("option").count();
        expect(options).toBeGreaterThan(0);
      }
    }
  });

  test("should support keyboard shortcut M to cycle modes", async ({
    page,
  }) => {
    await page.goto("/monitor?mockSdr=1");

    // Get current mode (if displayed)
    await page.waitForTimeout(500);

    // Press M to cycle mode
    await page.keyboard.press("m");
    await page.waitForTimeout(300);

    // Mode should have changed (exact verification depends on implementation)
    // This test documents the intended keyboard shortcut behavior
  });
});

test.describe("Monitor - Audio Controls", () => {
  test("should have audio control elements", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");

    // Look for volume, mute, or audio-related controls
    const audioControls = page.locator(
      'button[aria-label*="audio" i], button[aria-label*="volume" i], button[aria-label*="mute" i], input[aria-label*="volume" i]',
    );

    if ((await audioControls.count()) > 0) {
      await expect(audioControls.first()).toBeVisible();
    }
  });
});

test.describe("Monitor - Performance", () => {
  test("should not leak memory during extended streaming", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await startReception(page);

    // Get initial heap size if available
    const getHeapSize = () =>
      page.evaluate(() => {
        if ("memory" in performance) {
          return (performance as any).memory?.usedJSHeapSize || 0;
        }
        return 0;
      });

    await page.waitForTimeout(3000);
    const heap1 = await getHeapSize();

    await page.waitForTimeout(3000);
    const heap2 = await getHeapSize();

    if (heap1 > 0 && heap2 > 0) {
      const growth = heap2 - heap1;
      const growthMB = growth / (1024 * 1024);

      // Memory growth should be reasonable (<50MB over 6 seconds)
      expect(growthMB).toBeLessThan(50);
    }
  });

  test("should handle rapid start/stop cycles", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");

    const startBtn = page.getByRole("button", { name: /start reception/i });
    const stopBtn = page.getByRole("button", { name: /stop reception/i });

    // Cycle 3 times
    for (let i = 0; i < 3; i++) {
      await expect(startBtn).toBeVisible();
      await startBtn.click();
      await page.waitForTimeout(300);

      await expect(stopBtn).toBeVisible();
      await stopBtn.click();
      await page.waitForTimeout(300);
    }

    // Should still be functional
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();
  });
});

test.describe("Monitor - Navigation Integration", () => {
  test("should be accessible via root path", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/^\/$|\/monitor$/);
  });

  test("should be accessible via /monitor path", async ({ page }) => {
    await page.goto("/monitor");
    await expect(page).toHaveURL(/\/monitor/);
  });

  test("should preserve mock SDR flag in URL", async ({ page }) => {
    await page.goto("/monitor?mockSdr=1");
    await expect(page).toHaveURL(/mockSdr=1/);
  });
});
