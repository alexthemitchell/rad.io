import { Page, Locator, expect } from "@playwright/test";

/**
 * Shared helper functions for device E2E tests
 */

/**
 * Wait for the device to be ready (auto-connected)
 */
export async function waitForDeviceReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const deviceContext = (window as any).deviceContext;
      return (
        deviceContext?.device !== null && deviceContext?.device !== undefined
      );
    },
    { timeout: 15000 },
  );
}

/**
 * Wait for the start button to be ready
 */
export async function waitForStartButton(page: Page) {
  // If connect button is visible, attempt to click it (this will open a browser WebUSB prompt
  // which may require manual approval; if pre-paired, it will connect instantly)
  const connectBtn = page.getByRole("button", { name: /connect device/i });
  if ((await connectBtn.count()) > 0 && (await connectBtn.isVisible())) {
    await connectBtn.click();
  }

  const startBtn = page.getByRole("button", { name: /start reception/i });
  await expect(startBtn).toBeVisible({ timeout: 15000 });
  await expect(startBtn).toBeEnabled({ timeout: 5000 });
  return startBtn;
}

/**
 * Wait for canvas to update (render a new frame)
 */
export async function waitForCanvasUpdate(
  page: Page,
  canvas: Locator,
  timeout = 5000,
): Promise<void> {
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
 * Stop streaming and wait for it to stop
 */
export async function stopStreaming(page: Page): Promise<void> {
  const stopBtn = page.getByRole("button", { name: "Stop reception" });
  await stopBtn.click();
  await page.waitForFunction(() => (window as any).dbgReceiving === false, {
    timeout: 10000,
  });
}
