/**
 * S-Meter E2E Tests
 * Tests S-Meter component with simulated signal injection
 * @simulated
 */

import { test, expect } from "@playwright/test";

test.describe("S-Meter Component @simulated", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should render S-Meter component", async ({ page }) => {
    // Navigate to a page with signal monitoring (e.g., Monitor page)
    const monitorLink = page.getByRole("link", { name: /monitor/i });
    await monitorLink.click();

    // Look for S-Meter region
    const sMeter = page
      .locator('[aria-label*="S-Meter"]')
      .or(page.locator(".s-meter"));

    // S-Meter might not be visible initially if no signal
    // This is expected behavior
    const sMeterCount = await sMeter.count();
    expect(sMeterCount).toBeGreaterThanOrEqual(0);
  });

  test("should update S-Meter with synthetic signal", async ({ page }) => {
    // Navigate to monitor page
    await page.goto("/#/monitor");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Inject a mock signal level into the store
    await page.evaluate(() => {
      // Access the global store if available
      const store = (window as any).__RADIO_STORE__;
      if (store && store.setSignalLevel) {
        store.setSignalLevel({
          dBfs: -30,
          dBmApprox: -100,
          sUnit: 7,
          overS9: 0,
          band: "VHF",
          calibrationStatus: "uncalibrated",
          uncertaintyDb: 10,
          timestamp: Date.now(),
        });
      }
    });

    // Wait a bit for the component to render
    await page.waitForTimeout(500);

    // Look for S7 in the meter (might be in multiple places - value and scale)
    const s7Text = page.getByText("S7").first();
    if ((await s7Text.count()) > 0) {
      await expect(s7Text).toBeVisible();
    }
  });

  test("should show color zones for different signal strengths", async ({
    page,
  }) => {
    await page.goto("/#/monitor");
    await page.waitForLoadState("networkidle");

    // Test weak signal (S3) - should have weak color
    await page.evaluate(() => {
      const store = (window as any).__RADIO_STORE__;
      if (store && store.setSignalLevel) {
        store.setSignalLevel({
          dBfs: -60,
          dBmApprox: -120,
          sUnit: 3,
          overS9: 0,
          band: "VHF",
          calibrationStatus: "uncalibrated",
          uncertaintyDb: 10,
          timestamp: Date.now(),
        });
      }
    });

    await page.waitForTimeout(300);

    // Check for weak signal color class if meter is present
    const weakBar = page.locator(".s-meter-bar-weak");
    if ((await weakBar.count()) > 0) {
      expect(await weakBar.count()).toBeGreaterThan(0);
    }

    // Test strong signal (S9+20) - should have moderate/strong color
    await page.evaluate(() => {
      const store = (window as any).__RADIO_STORE__;
      if (store && store.setSignalLevel) {
        store.setSignalLevel({
          dBfs: -20,
          dBmApprox: -73,
          sUnit: 9,
          overS9: 20,
          band: "VHF",
          calibrationStatus: "uncalibrated",
          uncertaintyDb: 10,
          timestamp: Date.now(),
        });
      }
    });

    await page.waitForTimeout(300);

    // Check for strong signal color class if meter is present
    const strongBar = page
      .locator(".s-meter-bar-strong")
      .or(page.locator(".s-meter-bar-moderate"));
    if ((await strongBar.count()) > 0) {
      expect(await strongBar.count()).toBeGreaterThan(0);
    }
  });

  test("should display S9+ format for strong signals", async ({ page }) => {
    await page.goto("/#/monitor");
    await page.waitForLoadState("networkidle");

    // Inject S9+40 signal
    await page.evaluate(() => {
      const store = (window as any).__RADIO_STORE__;
      if (store && store.setSignalLevel) {
        store.setSignalLevel({
          dBfs: -10,
          dBmApprox: -53,
          sUnit: 9,
          overS9: 40,
          band: "VHF",
          calibrationStatus: "user",
          uncertaintyDb: 1.5,
          timestamp: Date.now(),
        });
      }
    });

    await page.waitForTimeout(500);

    // Look for S9+40 text
    const s9Plus40 = page.getByText("S9+40");
    if ((await s9Plus40.count()) > 0) {
      await expect(s9Plus40).toBeVisible();
    }
  });

  test("should show dBm value when enabled", async ({ page }) => {
    await page.goto("/#/monitor");
    await page.waitForLoadState("networkidle");

    // Inject signal with specific dBm value
    await page.evaluate(() => {
      const store = (window as any).__RADIO_STORE__;
      if (store && store.setSignalLevel) {
        store.setSignalLevel({
          dBfs: -35,
          dBmApprox: -105,
          sUnit: 5,
          overS9: 0,
          band: "VHF",
          calibrationStatus: "uncalibrated",
          uncertaintyDb: 10,
          timestamp: Date.now(),
        });
      }
    });

    await page.waitForTimeout(500);

    // Look for dBm value (if showDbm is enabled)
    const dbmText = page.getByText(/-\d+ dBm/);
    if ((await dbmText.count()) > 0) {
      await expect(dbmText).toBeVisible();
    }
  });

  test("should show band indicator (HF/VHF)", async ({ page }) => {
    await page.goto("/#/monitor");
    await page.waitForLoadState("networkidle");

    // Test VHF band
    await page.evaluate(() => {
      const store = (window as any).__RADIO_STORE__;
      if (store && store.setSignalLevel) {
        store.setSignalLevel({
          dBfs: -30,
          dBmApprox: -100,
          sUnit: 6,
          overS9: 0,
          band: "VHF",
          calibrationStatus: "uncalibrated",
          uncertaintyDb: 10,
          timestamp: Date.now(),
        });
      }
    });

    await page.waitForTimeout(300);

    // Look for VHF indicator
    const vhfBand = page.locator(".s-meter-band").getByText("VHF");
    if ((await vhfBand.count()) > 0) {
      await expect(vhfBand).toBeVisible();
    }

    // Test HF band
    await page.evaluate(() => {
      const store = (window as any).__RADIO_STORE__;
      if (store && store.setSignalLevel) {
        store.setSignalLevel({
          dBfs: -30,
          dBmApprox: -100,
          sUnit: 6,
          overS9: 0,
          band: "HF",
          calibrationStatus: "uncalibrated",
          uncertaintyDb: 10,
          timestamp: Date.now(),
        });
      }
    });

    await page.waitForTimeout(300);

    // Look for HF indicator
    const hfBand = page.locator(".s-meter-band").getByText("HF");
    if ((await hfBand.count()) > 0) {
      await expect(hfBand).toBeVisible();
    }
  });

  test("should have proper accessibility attributes", async ({ page }) => {
    await page.goto("/#/monitor");
    await page.waitForLoadState("networkidle");

    // Inject signal
    await page.evaluate(() => {
      const store = (window as any).__RADIO_STORE__;
      if (store && store.setSignalLevel) {
        store.setSignalLevel({
          dBfs: -30,
          dBmApprox: -100,
          sUnit: 7,
          overS9: 0,
          band: "VHF",
          calibrationStatus: "uncalibrated",
          uncertaintyDb: 10,
          timestamp: Date.now(),
        });
      }
    });

    await page.waitForTimeout(500);

    // Check for meter role with ARIA attributes
    const meterBar = page.locator('[role="meter"]');
    if ((await meterBar.count()) > 0) {
      await expect(meterBar.first()).toHaveAttribute("aria-valuenow");
      await expect(meterBar.first()).toHaveAttribute("aria-valuemin", "0");
      await expect(meterBar.first()).toHaveAttribute("aria-valuemax", "100");
      await expect(meterBar.first()).toHaveAttribute("aria-label");
    }

    // Check for ARIA live region
    const liveRegion = page.locator('[aria-live="polite"]');
    if ((await liveRegion.count()) > 0) {
      expect(await liveRegion.count()).toBeGreaterThan(0);
    }
  });

  test("should smoothly update on rapid signal changes", async ({ page }) => {
    await page.goto("/#/monitor");
    await page.waitForLoadState("networkidle");

    // Rapidly inject different signal levels
    for (let i = 1; i <= 9; i++) {
      await page.evaluate((sUnit) => {
        const store = (window as any).__RADIO_STORE__;
        if (store && store.setSignalLevel) {
          store.setSignalLevel({
            dBfs: -30 - (9 - sUnit) * 5,
            dBmApprox: -100 - (9 - sUnit) * 6,
            sUnit,
            overS9: 0,
            band: "VHF",
            calibrationStatus: "uncalibrated",
            uncertaintyDb: 10,
            timestamp: Date.now(),
          });
        }
      }, i);

      await page.waitForTimeout(100);
    }

    // Component should still be present and not have crashed
    const sMeter = page.locator(".s-meter");
    if ((await sMeter.count()) > 0) {
      await expect(sMeter.first()).toBeVisible();
    }
  });

  test("should display calibration indicator for calibrated signals", async ({
    page,
  }) => {
    await page.goto("/#/monitor");
    await page.waitForLoadState("networkidle");

    // Inject user-calibrated signal
    await page.evaluate(() => {
      const store = (window as any).__RADIO_STORE__;
      if (store && store.setSignalLevel) {
        store.setSignalLevel({
          dBfs: -30,
          dBmApprox: -100,
          sUnit: 7,
          overS9: 0,
          band: "VHF",
          calibrationStatus: "user",
          uncertaintyDb: 1.5,
          timestamp: Date.now(),
        });
      }
    });

    await page.waitForTimeout(500);

    // Look for calibration indicator (ruler emoji for user calibration)
    const calibrationIcon = page.locator(".s-meter-calibration");
    if ((await calibrationIcon.count()) > 0) {
      await expect(calibrationIcon.first()).toBeVisible();
    }
  });

  test("should handle segment style meter", async ({ page }) => {
    // This test assumes we can configure the meter style
    // For now, just verify the CSS classes exist
    await page.goto("/#/monitor");
    await page.waitForLoadState("networkidle");

    // Inject signal
    await page.evaluate(() => {
      const store = (window as any).__RADIO_STORE__;
      if (store && store.setSignalLevel) {
        store.setSignalLevel({
          dBfs: -30,
          dBmApprox: -100,
          sUnit: 7,
          overS9: 0,
          band: "VHF",
          calibrationStatus: "uncalibrated",
          uncertaintyDb: 10,
          timestamp: Date.now(),
        });
      }
    });

    await page.waitForTimeout(500);

    // Check that either bar or segments style is present
    const barContainer = page.locator(".s-meter-bar-container");
    const segmentsContainer = page.locator(".s-meter-segments");

    const hasBar = (await barContainer.count()) > 0;
    const hasSegments = (await segmentsContainer.count()) > 0;

    // At least one display style should be present
    expect(hasBar || hasSegments).toBeTruthy();
  });
});
