import { test, expect } from "@playwright/test";

// Real HackRF E2E (opt-in). Requires:
// - Previously paired HackRF device (WebUSB permission saved)
// - Physical device connected
// - Launch with env E2E_REAL_HACKRF=1
// This test is tagged as @real and will only run when grep or env enables it.

test.use({ ignoreHTTPSErrors: true });

const REAL_ENABLED = process.env["E2E_REAL_HACKRF"] === "1";

(REAL_ENABLED ? test : test.skip)(
  "@real monitor should start/stop with real HackRF (paired)",
  async ({ page }) => {
    await page.goto("https://localhost:8080/monitor");

    // Wait for UI to check for paired devices; Start button should appear when device is present
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await expect(startBtn).toBeEnabled();

    // Start streaming
    await startBtn.click();

    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Let it run briefly
    await page.waitForTimeout(1000);

    // Stop
    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === false, {
      timeout: 10000,
    });
  },
);
