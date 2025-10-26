/**
 * Hardware-gated tests for HackRF driver.
 *
 * These tests only run when:
 * 1. HACKRF_HARDWARE_TESTS=true environment variable is set
 * 2. hackrf_info command is available (tools installed)
 * 3. A physical HackRF device is connected
 *
 * To run these tests:
 *   HACKRF_HARDWARE_TESTS=true npm test -- src/hackrf/__tests__/HackRFHardware.test.ts
 *
 * These tests verify:
 * - Device detection using native commands
 * - Data streaming using hackrf_transfer
 * - Device information retrieval
 */

import {
  shouldRunHardwareTests,
  isHackRFCommandAvailable,
  isHackRFDeviceConnected,
  testHackRFStreaming,
  getHackRFDeviceInfo,
  skipIfNoHardware,
} from "../hardwareDetection";

describe("HackRF Hardware Tests", () => {
  let shouldSkip: boolean;

  beforeAll(async () => {
    shouldSkip = await skipIfNoHardware();

    if (shouldSkip) {
      console.log("Skipping hardware tests - no device available or HACKRF_HARDWARE_TESTS not set");
      console.log("To enable: HACKRF_HARDWARE_TESTS=true npm test");
    }
  });

  describe("Hardware detection", () => {
    it("should detect hackrf_info command availability", async () => {
      if (shouldSkip) {
        return; // Skip this test
      }

      const isAvailable = await isHackRFCommandAvailable();
      expect(isAvailable).toBe(true);
    });

    it("should detect connected HackRF device", async () => {
      if (shouldSkip) {
        return; // Skip this test
      }

      const isConnected = await isHackRFDeviceConnected();
      expect(isConnected).toBe(true);
    });

    it("should retrieve device information", async () => {
      if (shouldSkip) {
        return; // Skip this test
      }

      const info = await getHackRFDeviceInfo();
      expect(info).not.toBeNull();

      if (info) {
        // Device info should contain at least some fields
        expect(
          info.serialNumber || info.boardId || info.firmwareVersion,
        ).toBeDefined();

        // If serial number is present, it should be in hex format
        if (info.serialNumber) {
          expect(info.serialNumber).toMatch(/^0x[0-9a-f]+$/i);
        }

        // If board ID is present, it should be a number
        if (info.boardId) {
          expect(info.boardId).toMatch(/^\d+$/);
        }

        // If firmware version is present, it should be in version format
        if (info.firmwareVersion) {
          expect(info.firmwareVersion).toMatch(/^\d+\.\d+/);
        }
      }
    });
  });

  describe("Data streaming", () => {
    it("should successfully stream data at 100 MHz", async () => {
      if (shouldSkip) {
        return; // Skip this test
      }

      // Test streaming at 100 MHz (FM broadcast band)
      const success = await testHackRFStreaming(100_000_000, 100_000);
      expect(success).toBe(true);
    }, 15000); // Allow 15 seconds for streaming test

    it("should successfully stream data at different frequencies", async () => {
      if (shouldSkip) {
        return; // Skip this test
      }

      // Test multiple frequencies to ensure device works across spectrum
      const frequencies = [
        88_500_000, // FM radio low end
        433_000_000, // ISM band
        915_000_000, // ISM band (US)
        1_090_000_000, // ADS-B
      ];

      for (const freq of frequencies) {
        const success = await testHackRFStreaming(freq, 50_000);
        expect(success).toBe(true);
      }
    }, 60000); // Allow 60 seconds for multiple streaming tests

    it("should handle small sample counts", async () => {
      if (shouldSkip) {
        return; // Skip this test
      }

      // Test with minimal samples to verify quick captures work
      const success = await testHackRFStreaming(100_000_000, 10_000);
      expect(success).toBe(true);
    }, 10000);

    it("should handle larger sample counts", async () => {
      if (shouldSkip) {
        return; // Skip this test
      }

      // Test with larger sample count to verify sustained streaming
      const success = await testHackRFStreaming(100_000_000, 500_000);
      expect(success).toBe(true);
    }, 20000);
  });

  describe("Environment configuration", () => {
    it("should respect HACKRF_HARDWARE_TESTS environment variable", () => {
      const originalValue = process.env["HACKRF_HARDWARE_TESTS"];

      // Test when explicitly disabled
      process.env["HACKRF_HARDWARE_TESTS"] = "false";
      expect(shouldRunHardwareTests()).toBe(false);

      // Test when explicitly enabled
      process.env["HACKRF_HARDWARE_TESTS"] = "true";
      expect(shouldRunHardwareTests()).toBe(true);

      // Test when not set
      delete process.env["HACKRF_HARDWARE_TESTS"];
      expect(shouldRunHardwareTests()).toBe(false);

      // Restore original value
      if (originalValue !== undefined) {
        process.env["HACKRF_HARDWARE_TESTS"] = originalValue;
      } else {
        delete process.env["HACKRF_HARDWARE_TESTS"];
      }
    });
  });

  describe("Error handling", () => {
    it("should gracefully handle device disconnection", async () => {
      if (shouldSkip) {
        return; // Skip this test
      }

      // This test documents expected behavior when device is disconnected
      // during operation. In practice, this would require manual intervention.
      // We verify the detection functions don't crash.

      const isConnected = await isHackRFDeviceConnected();
      // Should return a boolean without throwing
      expect(typeof isConnected).toBe("boolean");
    });

    it("should timeout gracefully on streaming", async () => {
      if (shouldSkip) {
        return; // Skip this test
      }

      // Test with invalid frequency (outside HackRF range)
      // This should fail but not hang
      const success = await testHackRFStreaming(10_000_000_000, 1000); // 10 GHz - out of range
      // Expect failure for out-of-range frequency
      expect(success).toBe(false);
    }, 15000);
  });
});

describe("HackRF Hardware Tests - Informational", () => {
  /**
   * These tests always run to provide information about test environment
   * but don't fail if hardware is not available.
   */

  it("should report hardware test environment status", async () => {
    const envSet = shouldRunHardwareTests();
    const cmdAvailable = await isHackRFCommandAvailable();
    const deviceConnected = await isHackRFDeviceConnected();

    console.log("\n=== HackRF Hardware Test Environment ===");
    console.log(`HACKRF_HARDWARE_TESTS: ${envSet ? "true" : "false (not set)"}`);
    console.log(`hackrf_info available: ${cmdAvailable ? "yes" : "no"}`);
    console.log(`Device connected: ${deviceConnected ? "yes" : "no"}`);

    if (!envSet) {
      console.log("\nTo enable hardware tests:");
      console.log("  HACKRF_HARDWARE_TESTS=true npm test");
    }

    if (!cmdAvailable && envSet) {
      console.log("\nHackRF tools not installed. Install with:");
      console.log("  Ubuntu/Debian: sudo apt-get install hackrf");
      console.log("  macOS: brew install hackrf");
      console.log("  Arch: sudo pacman -S hackrf");
    }

    if (!deviceConnected && envSet && cmdAvailable) {
      console.log("\nNo HackRF device detected. Please:");
      console.log("  1. Connect HackRF device via USB");
      console.log("  2. Verify with: hackrf_info");
      console.log("  3. Check USB permissions");
    }

    console.log("=========================================\n");

    // This test always passes - it's informational only
    expect(true).toBe(true);
  });

  it("should display device info if available", async () => {
    const info = await getHackRFDeviceInfo();

    if (info) {
      console.log("\n=== HackRF Device Information ===");
      console.log(`Serial Number: ${info.serialNumber || "N/A"}`);
      console.log(`Board ID: ${info.boardId || "N/A"}`);
      console.log(`Firmware Version: ${info.firmwareVersion || "N/A"}`);
      console.log(`Part ID: ${info.partId || "N/A"}`);
      console.log("=================================\n");
    } else {
      console.log("\nNo HackRF device information available");
    }

    // This test always passes - it's informational only
    expect(true).toBe(true);
  });
});
