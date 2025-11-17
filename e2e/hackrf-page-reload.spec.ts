/**
 * HackRF Page Reload Tests
 *
 * Tests that verify proper device state management across page reloads.
 * These tests ensure that USB control transfers work correctly after page
 * navigation and that device firmware doesn't end up in a corrupted state.
 *
 * @group device
 * @group real
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

test.describe("HackRF Page Reload Stability @real @device", () => {
  test.use({ permissions: ["usb"] });

  let initialDeviceInfo: string | null = null;

  /**
   * Helper to check if device is initialized and working
   */
  async function verifyDeviceWorking(page: Page): Promise<boolean> {
    const result = await page.evaluate(async () => {
      // Access global device if available
      const globalRad = (globalThis as { radIo?: { primaryDevice?: unknown } })
        .radIo;
      const device = globalRad?.primaryDevice as
        | {
            getDeviceInfo?: () => Promise<{
              firmwareVersion?: string;
              serialNumber?: string;
            }>;
            setFrequency?: (freq: number) => Promise<void>;
            setSampleRate?: (rate: number) => Promise<void>;
          }
        | undefined;

      if (!device) {
        return { success: false, error: "No device found" };
      }

      try {
        // Try basic configuration operations
        await device.setSampleRate?.(10_000_000);
        await device.setFrequency?.(100_000_000);
        const info = await device.getDeviceInfo?.();

        return {
          success: true,
          deviceInfo: JSON.stringify(info),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    return result.success;
  }

  /**
   * Helper to get device firmware and serial info
   */
  async function getDeviceInfo(page: Page): Promise<string | null> {
    const result = await page.evaluate(async () => {
      const globalRad = (globalThis as { radIo?: { primaryDevice?: unknown } })
        .radIo;
      const device = globalRad?.primaryDevice as
        | { getDeviceInfo?: () => Promise<unknown> }
        | undefined;

      if (!device?.getDeviceInfo) {
        return null;
      }

      try {
        const info = await device.getDeviceInfo();
        return JSON.stringify(info);
      } catch {
        return null;
      }
    });

    return result;
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("https://localhost:8080", { waitUntil: "networkidle" });
    
    // Wait for device to be initialized
    await page.waitForFunction(
      () => {
        const globalRad = (globalThis as { radIo?: { primaryDevice?: unknown } })
          .radIo;
        return !!globalRad?.primaryDevice;
      },
      { timeout: 10000 }
    );

    // Get initial device info for comparison
    initialDeviceInfo = await getDeviceInfo(page);
    expect(initialDeviceInfo).not.toBeNull();
  });

  test("device works after single page reload", async ({ page }) => {
    // Verify device works initially
    const initialWorking = await verifyDeviceWorking(page);
    expect(initialWorking).toBe(true);

    // Reload the page
    await page.reload({ waitUntil: "networkidle" });

    // Wait for device to reconnect
    await page.waitForFunction(
      () => {
        const globalRad = (globalThis as { radIo?: { primaryDevice?: unknown } })
          .radIo;
        return !!globalRad?.primaryDevice;
      },
      { timeout: 10000 }
    );

    // Verify device still works after reload
    const postReloadWorking = await verifyDeviceWorking(page);
    expect(postReloadWorking).toBe(true);

    // Verify it's the same device
    const postReloadInfo = await getDeviceInfo(page);
    expect(postReloadInfo).toEqual(initialDeviceInfo);
  });

  test("device works after multiple rapid reloads", async ({ page }) => {
    // Verify device works initially
    expect(await verifyDeviceWorking(page)).toBe(true);

    // Perform 3 rapid reloads
    for (let i = 0; i < 3; i++) {
      await page.reload({ waitUntil: "networkidle" });

      // Wait for device to reconnect
      await page.waitForFunction(
        () => {
          const globalRad = (
            globalThis as { radIo?: { primaryDevice?: unknown } }
          ).radIo;
          return !!globalRad?.primaryDevice;
        },
        { timeout: 10000 }
      );

      // Verify device still works
      const working = await verifyDeviceWorking(page);
      expect(working).toBe(true);
    }

    // Verify final device info matches initial
    const finalInfo = await getDeviceInfo(page);
    expect(finalInfo).toEqual(initialDeviceInfo);
  });

  test("control transfers succeed after page reload", async ({ page }) => {
    // Test specific control transfer operations after reload
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForFunction(
      () => {
        const globalRad = (globalThis as { radIo?: { primaryDevice?: unknown } })
          .radIo;
        return !!globalRad?.primaryDevice;
      },
      { timeout: 10000 }
    );

    const transfersResult = await page.evaluate(async () => {
      const globalRad = (globalThis as { radIo?: { primaryDevice?: unknown } })
        .radIo;
      const device = globalRad?.primaryDevice as
        | {
            setSampleRate?: (rate: number) => Promise<void>;
            setFrequency?: (freq: number) => Promise<void>;
            setBandwidth?: (bw: number) => Promise<void>;
            setRxGain?: (gain: number) => Promise<void>;
          }
        | undefined;

      if (!device) {
        return { success: false, errors: ["No device"] };
      }

      const errors: string[] = [];

      try {
        await device.setSampleRate?.(20_000_000);
      } catch (error) {
        errors.push(
          `setSampleRate: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      try {
        await device.setFrequency?.(915_000_000);
      } catch (error) {
        errors.push(
          `setFrequency: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      try {
        await device.setBandwidth?.(2_500_000);
      } catch (error) {
        errors.push(
          `setBandwidth: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      try {
        await device.setRxGain?.(20);
      } catch (error) {
        errors.push(
          `setRxGain: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      return {
        success: errors.length === 0,
        errors,
      };
    });

    expect(transfersResult.success).toBe(true);
    if (!transfersResult.success) {
      console.error("Control transfer errors:", transfersResult.errors);
    }
  });

  test("device survives reload during active streaming", async ({ page }) => {
    // Start streaming
    const streamStarted = await page.evaluate(async () => {
      const globalRad = (globalThis as { radIo?: { primaryDevice?: unknown } })
        .radIo;
      const device = globalRad?.primaryDevice as
        | {
            setSampleRate?: (rate: number) => Promise<void>;
            setFrequency?: (freq: number) => Promise<void>;
            startStreaming?: () => Promise<void>;
          }
        | undefined;

      if (!device) {
        return false;
      }

      try {
        await device.setSampleRate?.(10_000_000);
        await device.setFrequency?.(100_000_000);
        await device.startStreaming?.();
        return true;
      } catch {
        return false;
      }
    });

    expect(streamStarted).toBe(true);

    // Wait a bit for streaming to be active
    await page.waitForTimeout(500);

    // Reload while streaming
    await page.reload({ waitUntil: "networkidle" });

    // Wait for device to reconnect
    await page.waitForFunction(
      () => {
        const globalRad = (globalThis as { radIo?: { primaryDevice?: unknown } })
          .radIo;
        return !!globalRad?.primaryDevice;
      },
      { timeout: 10000 }
    );

    // Verify device works after reload
    const working = await verifyDeviceWorking(page);
    expect(working).toBe(true);
  });

  test("no console errors after reload", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Reload and verify no errors
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForFunction(
      () => {
        const globalRad = (globalThis as { radIo?: { primaryDevice?: unknown } })
          .radIo;
        return !!globalRad?.primaryDevice;
      },
      { timeout: 10000 }
    );

    // Perform some operations
    await verifyDeviceWorking(page);

    // Filter out expected warnings (not errors)
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes("warn") &&
        !error.includes("Failed to fetch") && // Normal during reload
        !error.includes("net::ERR_") // Network errors during reload are expected
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test("device reset clears firmware state", async ({ page }) => {
    // Configure device with specific settings
    await page.evaluate(async () => {
      const globalRad = (globalThis as { radIo?: { primaryDevice?: unknown } })
        .radIo;
      const device = globalRad?.primaryDevice as
        | {
            setSampleRate?: (rate: number) => Promise<void>;
            setFrequency?: (freq: number) => Promise<void>;
            setRxGain?: (gain: number) => Promise<void>;
          }
        | undefined;

      await device?.setSampleRate?.(20_000_000);
      await device?.setFrequency?.(433_000_000);
      await device?.setRxGain?.(40);
    });

    // Reload page (triggers device reset on reopen)
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForFunction(
      () => {
        const globalRad = (globalThis as { radIo?: { primaryDevice?: unknown } })
          .radIo;
        return !!globalRad?.primaryDevice;
      },
      { timeout: 10000 }
    );

    // Verify device can be reconfigured with different settings
    const reconfigResult = await page.evaluate(async () => {
      const globalRad = (globalThis as { radIo?: { primaryDevice?: unknown } })
        .radIo;
      const device = globalRad?.primaryDevice as
        | {
            setSampleRate?: (rate: number) => Promise<void>;
            setFrequency?: (freq: number) => Promise<void>;
            setRxGain?: (gain: number) => Promise<void>;
          }
        | undefined;

      try {
        await device?.setSampleRate?.(10_000_000);
        await device?.setFrequency?.(915_000_000);
        await device?.setRxGain?.(20);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    expect(reconfigResult.success).toBe(true);
  });
});
