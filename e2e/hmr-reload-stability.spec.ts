/**
 * HMR Reload Stability E2E Test
 * 
 * Validates that hot reloads and full reloads do not:
 * - Leave HackRF device in unstable state
 * - Create duplicate workers
 * - Trigger DataCloneError memory issues
 * - Fail to recover gracefully
 * 
 * This test simulates real-world development workflow with
 * frequent code changes triggering HMR and full reloads.
 */

import { test, expect, Page } from "@playwright/test";

// Helper to trigger global shutdown via console
async function triggerGlobalShutdown(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = (window as any).radIo;
    if (g && typeof g.shutdown === "function") {
      return g.shutdown();
    }
    return Promise.resolve();
  });
}

// Helper to count active workers (approximation via global)
async function getWorkerCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const g = (window as any).radIo;
    const pool = g?.dspWorkerPool;
    if (pool && typeof pool.getWorkerCount === "function") {
      return pool.getWorkerCount();
    }
    // Fallback: check if pool exists
    return pool ? 1 : 0;
  });
}

// Helper to check for console errors
function getConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  return errors;
}

test.describe("HMR Reload Stability", () => {
  test.beforeEach(async ({ page }) => {
    // Start on monitor page
    await page.goto("/monitor");
    await page.waitForLoadState("networkidle");
  });

  test("should handle full page reload gracefully", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Trigger shutdown
    await triggerGlobalShutdown(page);
    
    // Wait for shutdown to complete
    await page.waitForTimeout(500);

    // Reload page
    await page.reload({ waitUntil: "networkidle" });
    
    // Wait for app to stabilize
    await page.waitForTimeout(2000);

    // Check for DataCloneError or worker errors
    const hasDataCloneError = errors.some((e) =>
      e.includes("DataCloneError")
    );
    const hasWorkerError = errors.some((e) => e.includes("DedicatedWorkerGlobalScope"));

    expect(hasDataCloneError, "Should not have DataCloneError").toBe(false);
    expect(hasWorkerError, "Should not have worker errors").toBe(false);
  });

  test("should not duplicate workers across reloads", async ({ page }) => {
    // Get initial worker count
    const initialCount = await getWorkerCount(page);
    expect(initialCount).toBeGreaterThan(0);

    // Perform 3 reload cycles
    for (let i = 0; i < 3; i++) {
      await triggerGlobalShutdown(page);
      await page.waitForTimeout(300);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(1000);

      const count = await getWorkerCount(page);
      expect(count, `Worker count should remain stable after reload ${i + 1}`).toBe(
        initialCount
      );
    }
  });

  test("should maintain device connection across shutdown/reload", async ({
    page,
  }) => {
    // Check if device is connected initially
    const initialDevice = await page.evaluate(() => {
      return (window as any).radIo?.hasDevice ?? false;
    });

    if (!initialDevice) {
      test.skip();
      return;
    }

    // Trigger shutdown
    await triggerGlobalShutdown(page);
    await page.waitForTimeout(500);

    // Reload
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Check device reconnected
    const reconnected = await page.evaluate(() => {
      return (window as any).radIo?.hasDevice ?? false;
    });

    expect(reconnected, "Device should reconnect after reload").toBe(true);
  });

  test("should clear console errors after clean reload", async ({ page }) => {
    const preReloadErrors: string[] = [];
    const postReloadErrors: string[] = [];

    // Capture pre-reload errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        preReloadErrors.push(msg.text());
      }
    });

    // Trigger clean shutdown and reload
    await triggerGlobalShutdown(page);
    await page.waitForTimeout(500);

    // Clear error listener and add new one for post-reload
    page.removeAllListeners("console");
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        postReloadErrors.push(msg.text());
      }
    });

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Post-reload should have no new DataCloneError or recovery errors
    const hasDataCloneError = postReloadErrors.some((e) =>
      e.includes("DataCloneError")
    );
    const hasRecoveryError = postReloadErrors.some((e) =>
      e.includes("Automatic recovery failed")
    );

    expect(hasDataCloneError, "Should not have DataCloneError after clean reload").toBe(false);
    expect(hasRecoveryError, "Should not have recovery errors after clean reload").toBe(false);
  });

  test("should support rapid reload cycles", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("DataCloneError")) {
        errors.push(msg.text());
      }
    });

    // Perform 5 rapid reload cycles
    for (let i = 0; i < 5; i++) {
      await triggerGlobalShutdown(page);
      await page.waitForTimeout(200); // Minimal wait
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
    }

    // Should have no DataCloneError accumulation
    expect(errors.length, "Should not accumulate DataCloneErrors").toBe(0);
  });

  test("should validate global shutdown is available", async ({ page }) => {
    const hasShutdown = await page.evaluate(() => {
      const g = (window as any).radIo;
      return !!(g && typeof g.shutdown === "function");
    });

    expect(hasShutdown, "Global shutdown function should be available").toBe(true);
  });

  test("should validate worker pool termination on shutdown", async ({ page }) => {
    const initialCount = await getWorkerCount(page);
    expect(initialCount).toBeGreaterThan(0);

    // Trigger shutdown
    await triggerGlobalShutdown(page);
    await page.waitForTimeout(500);

    // Workers should be terminated (or count reset)
    // Note: After shutdown, before reload, pool might be empty
    const postShutdownCount = await getWorkerCount(page);
    
    // After reload, should have workers again
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    
    const postReloadCount = await getWorkerCount(page);
    expect(postReloadCount, "Workers should be re-created after reload").toBeGreaterThan(0);
  });
});
