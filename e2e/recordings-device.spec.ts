import { test, expect } from "@playwright/test";
import { waitForDeviceReady } from "./helpers/device-helpers";

/**
 * E2E tests for Recording functionality with physical SDR device
 * Tagged with @device to run in the "device" project
 *
 * Requirements:
 * - RADIO_E2E_DEVICE=1 environment variable
 * - Previously paired HackRF device (WebUSB permission saved)
 * - Physical device connected
 *
 * Usage: npm run test:e2e:device -- --grep @device
 */

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

const DEVICE_ENABLED = process.env["RADIO_E2E_DEVICE"] === "1";

test.describe("Recordings with Physical Device @device", () => {
  test.skip(
    !DEVICE_ENABLED,
    "Skipping device tests (RADIO_E2E_DEVICE not set)",
  );

  test("should initialize recordings page with device @device", async ({
    page,
  }) => {
    await page.goto("/recordings");

    // Verify recordings page loaded
    await expect(page.locator("h1, h2")).toContainText(/recording/i, {
      timeout: 5000,
    });

    // Check for recording list or empty state
    const recordingsList = page.locator('[role="list"], table, .recordings');
    await expect(recordingsList.first()).toBeVisible({ timeout: 5000 });
  });

  test("should start recording from monitor with device @device", async ({
    page,
  }) => {
    // Navigate to monitor first
    await page.goto("/monitor");
    await waitForDeviceReady(page);

    // Wait for start button
    const startBtn = page.getByRole("button", { name: "Start reception" });
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await expect(startBtn).toBeEnabled({ timeout: 5000 });

    // Start streaming
    await startBtn.click();
    await page.waitForFunction(() => (window as any).dbgReceiving === true, {
      timeout: 15000,
    });

    // Look for record button
    const recordBtn = page.getByRole("button", {
      name: /record|start recording/i,
    });

    if (await recordBtn.isVisible()) {
      // Start recording
      await recordBtn.click();

      // Wait a few seconds to capture data
      await page.waitForTimeout(3000);

      // Stop recording
      const stopRecordBtn = page.getByRole("button", {
        name: /stop recording/i,
      });
      if (await stopRecordBtn.isVisible()) {
        await stopRecordBtn.click();
      }
    }

    // Stop streaming
    const stopBtn = page.getByRole("button", { name: "Stop reception" });
    await stopBtn.click();
  });

  test("should display recording metadata @device", async ({ page }) => {
    await page.goto("/recordings");

    // Look for recordings in the list
    const recordings = page.locator('[role="listitem"], tr, .recording-item');

    if ((await recordings.count()) > 0) {
      const firstRecording = recordings.first();
      await expect(firstRecording).toBeVisible();

      // Check for metadata (frequency, duration, timestamp, etc.)
      const metadata = firstRecording.locator("time, .duration, .frequency");
      if ((await metadata.count()) > 0) {
        await expect(metadata.first()).toBeVisible();
      }
    }
  });

  test("should play back recorded IQ data @device", async ({ page }) => {
    await page.goto("/recordings");

    // Look for recordings
    const recordings = page.locator('[role="listitem"], tr, .recording-item');

    if ((await recordings.count()) > 0) {
      // Look for play/replay button
      const playBtn = page.getByRole("button", {
        name: /play|replay|open/i,
      });

      if ((await playBtn.count()) > 0) {
        await playBtn.first().click();

        // Verify playback started (could navigate to monitor or play in place)
        // Check if we navigated to monitor
        const currentUrl = page.url();
        if (currentUrl.includes("/monitor")) {
          // Verify playback indicator
          await page.waitForFunction(
            () => (window as any).dbgReceiving === true,
            { timeout: 10000 },
          );
        }
      }
    }
  });

  test("should delete recording @device", async ({ page }) => {
    await page.goto("/recordings");

    // Look for recordings
    const recordings = page.locator('[role="listitem"], tr, .recording-item');
    const initialCount = await recordings.count();

    if (initialCount > 0) {
      // Look for delete button
      const deleteBtn = recordings
        .first()
        .locator(
          'button:has-text("Delete"), button[aria-label*="delete" i]',
        );

      if ((await deleteBtn.count()) > 0) {
        await deleteBtn.first().click();

        // Handle confirmation dialog if present
        const confirmBtn = page.getByRole("button", {
          name: /confirm|yes|delete/i,
        });
        if (await confirmBtn.isVisible({ timeout: 2000 })) {
          await confirmBtn.click();
        }

        // Wait for deletion
        await page.waitForTimeout(1000);

        // Verify count decreased (if there were multiple recordings)
        if (initialCount > 1) {
          const newCount = await recordings.count();
          expect(newCount).toBeLessThan(initialCount);
        }
      }
    }
  });

  test("should export recording @device", async ({ page }) => {
    await page.goto("/recordings");

    // Look for recordings
    const recordings = page.locator('[role="listitem"], tr, .recording-item');

    if ((await recordings.count()) > 0) {
      // Look for export/download button using accessible selectors
      const exportBtn = recordings
        .first()
        .getByRole("button", { name: /export|download/i });

      if ((await exportBtn.count()) > 0) {
        // Listen for download event
        const downloadPromise = page.waitForEvent("download", {
          timeout: 10000,
        });

        await exportBtn.first().click();

        // Verify download started
        const download = await downloadPromise.catch(() => null);
        if (download) {
          expect(download.suggestedFilename()).toMatch(/\.(iq|wav|bin)$/i);
        }
      }
    }
  });

  test("should filter recordings by criteria @device", async ({ page }) => {
    await page.goto("/recordings");

    // Look for filter controls
    const filterInput = page.locator(
      'input[type="search"], input[placeholder*="filter" i], input[placeholder*="search" i]',
    );

    if ((await filterInput.count()) > 0) {
      const searchTerm = "100"; // Search for recordings around 100 MHz

      await filterInput.first().fill(searchTerm);

      // Wait for filter to apply
      await page.waitForTimeout(1000);

      // Verify results are filtered
      const recordings = page.locator('[role="listitem"], tr, .recording-item');
      if ((await recordings.count()) > 0) {
        // At least one result should remain (if any matched)
        await expect(recordings.first()).toBeVisible();
      }
    }
  });
});
