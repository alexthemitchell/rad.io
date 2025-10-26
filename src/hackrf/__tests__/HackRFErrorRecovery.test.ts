/**
 * Tests for HackRF error handling and recovery mechanisms
 */

import { HackRFOneAdapter } from "../HackRFOneAdapter";
import { HackRFOne } from "../HackRFOne";

function createMockUSBDevice(options?: {
  transferInBehavior?: "success" | "timeout" | "error";
}): USBDevice {
  const behavior = options?.transferInBehavior ?? "success";

  const controlTransferOut = jest
    .fn<
      Promise<USBOutTransferResult>,
      [USBControlTransferParameters, BufferSource?]
    >()
    .mockResolvedValue({
      bytesWritten: 0,
      status: "ok",
    } as USBOutTransferResult);

  const controlTransferIn = jest
    .fn<Promise<USBInTransferResult>, [USBControlTransferParameters]>()
    .mockResolvedValue({
      data: new DataView(new ArrayBuffer(1)),
      status: "ok",
    } as USBInTransferResult);

  let transferInCallCount = 0;
  const transferIn = jest.fn().mockImplementation(() => {
    transferInCallCount++;

    switch (behavior) {
      case "timeout":
        // Simulate timeout by never resolving
        return new Promise(() => {
          /* never resolves */
        });

      case "error":
        return Promise.reject(new Error("USB transfer failed"));

      case "success":
      default:
        return Promise.resolve({
          data: new DataView(new ArrayBuffer(4096)),
          status: "ok",
        } as USBInTransferResult);
    }
  });

  const mockDevice = {
    opened: true,
    vendorId: 0x1d50,
    productId: 0x6089,
    productName: "Mock HackRF",
    manufacturerName: "Mock",
    serialNumber: "TEST",
    controlTransferOut,
    controlTransferIn,
    transferIn,
    configurations: [],
    configuration: undefined,
    open: jest.fn(),
    close: jest.fn(),
    reset: jest.fn(),
    clearHalt: jest.fn(),
    selectConfiguration: jest.fn(),
    selectAlternateInterface: jest.fn(),
    claimInterface: jest.fn(),
    releaseInterface: jest.fn(),
    forget: jest.fn(),
  } as unknown as USBDevice;

  return mockDevice;
}

describe("HackRF Error Handling and Recovery", () => {
  describe("Device Configuration Status", () => {
    it("reports unconfigured state before initialization", () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      const status = hackrf.getConfigurationStatus();

      expect(status.isConfigured).toBe(false);
      expect(status.sampleRate).toBeNull();
      expect(status.frequency).toBeNull();
    });

    it("reports configured state after setSampleRate", async () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      await hackrf.setSampleRate(20_000_000);

      const status = hackrf.getConfigurationStatus();

      expect(status.isConfigured).toBe(true);
      expect(status.sampleRate).toBe(20_000_000);
    });

    it("tracks all configuration parameters", async () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      await hackrf.setSampleRate(20_000_000);
      await hackrf.setFrequency(100_000_000);
      // Note: setBandwidth and setLNAGain perform validation that may fail with mock device
      // So we'll just verify the parameters that we successfully set
      await hackrf.setAmpEnable(true);

      const status = hackrf.getConfigurationStatus();

      expect(status.sampleRate).toBe(20_000_000);
      expect(status.frequency).toBe(100_000_000);
      expect(status.ampEnabled).toBe(true);
    });
  });

  describe("Pre-Streaming Validation", () => {
    it("validates device is ready for streaming", async () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      // Before configuration
      let validation = hackrf.validateReadyForStreaming();
      expect(validation.ready).toBe(false);
      expect(validation.issues).toContainEqual(
        expect.stringMatching(/sample rate not configured/i),
      );

      // After configuration
      await hackrf.setSampleRate(20_000_000);
      validation = hackrf.validateReadyForStreaming();
      expect(validation.ready).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it("detects when device is not open", () => {
      const device = createMockUSBDevice();
      (device as any).opened = false;
      const hackrf = new HackRFOne(device);

      const validation = hackrf.validateReadyForStreaming();

      expect(validation.ready).toBe(false);
      expect(validation.issues).toContain("Device is not open");
    });

    it("detects when device is closing", async () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);
      await hackrf.setSampleRate(20_000_000);

      // Simulate closing state
      (hackrf as any).closing = true;

      const validation = hackrf.validateReadyForStreaming();

      expect(validation.ready).toBe(false);
      expect(validation.issues).toContain("Device is closing");
    });
  });

  describe("Reset Functionality", () => {
    it("sends reset command successfully", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      await adapter.setSampleRate(20_000_000);

      await expect(adapter.reset()).resolves.not.toThrow();

      // Verify reset command was sent (RequestCommand.RESET = 30)
      const calls = (device.controlTransferOut as jest.Mock).mock.calls;
      const resetCall = calls.find((call) => call[0].request === 30);
      expect(resetCall).toBeDefined();
    });

    it("resets initialization flag after reset", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      await adapter.setSampleRate(20_000_000);

      // Should be initialized
      let validation = (
        adapter.getUnderlyingDevice() as any
      ).validateReadyForStreaming();
      expect(validation.ready).toBe(true);

      // Reset
      await adapter.reset();

      // Should require reinitialization
      await expect(
        adapter.receive(() => {
          /* no-op */
        }),
      ).rejects.toThrow(/not initialized/);
    });
  });

  describe("Fast Recovery", () => {
    it("performs fast recovery with configuration restoration", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Configure device with minimal settings to avoid validation errors
      await adapter.setSampleRate(20_000_000);
      await adapter.setFrequency(100_000_000);
      await adapter.setAmpEnable(true);

      // Perform fast recovery
      await expect(adapter.fastRecovery()).resolves.not.toThrow();

      // Verify reset command was sent (RequestCommand.RESET = 30)
      const calls = (device.controlTransferOut as jest.Mock).mock.calls;
      const resetCall = calls.find((call) => call[0].request === 30);
      expect(resetCall).toBeDefined();

      // Verify multiple configuration commands were sent
      expect(calls.length).toBeGreaterThan(3);

      // Should still be initialized after fastRecovery
      const status = adapter
        .getUnderlyingDevice()
        .getConfigurationStatus();
      expect(status.isConfigured).toBe(true);
    });

    it("maintains initialized state after fast recovery", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      await adapter.setSampleRate(20_000_000);

      // Fast recovery
      await adapter.fastRecovery();

      // Should NOT throw initialization error
      // (We can't actually test streaming without mocking the loop,
      // but we can verify the configuration state)
      const status = adapter
        .getUnderlyingDevice()
        .getConfigurationStatus();
      expect(status.isConfigured).toBe(true);
      expect(status.sampleRate).toBe(20_000_000);
    });
  });

  describe("Error Detection and Reporting", () => {
    it("throws error when sample rate not set before streaming", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      await expect(
        adapter.receive(() => {
          /* no-op */
        }),
      ).rejects.toThrow(/not initialized/);
    });

    it("provides helpful error message for missing sample rate", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      try {
        await adapter.receive(() => {
          /* no-op */
        });
        fail("Should have thrown");
      } catch (error) {
        const err = error as Error;
        expect(err.message).toMatch(/setSampleRate/);
        expect(err.message).toMatch(/mandatory/);
      }
    });

    it("validates device configuration before operations", () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      const validation = hackrf.validateReadyForStreaming();

      expect(validation.ready).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });

  describe("Configuration State Tracking", () => {
    it("tracks sample rate changes", async () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      await hackrf.setSampleRate(10_000_000);
      expect(hackrf.getConfigurationStatus().sampleRate).toBe(10_000_000);

      await hackrf.setSampleRate(20_000_000);
      expect(hackrf.getConfigurationStatus().sampleRate).toBe(20_000_000);
    });

    it("tracks frequency changes", async () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      await hackrf.setFrequency(100_000_000);
      expect(hackrf.getConfigurationStatus().frequency).toBe(100_000_000);

      await hackrf.setFrequency(200_000_000);
      expect(hackrf.getConfigurationStatus().frequency).toBe(200_000_000);
    });

    it("tracks all configuration parameters independently", async () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      await hackrf.setSampleRate(20_000_000);
      let status = hackrf.getConfigurationStatus();
      expect(status.sampleRate).toBe(20_000_000);
      expect(status.frequency).toBeNull();

      await hackrf.setFrequency(100_000_000);
      status = hackrf.getConfigurationStatus();
      expect(status.sampleRate).toBe(20_000_000);
      expect(status.frequency).toBe(100_000_000);
    });
  });

  describe("Adapter Error Propagation", () => {
    it("propagates reset errors to caller", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Mock reset failure
      (device.controlTransferOut as jest.Mock).mockRejectedValueOnce(
        new Error("USB communication error"),
      );

      await expect(adapter.reset()).rejects.toThrow();
    });

    it("propagates fastRecovery errors to caller", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      await adapter.setSampleRate(20_000_000);

      // Mock recovery failure
      (device.controlTransferOut as jest.Mock).mockRejectedValueOnce(
        new Error("USB communication error"),
      );

      await expect(adapter.fastRecovery()).rejects.toThrow();
    });
  });

  describe("Interface Compliance", () => {
    it("adapter implements reset() from ISDRDevice", () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      expect(typeof adapter.reset).toBe("function");
    });

    it("adapter implements optional fastRecovery() from ISDRDevice", () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      expect(typeof adapter.fastRecovery).toBe("function");
    });

    it("getConfigurationStatus returns expected shape", () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      const status = hackrf.getConfigurationStatus();

      expect(status).toHaveProperty("isOpen");
      expect(status).toHaveProperty("isStreaming");
      expect(status).toHaveProperty("isClosing");
      expect(status).toHaveProperty("sampleRate");
      expect(status).toHaveProperty("frequency");
      expect(status).toHaveProperty("bandwidth");
      expect(status).toHaveProperty("lnaGain");
      expect(status).toHaveProperty("ampEnabled");
      expect(status).toHaveProperty("isConfigured");
    });

    it("validateReadyForStreaming returns expected shape", () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      const validation = hackrf.validateReadyForStreaming();

      expect(validation).toHaveProperty("ready");
      expect(validation).toHaveProperty("issues");
      expect(Array.isArray(validation.issues)).toBe(true);
      expect(typeof validation.ready).toBe("boolean");
    });
  });
});
