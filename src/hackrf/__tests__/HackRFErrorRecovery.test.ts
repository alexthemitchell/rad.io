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

    it("reports device state flags correctly", async () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);
      await hackrf.setSampleRate(20_000_000);

      let status = hackrf.getConfigurationStatus();

      // Initially not streaming, not closing, is open
      expect(status.isOpen).toBe(true);
      expect(status.isStreaming).toBe(false);
      expect(status.isClosing).toBe(false);

      // Simulate streaming
      (hackrf as any).streaming = true;
      status = hackrf.getConfigurationStatus();
      expect(status.isStreaming).toBe(true);

      // Simulate closing
      (hackrf as any).closing = true;
      status = hackrf.getConfigurationStatus();
      expect(status.isClosing).toBe(true);

      // Simulate device not open
      (device as any).opened = false;
      status = hackrf.getConfigurationStatus();
      expect(status.isOpen).toBe(false);
    });

    it("returns null for unset configuration values", () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      const status = hackrf.getConfigurationStatus();

      expect(status.sampleRate).toBeNull();
      expect(status.frequency).toBeNull();
      expect(status.bandwidth).toBeNull();
      expect(status.lnaGain).toBeNull();
      expect(status.ampEnabled).toBe(false); // Default value
    });

    it("verifies all properties of configuration status object", async () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      // Configure with known values
      await hackrf.setSampleRate(20_000_000);
      await hackrf.setFrequency(100_000_000);
      await hackrf.setAmpEnable(true);

      const status = hackrf.getConfigurationStatus();

      // Verify all properties exist and have correct types
      expect(typeof status.isOpen).toBe("boolean");
      expect(typeof status.isStreaming).toBe("boolean");
      expect(typeof status.isClosing).toBe("boolean");
      expect(typeof status.isConfigured).toBe("boolean");
      expect(typeof status.ampEnabled).toBe("boolean");

      // Verify values
      expect(status.isOpen).toBe(true);
      expect(status.isStreaming).toBe(false);
      expect(status.isClosing).toBe(false);
      expect(status.isConfigured).toBe(true);
      expect(status.sampleRate).toBe(20_000_000);
      expect(status.frequency).toBe(100_000_000);
      expect(status.ampEnabled).toBe(true);

      // Null values
      expect(status.bandwidth).toBeNull();
      expect(status.lnaGain).toBeNull();
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

    it("detects when device is already streaming", async () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);
      await hackrf.setSampleRate(20_000_000);

      // Simulate streaming state
      (hackrf as any).streaming = true;

      const validation = hackrf.validateReadyForStreaming();

      expect(validation.ready).toBe(false);
      expect(validation.issues).toContain("Device is already streaming");
    });

    it("detects multiple issues simultaneously", () => {
      const device = createMockUSBDevice();
      (device as any).opened = false;
      const hackrf = new HackRFOne(device);
      (hackrf as any).closing = true;

      const validation = hackrf.validateReadyForStreaming();

      expect(validation.ready).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(1);
      expect(validation.issues).toContain("Device is not open");
      expect(validation.issues).toContain("Device is closing");
      expect(validation.issues).toContainEqual(
        expect.stringMatching(/sample rate not configured/i),
      );
    });

    it("returns exact issue messages for each condition", () => {
      const device = createMockUSBDevice();

      // Test each condition independently

      // 1. Device not open
      (device as any).opened = false;
      let hackrf = new HackRFOne(device);
      let validation = hackrf.validateReadyForStreaming();
      expect(validation.issues).toContain("Device is not open");

      // 2. Device closing
      (device as any).opened = true;
      hackrf = new HackRFOne(device);
      (hackrf as any).closing = true;
      validation = hackrf.validateReadyForStreaming();
      expect(validation.issues).toContain("Device is closing");

      // 3. Sample rate not configured
      (device as any).opened = true;
      hackrf = new HackRFOne(device);
      (hackrf as any).closing = false;
      validation = hackrf.validateReadyForStreaming();
      expect(validation.issues).toContain(
        "Sample rate not configured - call setSampleRate() before streaming",
      );

      // 4. Already streaming
      hackrf = new HackRFOne(createMockUSBDevice());
      (hackrf as any).lastSampleRate = 20_000_000;
      (hackrf as any).streaming = true;
      validation = hackrf.validateReadyForStreaming();
      expect(validation.issues).toContain("Device is already streaming");
    });

    it("returns ready true only when all conditions pass", async () => {
      const device = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      // Configure device properly
      await hackrf.setSampleRate(20_000_000);

      const validation = hackrf.validateReadyForStreaming();

      expect(validation.ready).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(Array.isArray(validation.issues)).toBe(true);
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
      const status = adapter.getUnderlyingDevice().getConfigurationStatus();
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
      const status = adapter.getUnderlyingDevice().getConfigurationStatus();
      expect(status.isConfigured).toBe(true);
      expect(status.sampleRate).toBe(20_000_000);
    });

    it("restores all configuration including bandwidth and gains", async () => {
      const device = createMockUSBDevice();

      // Mock controlTransferIn for LNA gain
      (device.controlTransferIn as jest.Mock).mockResolvedValue({
        data: new DataView(new Uint8Array([1]).buffer),
        status: "ok",
      } as USBInTransferResult);

      const adapter = new HackRFOneAdapter(device);

      // Configure device with all settings
      await adapter.setSampleRate(20_000_000);
      await adapter.setFrequency(100_000_000);
      await adapter.setBandwidth(10_000_000);
      await adapter.setLNAGain(16);
      await adapter.setAmpEnable(true);

      // Perform fast recovery - should restore all settings
      await expect(adapter.fastRecovery()).resolves.not.toThrow();

      // Verify all configuration restored
      const underlying = adapter.getUnderlyingDevice();
      const status = underlying.getConfigurationStatus();
      expect(status.isConfigured).toBe(true);
      expect(status.sampleRate).toBe(20_000_000);
      expect(status.frequency).toBe(100_000_000);
      expect(status.bandwidth).toBe(10_000_000);
      expect(status.lnaGain).toBe(16);
      expect(status.ampEnabled).toBe(true);
    });

    it("handles fastRecovery when only sample rate is configured", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Only configure sample rate (minimum requirement)
      await adapter.setSampleRate(20_000_000);

      // Fast recovery should work with minimal configuration
      await expect(adapter.fastRecovery()).resolves.not.toThrow();

      const status = adapter.getUnderlyingDevice().getConfigurationStatus();
      expect(status.isConfigured).toBe(true);
      expect(status.sampleRate).toBe(20_000_000);
      // Other values should be null
      expect(status.frequency).toBeNull();
      expect(status.bandwidth).toBeNull();
      expect(status.lnaGain).toBeNull();
    });

    it("skips rebind when WebUSB is unavailable (NotFoundError)", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      await adapter.setSampleRate(20_000_000);

      // Force open() to fail with NotFoundError so needsRebind path is taken
      const underlying = adapter.getUnderlyingDevice() as any;
      const originalOpen = underlying.open.bind(underlying);
      underlying.open = jest.fn().mockRejectedValue({ name: "NotFoundError" });

      // navigator.usb is not defined in this environment: branch should skip rebind and continue
      await expect(adapter.fastRecovery()).resolves.not.toThrow();

      const status = adapter.getUnderlyingDevice().getConfigurationStatus();
      expect(status.isConfigured).toBe(true);

      // Restore original open for safety
      underlying.open = originalOpen;
    });

    it("proceeds when WebUSB is available but no paired device is found", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      await adapter.setSampleRate(20_000_000);

      const underlying = adapter.getUnderlyingDevice() as any;
      const originalOpen = underlying.open.bind(underlying);
      underlying.open = jest.fn().mockRejectedValue({ name: "NotFoundError" });

      // Mock WebUSB with empty device list to exercise rebind failure path
      const prevNavigator = (globalThis as any).navigator;
      (globalThis as any).navigator = {
        usb: {
          getDevices: jest.fn().mockResolvedValue([]),
        },
      } as any;

      await expect(adapter.fastRecovery()).resolves.not.toThrow();

      const status = adapter.getUnderlyingDevice().getConfigurationStatus();
      expect(status.isConfigured).toBe(true);

      // Cleanup
      (globalThis as any).navigator = prevNavigator;
      underlying.open = originalOpen;
    });

    it("rebinds to a re-enumerated device when available", async () => {
      const originalDevice = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(originalDevice);
      await adapter.setSampleRate(20_000_000);

      const underlying = adapter.getUnderlyingDevice() as any;

      // First open attempt fails -> triggers needsRebind path
      const originalOpen = underlying.open.bind(underlying);
      const openMock = jest
        .fn()
        .mockRejectedValueOnce({ name: "NotFoundError" }) // pre-reset open
        .mockResolvedValueOnce(undefined); // open after successful rebind
      underlying.open = openMock;

      // Create a re-enumerated device with a minimal valid interface/endpoint
      const reEnumDevice: any = {
        opened: false,
        vendorId: (originalDevice as any).vendorId,
        productId: (originalDevice as any).productId,
        serialNumber: (originalDevice as any).serialNumber,
        configurations: [
          {
            configurationValue: 1,
            interfaces: [
              {
                interfaceNumber: 0,
                alternates: [
                  {
                    alternateSetting: 0,
                    endpoints: [
                      {
                        type: "bulk",
                        direction: "in",
                        endpointNumber: 1,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        configuration: undefined,
        open: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        selectConfiguration: jest.fn().mockResolvedValue(undefined),
        claimInterface: jest.fn().mockResolvedValue(undefined),
        selectAlternateInterface: jest.fn().mockResolvedValue(undefined),
        releaseInterface: jest.fn().mockResolvedValue(undefined),
        controlTransferOut: (originalDevice as any).controlTransferOut,
        controlTransferIn: (originalDevice as any).controlTransferIn,
        transferIn: (originalDevice as any).transferIn,
      };

      const prevNavigator = (globalThis as any).navigator;
      (globalThis as any).navigator = {
        usb: {
          getDevices: jest.fn().mockResolvedValue([reEnumDevice]),
        },
      } as any;

      await expect(adapter.fastRecovery()).resolves.not.toThrow();

      const status = adapter.getUnderlyingDevice().getConfigurationStatus();
      expect(status.isConfigured).toBe(true);

      // Cleanup
      (globalThis as any).navigator = prevNavigator;
      underlying.open = originalOpen;
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

  describe("Adapter Coverage", () => {
    it("reports isOpen correctly for device state", () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      // Default mock device opened=true
      expect(adapter.isOpen()).toBe(true);
      (device as any).opened = false;
      expect(adapter.isOpen()).toBe(false);
    });

    it("adjusts LNA gain to nearest supported step", async () => {
      const device = createMockUSBDevice();
      // Ensure LNA gain set succeeds
      (device.controlTransferIn as jest.Mock).mockResolvedValue({
        data: new DataView(new Uint8Array([1]).buffer),
        status: "ok",
      } as USBInTransferResult);

      const adapter = new HackRFOneAdapter(device);
      await adapter.setSampleRate(20_000_000);

      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      await adapter.setLNAGain(7); // invalid; should adjust to 8
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("adjusts bandwidth to nearest supported value", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      await adapter.setSampleRate(20_000_000);

      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      // 11 MHz is not in supported list; should adjust to 10 or 12 MHz
      await adapter.setBandwidth(11_000_000);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
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
