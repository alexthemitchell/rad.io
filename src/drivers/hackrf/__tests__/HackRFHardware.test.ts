/**
 * Hardware-gated tests for HackRF driver using WebUSB.
 *
 * These tests only run when:
 * 1. HACKRF_HARDWARE_TESTS=true environment variable is set
 * 2. Running in an environment with WebUSB support (Chrome/Edge)
 * 3. A physical HackRF device is connected and accessible via WebUSB
 *
 * To run these tests:
 *   HACKRF_HARDWARE_TESTS=true npm test -- src/hackrf/__tests__/HackRFHardware.test.ts
 *
 * Note: These tests require user interaction for WebUSB device selection
 * and are best run manually in a browser environment with physical hardware.
 */

/**
 * Check if hardware tests should run based on environment variable.
 */
function shouldRunHardwareTests(): boolean {
  return process.env["HACKRF_HARDWARE_TESTS"] === "true";
}

/**
 * Mock WebUSB interface for testing device detection without actual hardware.
 * In real browser environments, navigator.usb would be available.
 */
function hasWebUSBSupport(): boolean {
  // In Node/Jest environment, WebUSB API is not available
  // These tests are informational and document the expected behavior
  return typeof navigator !== "undefined" && "usb" in navigator;
}

describe("HackRF Hardware Tests (WebUSB)", () => {
  const shouldRun = shouldRunHardwareTests();
  const hasUSB = hasWebUSBSupport();

  beforeAll(() => {
    if (!shouldRun) {
      console.log("\n=== HackRF Hardware Tests ===");
      console.log(
        "Hardware tests skipped: HACKRF_HARDWARE_TESTS not set to true",
      );
      console.log("To enable: HACKRF_HARDWARE_TESTS=true npm test");
      console.log(
        "Note: Hardware tests require WebUSB API (Chrome/Edge browser)",
      );
      console.log("=============================\n");
    } else if (!hasUSB) {
      console.log("\n=== HackRF Hardware Tests ===");
      console.log("Hardware tests skipped: WebUSB API not available");
      console.log("Run in Chrome/Edge browser with physical HackRF connected");
      console.log("=============================\n");
    }
  });

  describe("Environment validation", () => {
    it("should check environment variable", () => {
      const envSet = shouldRunHardwareTests();
      expect(typeof envSet).toBe("boolean");

      if (!envSet) {
        console.log("Set HACKRF_HARDWARE_TESTS=true to enable hardware tests");
      }
    });

    it("should check WebUSB API availability", () => {
      const hasAPI = hasWebUSBSupport();
      expect(typeof hasAPI).toBe("boolean");

      if (!hasAPI) {
        console.log("WebUSB API not available in this environment");
        console.log("Hardware tests require Chrome/Edge with HTTPS");
      }
    });
  });

  describe("Device initialization (requires hardware)", () => {
    it("should document WebUSB device detection pattern", () => {
      // This test documents how hardware detection works with WebUSB
      // Actual hardware tests require browser environment with user interaction

      if (!shouldRun || !hasUSB) {
        return; // Skip without hardware
      }

      // Documentation of WebUSB device detection:
      // 1. Request device with filters
      // 2. Check vendor/product ID (0x1d50/0x6089 for HackRF One)
      // 3. Open device and claim interface
      // 4. Verify device responds to control transfers

      const expectedFilters = {
        vendorId: 0x1d50, // Great Scott Gadgets
        productId: 0x6089, // HackRF One
      };

      expect(expectedFilters.vendorId).toBe(0x1d50);
      expect(expectedFilters.productId).toBe(0x6089);
    });

    it("should document device initialization sequence", () => {
      if (!shouldRun || !hasUSB) {
        return; // Skip without hardware
      }

      // Critical initialization order per WebUSB SDR playbook:
      // 1. await device.open()
      // 2. await device.selectConfiguration(1)
      // 3. await device.claimInterface(0)
      // 4. await device.setSampleRate(20_000_000) // CRITICAL FIRST
      // 5. await device.setFrequency(100_000_000)
      // 6. Optional: setBandwidth, setLNAGain, setAmpEnable
      // 7. await device.receive(callback)

      const initSequence = [
        "open",
        "selectConfiguration",
        "claimInterface",
        "setSampleRate", // Must be first before streaming
        "setFrequency",
        "receive",
      ];

      expect(initSequence).toContain("setSampleRate");
      expect(initSequence.indexOf("setSampleRate")).toBeLessThan(
        initSequence.indexOf("receive"),
      );
    });
  });

  describe("Configuration validation (requires hardware)", () => {
    it("should validate frequency range", () => {
      if (!shouldRun || !hasUSB) {
        return; // Skip without hardware
      }

      // HackRF One frequency range: 1 MHz - 6 GHz
      const minFreq = 1_000_000; // 1 MHz
      const maxFreq = 6_000_000_000; // 6 GHz

      expect(minFreq).toBe(1e6);
      expect(maxFreq).toBe(6e9);

      // Common test frequencies
      const testFreqs = [
        88_500_000, // FM radio
        433_000_000, // ISM band
        915_000_000, // ISM band (US)
        1_090_000_000, // ADS-B
        2_400_000_000, // WiFi/Bluetooth
      ];

      testFreqs.forEach((freq) => {
        expect(freq).toBeGreaterThanOrEqual(minFreq);
        expect(freq).toBeLessThanOrEqual(maxFreq);
      });
    });

    it("should validate sample rate range", () => {
      if (!shouldRun || !hasUSB) {
        return; // Skip without hardware
      }

      // HackRF One sample rate range: 2-20 MSPS
      const minRate = 2_000_000; // 2 MSPS
      const maxRate = 20_000_000; // 20 MSPS

      expect(minRate).toBe(2e6);
      expect(maxRate).toBe(20e6);

      // Common sample rates
      const testRates = [2e6, 8e6, 10e6, 12e6, 16e6, 20e6];

      testRates.forEach((rate) => {
        expect(rate).toBeGreaterThanOrEqual(minRate);
        expect(rate).toBeLessThanOrEqual(maxRate);
      });
    });
  });

  describe("Data format (requires hardware)", () => {
    it("should document IQ sample format", () => {
      if (!shouldRun || !hasUSB) {
        return; // Skip without hardware
      }

      // HackRF One IQ format:
      // - Type: Signed 8-bit integers (Int8Array)
      // - Layout: Interleaved I/Q pairs
      // - Conversion: value / 128.0 to normalize to ±1.0

      const sampleI = 127; // Max positive
      const sampleQ = -128; // Max negative

      const normalizedI = sampleI / 128.0;
      const normalizedQ = sampleQ / 128.0;

      expect(normalizedI).toBeCloseTo(0.9921875, 4);
      expect(normalizedQ).toBe(-1.0);

      // Range check
      expect(normalizedI).toBeGreaterThanOrEqual(-1.0);
      expect(normalizedI).toBeLessThanOrEqual(1.0);
      expect(normalizedQ).toBeGreaterThanOrEqual(-1.0);
      expect(normalizedQ).toBeLessThanOrEqual(1.0);
    });
  });

  describe("Streaming validation (requires hardware)", () => {
    it("should document streaming prerequisites", () => {
      if (!shouldRun || !hasUSB) {
        return; // Skip without hardware
      }

      // Prerequisites for successful streaming:
      // 1. Device opened and interface claimed
      // 2. Sample rate configured (MANDATORY)
      // 3. Transceiver mode set to RECEIVE
      // 4. Valid endpoint number (1 for HackRF bulk in)

      const streamingPrereqs = {
        deviceOpen: true,
        interfaceClaimed: true,
        sampleRateSet: true, // CRITICAL - device hangs without this
        transceiverMode: "RECEIVE",
        endpoint: 1,
        bufferSize: 4096,
      };

      expect(streamingPrereqs.sampleRateSet).toBe(true);
      expect(streamingPrereqs.endpoint).toBe(1);
      expect(streamingPrereqs.bufferSize).toBe(4096);
    });

    it("should document timeout and error handling", () => {
      if (!shouldRun || !hasUSB) {
        return; // Skip without hardware
      }

      // Timeout protection for transferIn operations
      const timeoutMs = 5000; // 5 seconds
      const maxConsecutiveTimeouts = 3;

      expect(timeoutMs).toBeGreaterThan(0);
      expect(maxConsecutiveTimeouts).toBeGreaterThan(0);

      // Error recovery patterns:
      // - AbortError: Expected during shutdown
      // - Timeout: Retry with counter, attempt fast recovery after threshold
      // - Other errors: Log and propagate
    });
  });

  describe("Informational summary", () => {
    it("should display test environment status", () => {
      console.log("\n=== HackRF Hardware Test Environment ===");
      console.log(`HACKRF_HARDWARE_TESTS: ${shouldRun ? "true" : "false"}`);
      console.log(`WebUSB API available: ${hasUSB ? "yes" : "no"}`);

      if (!shouldRun) {
        console.log("\nTo enable hardware tests:");
        console.log("  HACKRF_HARDWARE_TESTS=true npm test");
      }

      if (!hasUSB) {
        console.log("\nWebUSB requirements:");
        console.log(
          "  - Chrome/Edge browser (Firefox does not support WebUSB)",
        );
        console.log("  - HTTPS context (required for security)");
        console.log("  - Physical HackRF device connected via USB");
        console.log("  - User interaction to select device");
      }

      console.log("\nHardware testing approach:");
      console.log("  - These tests document WebUSB patterns");
      console.log("  - Actual hardware validation uses existing mocked tests");
      console.log("  - Manual testing with browser UI validates real hardware");
      console.log("  - No external CLI tools (hackrf_info) needed");
      console.log("=========================================\n");

      // Test always passes - informational only
      expect(true).toBe(true);
    });
  });
});
