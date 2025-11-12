import { test, expect, type Page } from "@playwright/test";

test.use({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });

// Reuse robust helper matching logic from visualization-simulated.spec.ts
async function ensureReceiving(page: Page): Promise<void> {
  const gotIt = await page
    .waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 5000,
    })
    .catch(() => null);
  if (gotIt) return;

  // If Stop button exists, assume already receiving
  let stopBtn = page.getByRole("button", { name: "Stop reception" });
  if (await stopBtn.count().then((c) => c > 0)) {
    return;
  }

  // Otherwise try to click Start; prefer explicit 'Start reception' but fallback to any 'Start' button
  let startBtn = page.getByRole("button", { name: "Start reception" });
  if (!(await startBtn.count().then((c) => c > 0))) {
    startBtn = page.getByRole("button", { name: /start/i });
  }
  if (await startBtn.count().then((c) => c > 0)) {
    await expect(startBtn).toBeEnabled({ timeout: 5000 });
    await startBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 8000,
    });
  }
}

test("gridlines overlay is visible on Monitor page @simulated", async ({
  page,
}) => {
  await page.goto("/monitor?mockSdr=1");
  // Ensure reception is started so the visualization and annotations render
  await ensureReceiving(page);
  // Wait for the overlay canvas to appear; with mock data this should be immediate
  await page.waitForSelector('canvas[aria-label*="Signal Annotations"]', {
    timeout: 5000,
  });

  // Wait for annotations overlay canvas to be present
  const overlay = page.locator('canvas[aria-label*="Signal Annotations"]');
  await expect(overlay.first()).toBeVisible({ timeout: 5000 });

  // Sample a few pixels across the overlay to verify some non-transparent pixel exists
  const anyNonTransparent = await overlay
    .first()
    .evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext("2d");
      if (!ctx) return false;
      const width = c.width;
      const height = c.height;
      // Check a grid of sample points
      for (
        let y = Math.floor(height * 0.2);
        y < height;
        y += Math.max(1, Math.floor(height * 0.2))
      ) {
        for (
          let x = Math.floor(width * 0.05);
          x < width;
          x += Math.max(1, Math.floor(width * 0.05))
        ) {
          const data = ctx.getImageData(x, y, 1, 1).data;
          if (data[3] > 5) return true; // alpha greater than threshold
          if (data[0] > 20 || data[1] > 20 || data[2] > 20) return true;
        }
      }
      return false;
    });

  expect(anyNonTransparent).toBe(true);

  // Verify grid label toggle hides/shows labels
  const controlsToggle = page.getByRole("button", {
    name: /Expand controls|Visualization/,
  });
  if (await controlsToggle.count().then((c) => c > 0)) {
    await controlsToggle.click();
  }
  const gridLabelsCheckbox = page.getByRole("checkbox", {
    name: /Show Grid Labels/,
  });
  await expect(gridLabelsCheckbox).toBeVisible();
  // Ensure grid labels are initially visible and then toggle off
  if (await gridLabelsCheckbox.isChecked()) {
    await gridLabelsCheckbox.uncheck();
    // When unchecked, labels should no longer be drawn (scan a small region near x axis for text alpha)
    const labelPresent = await overlay
      .first()
      .evaluate((c: HTMLCanvasElement) => {
        const ctx = c.getContext("2d");
        if (!ctx) return false;
        const width = c.width;
        const height = c.height;
        const y = Math.floor(height * 0.95);
        for (
          let x = Math.floor(width * 0.1);
          x < width;
          x += Math.floor(width * 0.1)
        ) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          if (d[3] > 5) return true;
        }
        return false;
      });
    expect(labelPresent).toBe(false);
    // Re-enable grid labels
    await gridLabelsCheckbox.check();
  }
});
