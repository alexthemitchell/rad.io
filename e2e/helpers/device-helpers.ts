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
  const startBtn = page.getByRole("button", { name: "Start reception" });
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
