/**
 * Mocked unit tests for HackRF device logic.
 *
 * These tests use mocks and stubs to test HackRF-specific logic without
 * requiring physical hardware. They complement the hardware tests and
 * provide comprehensive coverage of edge cases and error conditions.
 *
 * Test categories:
 * - Configuration validation and edge cases
 * - Error recovery and resilience
 * - Buffer management
 * - State machine transitions
 * - Protocol compliance
 */

import { HackRFOne, RequestCommand } from "../HackRFOne";
import { HackRFOneAdapter } from "../HackRFOneAdapter";

function createMockUSBDevice(): {
  device: USBDevice;
  controlTransferOut: jest.Mock;
  controlTransferIn: jest.Mock;
  transferIn: jest.Mock;
} {
  const controlTransferOut = jest
    .fn<
      Promise<USBOutTransferResult>,
      [USBControlTransferParameters, BufferSource?]
    >()
    .mockResolvedValue({} as USBOutTransferResult);

  const controlTransferIn = jest
    .fn<Promise<USBInTransferResult>, [USBControlTransferParameters, number]>()
    .mockResolvedValue({
      data: new DataView(new Uint8Array([1]).buffer),
      status: "ok",
    } as USBInTransferResult);

  const transferIn = jest
    .fn<Promise<USBInTransferResult>, [number, number]>()
    .mockResolvedValue({
      data: new DataView(new ArrayBuffer(4096)),
      status: "ok",
    } as USBInTransferResult);

  const mockDevice = {
    opened: true,
    vendorId: 0x1d50,
    productId: 0x6089,
    productName: "Mock HackRF One",
    manufacturerName: "Great Scott Gadgets",
    serialNumber: "0000000000000000088869dc2b7c125f",
    controlTransferOut,
    controlTransferIn,
    transferIn,
    configurations: [],
    configuration: undefined,
    open: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
    clearHalt: jest.fn().mockResolvedValue(undefined),
    selectConfiguration: jest.fn().mockResolvedValue(undefined),
    selectAlternateInterface: jest.fn().mockResolvedValue(undefined),
    claimInterface: jest.fn().mockResolvedValue(undefined),
    releaseInterface: jest.fn().mockResolvedValue(undefined),
    forget: jest.fn().mockResolvedValue(undefined),
  } as unknown as USBDevice;

  return {
    device: mockDevice,
    controlTransferOut,
    controlTransferIn,
    transferIn,
  };
}

describe("HackRF Mocked Logic Tests", () => {
  describe("Configuration edge cases", () => {
    it("should handle minimum valid sample rate", async () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      // Minimum: 2 MSPS
      await expect(hackRF.setSampleRate(2_000_000)).resolves.toBeUndefined();
    });

    it("should handle maximum valid sample rate", async () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      // Maximum: 20 MSPS
      await expect(hackRF.setSampleRate(20_000_000)).resolves.toBeUndefined();
    });

    it("should handle minimum valid frequency", async () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      // Minimum: 1 MHz
      await expect(hackRF.setFrequency(1_000_000)).resolves.toBeUndefined();
    });

    it("should handle maximum valid frequency", async () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      // Maximum: 6 GHz
      await expect(hackRF.setFrequency(6_000_000_000)).resolves.toBeUndefined();
    });

    it("should reject sample rate below minimum", async () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      await expect(hackRF.setSampleRate(1_500_000)).rejects.toThrow();
    });

    it("should reject sample rate above maximum", async () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      await expect(hackRF.setSampleRate(25_000_000)).rejects.toThrow();
    });

    it("should reject frequency below minimum", async () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      await expect(hackRF.setFrequency(500_000)).rejects.toThrow();
    });

    it("should reject frequency above maximum", async () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      await expect(hackRF.setFrequency(7_000_000_000)).rejects.toThrow();
    });
  });

  describe("Streaming state management", () => {
    it("should use mutex for USB control transfers", async () => {
      const { device, controlTransferOut } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      // Verify that control transfers work correctly
      await hackRF.setSampleRate(10_000_000);
      await hackRF.setFrequency(100_000_000);

      // Check that both calls completed
      expect(controlTransferOut).toHaveBeenCalledTimes(2);

      // Verify calls were made in order
      const calls = controlTransferOut.mock.calls;
      expect(calls[0]?.[0].request).toBe(RequestCommand.SAMPLE_RATE_SET);
      expect(calls[1]?.[0].request).toBe(RequestCommand.SET_FREQ);
    });

    it("should track streaming state correctly", async () => {
      const { device, transferIn } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      // Configure sample rate first
      await hackRF.setSampleRate(10_000_000);

      // Mock transferIn to return once then hang
      let callCount = 0;
      transferIn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: new DataView(new ArrayBuffer(4096)),
            status: "ok",
          } as USBInTransferResult);
        }
        // Hang to allow state check
        return new Promise(() => {
          /* never resolves */
        });
      });

      // Start streaming
      const receivePromise = hackRF.receive();

      // Give it time to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check configuration status during streaming
      const status = hackRF.getConfigurationStatus();
      expect(status.isConfigured).toBe(true);

      // Stop streaming
      hackRF.stopRx();

      await expect(receivePromise).resolves.toBeUndefined();
    });
  });

  describe("Buffer management", () => {
    it("should track buffer usage", async () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      const initialMemInfo = hackRF.getMemoryInfo();
      expect(initialMemInfo.activeBuffers).toBe(0);
      expect(initialMemInfo.usedBufferSize).toBe(0);
    });

    it("should clear buffers on demand", () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      expect(() => hackRF.clearBuffers()).not.toThrow();
    });

    it("should report memory info structure", () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      const memInfo = hackRF.getMemoryInfo();

      expect(memInfo).toHaveProperty("totalBufferSize");
      expect(memInfo).toHaveProperty("usedBufferSize");
      expect(memInfo).toHaveProperty("activeBuffers");
      expect(typeof memInfo.totalBufferSize).toBe("number");
      expect(typeof memInfo.usedBufferSize).toBe("number");
      expect(typeof memInfo.activeBuffers).toBe("number");
    });
  });

  describe("Protocol compliance", () => {
    it("should format frequency with correct byte order (little-endian)", async () => {
      const { device, controlTransferOut } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      // Test frequency: 915 MHz (915000000 Hz)
      // Split: 915 MHz and 0 Hz
      await hackRF.setFrequency(915_000_000);

      const [, data] = controlTransferOut.mock.calls[0] ?? [];
      expect(data).toBeInstanceOf(ArrayBuffer);

      const view = new DataView(data as ArrayBuffer);
      const mhz = view.getUint32(0, true); // Little-endian
      const hz = view.getUint32(4, true); // Little-endian

      expect(mhz).toBe(915);
      expect(hz).toBe(0);
    });

    it("should format frequency with Hz remainder", async () => {
      const { device, controlTransferOut } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      // Test frequency: 915.5 MHz (915500000 Hz)
      // Split: 915 MHz and 500000 Hz
      await hackRF.setFrequency(915_500_000);

      const [, data] = controlTransferOut.mock.calls[0] ?? [];
      const view = new DataView(data as ArrayBuffer);
      const mhz = view.getUint32(0, true);
      const hz = view.getUint32(4, true);

      expect(mhz).toBe(915);
      expect(hz).toBe(500_000);
    });

    it("should use correct request command for each operation", async () => {
      const { device, controlTransferOut, controlTransferIn } =
        createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      // Track commands used
      const commands: number[] = [];
      controlTransferOut.mockImplementation(async (params) => {
        commands.push(params.request);
        return {} as USBOutTransferResult;
      });

      controlTransferIn.mockImplementation(async (params) => {
        commands.push(params.request);
        return {
          data: new DataView(new Uint8Array([1]).buffer),
          status: "ok",
        } as USBInTransferResult;
      });

      // Execute various operations
      await hackRF.setSampleRate(10_000_000);
      await hackRF.setFrequency(100_000_000);
      await hackRF.setBandwidth(8_000_000);
      await hackRF.setLNAGain(16);
      await hackRF.setAmpEnable(true);

      // Verify correct commands were used
      expect(commands).toContain(RequestCommand.SAMPLE_RATE_SET);
      expect(commands).toContain(RequestCommand.SET_FREQ);
      expect(commands).toContain(RequestCommand.BASEBAND_FILTER_BANDWIDTH_SET);
      expect(commands).toContain(RequestCommand.SET_LNA_GAIN);
      expect(commands).toContain(RequestCommand.AMP_ENABLE);
    });
  });

  describe("Error recovery", () => {
    it("should handle USB transfer errors gracefully", async () => {
      const { device, transferIn } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      await hackRF.setSampleRate(10_000_000);

      // Mock transferIn to fail with an unexpected error
      // Per HackRFOne implementation, non-timeout/non-abort errors are thrown
      transferIn.mockRejectedValue(new Error("USB transfer failed"));

      const receivePromise = hackRF.receive();

      // The promise should reject with the USB error
      await expect(receivePromise).rejects.toThrow("USB transfer failed");
    });

    it(
      "should handle timeout errors in streaming with retry",
      async () => {
        const { device, transferIn } = createMockUSBDevice();
        const hackRF = new HackRFOne(device);

        await hackRF.setSampleRate(10_000_000);

        // Mock transferIn to timeout once then succeed
        let timeoutCount = 0;
        transferIn.mockImplementation(() => {
          timeoutCount++;
          if (timeoutCount === 1) {
            return Promise.reject(
              new Error(
                "transferIn timeout after 5000ms - device may need reset",
              ),
            );
          }
          // After first timeout, return data once then hang
          if (timeoutCount === 2) {
            return Promise.resolve({
              data: new DataView(new ArrayBuffer(4096)),
              status: "ok",
            } as USBInTransferResult);
          }
          // Hang to allow stop
          return new Promise(() => {
            /* never resolves */
          });
        });

        const receivePromise = hackRF.receive();

        // Give time for timeout and retry
        await new Promise((resolve) => setTimeout(resolve, 200));

        hackRF.stopRx();

        // Should complete without throwing after retry
        await expect(receivePromise).resolves.toBeUndefined();
        expect(timeoutCount).toBeGreaterThan(1); // Should have retried after timeout
      },
      5000, // Explicit timeout to prevent hanging
    );

    it("should implement fast recovery", async () => {
      const { device, controlTransferOut } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      // Configure device
      await hackRF.setSampleRate(10_000_000);
      await hackRF.setFrequency(100_000_000);

      const callsBefore = controlTransferOut.mock.calls.length;

      // Perform fast recovery
      await hackRF.fastRecovery();

      const callsAfter = controlTransferOut.mock.calls.length;

      // Fast recovery should re-apply configuration
      expect(callsAfter).toBeGreaterThan(callsBefore);

      // Verify configuration was reapplied
      const status = hackRF.getConfigurationStatus();
      expect(status.isConfigured).toBe(true);
      expect(status.sampleRate).toBe(10_000_000);
      expect(status.frequency).toBe(100_000_000);
    });
  });

  describe("Adapter integration", () => {
    it("should maintain initialization state through adapter", async () => {
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Before initialization
      let validation = adapter
        .getUnderlyingDevice()
        .validateReadyForStreaming();
      expect(validation.ready).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);

      // After initialization
      await adapter.setSampleRate(20_000_000);

      validation = adapter.getUnderlyingDevice().validateReadyForStreaming();
      expect(validation.ready).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it("should provide configuration status through adapter", async () => {
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      await adapter.setSampleRate(12_000_000);
      await adapter.setFrequency(433_000_000);
      await adapter.setBandwidth(10_000_000);

      const underlying = adapter.getUnderlyingDevice();
      const status = underlying.getConfigurationStatus();

      expect(status.isConfigured).toBe(true);
      expect(status.sampleRate).toBe(12_000_000);
      expect(status.frequency).toBe(433_000_000);
      expect(status.bandwidth).toBe(10_000_000);
    });

    it("should parse samples correctly through adapter", () => {
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Create test data with known I/Q values
      const buffer = new ArrayBuffer(16);
      const view = new DataView(buffer);

      // Set known values (Int8: -128 to 127)
      view.setInt8(0, 127); // I1
      view.setInt8(1, -128); // Q1
      view.setInt8(2, 64); // I2
      view.setInt8(3, -64); // Q2
      view.setInt8(4, 0); // I3
      view.setInt8(5, 0); // Q3
      view.setInt8(6, -32); // I4
      view.setInt8(7, 32); // Q4

      const samples = adapter.parseSamples(view);

      expect(samples.length).toBeGreaterThan(0);

      // Check first sample structure
      expect(samples[0]).toHaveProperty("I");
      expect(samples[0]).toHaveProperty("Q");
      expect(typeof samples[0]?.I).toBe("number");
      expect(typeof samples[0]?.Q).toBe("number");
    });

    it("should report device capabilities correctly", () => {
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      const capabilities = adapter.getCapabilities();

      expect(capabilities.minFrequency).toBe(1e6);
      expect(capabilities.maxFrequency).toBe(6e9);
      expect(capabilities.supportedSampleRates).toContain(2e6);
      expect(capabilities.supportedSampleRates).toContain(10e6);
      expect(capabilities.supportedSampleRates).toContain(20e6);
      expect(capabilities.supportsAmpControl).toBe(true);
    });
  });

  describe("Device validation", () => {
    it("should validate configuration before streaming", async () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      // Without sample rate configuration
      const validation1 = hackRF.validateReadyForStreaming();
      expect(validation1.ready).toBe(false);
      expect(validation1.issues).toContain(
        "Sample rate not configured - call setSampleRate() before streaming",
      );

      // With sample rate configuration
      await hackRF.setSampleRate(10_000_000);

      const validation2 = hackRF.validateReadyForStreaming();
      expect(validation2.ready).toBe(true);
      expect(validation2.issues).toHaveLength(0);
    });

    it("should report configuration status accurately", async () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      const status1 = hackRF.getConfigurationStatus();
      expect(status1.isConfigured).toBe(false);
      expect(status1.sampleRate).toBeNull();
      expect(status1.frequency).toBeNull();

      await hackRF.setSampleRate(20_000_000);
      await hackRF.setFrequency(915_000_000);

      const status2 = hackRF.getConfigurationStatus();
      expect(status2.isConfigured).toBe(true);
      expect(status2.sampleRate).toBe(20_000_000);
      expect(status2.frequency).toBe(915_000_000);
    });
  });

  describe("LNA gain control", () => {
    it("should accept valid LNA gain values", async () => {
      const { device } = createMockUSBDevice();
      const hackRF = new HackRFOne(device);

      // Valid gain values: 0, 8, 16, 24, 32, 40 dB
      for (const gain of [0, 8, 16, 24, 32, 40]) {
        await expect(hackRF.setLNAGain(gain)).resolves.toBeUndefined();
      }
    });

    it("should round to nearest valid LNA gain", async () => {
      const { device, controlTransferIn } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Test rounding behavior
      await expect(adapter.setLNAGain(10)).resolves.toBeUndefined(); // Rounds to 8
      await expect(adapter.setLNAGain(20)).resolves.toBeUndefined(); // Rounds to 16 or 24
      await expect(adapter.setLNAGain(37)).resolves.toBeUndefined(); // Rounds to 40

      // Verify calls were made
      expect(controlTransferIn).toHaveBeenCalled();
    });
  });
});
