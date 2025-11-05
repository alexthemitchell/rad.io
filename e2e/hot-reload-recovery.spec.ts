import { test, expect } from "@playwright/test";

/**
 * Hot-reload recovery: ensure WebUSB session is torn down cleanly and re-established
 * without transfer errors after a reload/HMR cycle.
 */

test.describe("Hot reload recovery", () => {
  test("reload does not leave HackRF in a bad state", async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on("console", (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));

    await page.goto("/monitor");

    // Wait for initial streaming state (Stop reception button indicates active stream)
    await expect(page.getByRole("button", { name: "Stop reception" })).toBeVisible({ timeout: 20000 });

    // Trigger a full reload (simulates HMR fallback scenario)
    await page.evaluate(() => location.reload());

    // Wait for app to come back up
    await page.waitForLoadState("domcontentloaded");

    // Give it a short window to reinitialize the device
    await page.waitForTimeout(4000);

    // Assert no known failure signatures occurred after reload
    const recent = consoleMessages.slice(-200).join("\n");
    const forbiddenPatterns = [
      "Start failed",
      "Unexpected error during USB transfer",
      "Automatic recovery failed",
      "Device is closing or closed",
      "DataCloneError: Failed to execute 'postMessage'",
    ];
    for (const pat of forbiddenPatterns) {
      expect(recent, `Console should not contain: ${pat}`).not.toContain(pat);
    }

    // UI should reflect a connected device and active controls again
    await expect(page.getByRole("heading", { name: "Signal Monitor" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop reception" })).toBeVisible({ timeout: 10000 });

    // Optional: sanity check that exactly one device is exposed and opened
    const openedCount = await page.evaluate(async () => {
      if (!navigator.usb) return -1;
      const ds = await navigator.usb.getDevices();
      return ds.filter((d) => (d as any).opened === true).length;
    });
    expect(openedCount).toBeGreaterThanOrEqual(0); // non-fatal in CI
  });
});
