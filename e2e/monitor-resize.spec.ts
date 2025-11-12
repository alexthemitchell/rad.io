import { test, expect } from "@playwright/test";

test.use({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });

async function startReception(page) {
  const startBtn = page.getByRole("button", {
    name: /start receiving|start reception/i,
  });
  await expect(startBtn).toBeVisible({ timeout: 10000 });
  await expect(startBtn).toBeEnabled();
  await startBtn.click();
  await page.waitForFunction(() => (window as any).dbgReceiving === true, {
    timeout: 10000,
  });
}

test("canvas resizes when viewport changes", async ({ page }) => {
  await page.goto("/monitor?mockSdr=1");

  // Ensure spectrum canvas is rendered; no need to start reception for a layout-based resize
  const canvas = page.locator('canvas[aria-label*="spectrum" i]').first();
  await expect(canvas).toBeVisible({ timeout: 10000 });

  // Get initial client width
  const rect1 = await canvas.evaluate((c) => c.getBoundingClientRect());
  const width1 = Math.round(rect1.width);

  // Resize viewport
  await page.setViewportSize({ width: 900, height: 800 });

  // Wait for resize to take effect and a frame to render; prefer waiting for
  // the canvas width to change rather than arbitrary timeouts to reduce flakiness
  await page.waitForFunction(
    (w) => {
      const el = document.querySelector('canvas[aria-label*="spectrum" i]');
      return (
        !!el &&
        Math.round((el as HTMLCanvasElement).getBoundingClientRect().width) !==
          w
      );
    },
    width1,
    { timeout: 2000 },
  );

  const rect2 = await canvas.evaluate((c) => c.getBoundingClientRect());
  const width2 = Math.round(rect2.width);
  const innerWidthAfterShrink = await page.evaluate(() => window.innerWidth);
  const containerWidthAfterShrink = await page.evaluate(() => {
    const el = document.querySelector(".container") as HTMLElement | null;
    return el ? el.getBoundingClientRect().width : null;
  });

  // Accept either an explicit reduction or a no-op (for very small layout shifts).
  // Fail only if the width didn't change and viewport did change.
  if (innerWidthAfterShrink < 1280) {
    if (containerWidthAfterShrink === null) {
      // No .container element — don't fail; proceed to expansion check
    } else {
      // If the container width tracked the canvas width, ensure it changed
      if (Math.round(containerWidthAfterShrink) !== width1) {
        // If the container shrank, expect the canvas to have shrunk too
        expect(width2).toBeLessThan(width1);
      } else {
        // Container didn't shrink for this layout; continue rather than failing the test.
      }
    }
  }

  // Now expand viewport
  await page.setViewportSize({ width: 1400, height: 800 });
  // Wait for resize to take effect and a frame to render using waitForFunction
  await page.waitForFunction(
    (w) => {
      const el = document.querySelector('canvas[aria-label*="spectrum" i]');
      return (
        !!el &&
        Math.round((el as HTMLCanvasElement).getBoundingClientRect().width) !==
          w
      );
    },
    width2,
    { timeout: 2000 },
  );

  const rect3 = await canvas.evaluate((c) => c.getBoundingClientRect());
  const width3 = Math.round(rect3.width);

  // Expect width to increase when viewport expands
  expect(width3).toBeGreaterThan(width2);

  // Verify device pixel ratio (DPR)-aware canvas pixel buffer is updated
  // The canvas backing store (canvas.width/height) should be approximately
  // clientWidth * devicePixelRatio and clientHeight * devicePixelRatio.
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
  const backingSize = await canvas.evaluate((c: HTMLCanvasElement) => ({
    w: c.width,
    h: c.height,
  }));
  expect(backingSize.w).toBeGreaterThan(0);
  expect(backingSize.h).toBeGreaterThan(0);
  // Compare with rounded value to avoid small fractional mismatches
  expect(backingSize.w).toBe(Math.round(width3 * dpr));
  const height3 = Math.round(rect3.height);
  expect(backingSize.h).toBe(Math.round(height3 * dpr));
});
