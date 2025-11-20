/**
 * Tests for HackRF error handling and recovery mechanisms
 */

import { HackRFOneAdapter } from "../HackRFOneAdapter";
import { HackRFOne } from "../HackRFOne";
import { Recovery } from "../core/recovery";
import { createMockUSBDevice } from "../test-helpers/mockUSBDevice";

describe("HackRF Error Handling and Recovery", () => {
  describe("Device Configuration Status", () => {
    it("reports unconfigured state before initialization", () => {
      const { device } = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      const status = hackrf.getConfigurationStatus();

      expect(status.isConfigured).toBe(false);
      expect(status.sampleRate).toBeNull();
      expect(status.frequency).toBeNull();
    });

    it("reports configured state after setSampleRate", async () => {
      const { device } = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      await hackrf.setSampleRate(20_000_000);

      const status = hackrf.getConfigurationStatus();

      expect(status.isConfigured).toBe(true);
      expect(status.sampleRate).toBe(20_000_000);
    });

    it("tracks all configuration parameters", async () => {
      const { device } = createMockUSBDevice();
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

    it("reflects streaming state changes during receive lifecycle", async () => {
      const { device } = createMockUSBDevice();
      const hackrf = new HackRFOne(device);
      await hackrf.setSampleRate(20_000_000);

      const receivePromise = hackrf.receive();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(hackrf.getConfigurationStatus().isStreaming).toBe(true);

      await hackrf.stopRx();
      await receivePromise;

      expect(hackrf.getConfigurationStatus().isStreaming).toBe(false);
    });

    it("returns null for unset configuration values", () => {
      const { device } = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      const status = hackrf.getConfigurationStatus();

      expect(status.sampleRate).toBeNull();
      expect(status.frequency).toBeNull();
      expect(status.bandwidth).toBeNull();
      expect(status.lnaGain).toBeNull();
      expect(status.ampEnabled).toBe(false); // Default value
    });

    it("verifies all properties of configuration status object", async () => {
      const { device } = createMockUSBDevice();
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
      const { device } = createMockUSBDevice();
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

    it("detects when device is not open after close", async () => {
      const { device } = createMockUSBDevice();
      const hackrf = new HackRFOne(device);
      await hackrf.setSampleRate(20_000_000);

      await hackrf.close();

      const validation = hackrf.validateReadyForStreaming();

      expect(validation.ready).toBe(false);
      expect(validation.issues).toContain("Device is not open");
    });

    it("detects when device is closing during close lifecycle", async () => {
      const { device } = createMockUSBDevice();
      const hackrf = new HackRFOne(device);
      await hackrf.setSampleRate(20_000_000);

      let resolveClose: (() => void) | null = null;
      (device.close as jest.Mock).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveClose = () => {
              (device as { opened: boolean }).opened = false;
              resolve();
            };
          }),
      );

      const closePromise = hackrf.close();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const validation = hackrf.validateReadyForStreaming();

      expect(validation.ready).toBe(false);
      expect(validation.issues).toContain("Device is closing");

      if (resolveClose) {
        (resolveClose as () => void)();
      }
      await closePromise;
    });

    it("detects when device is already streaming", async () => {
      const { device } = createMockUSBDevice();
      const hackrf = new HackRFOne(device);
      await hackrf.setSampleRate(20_000_000);

      const receivePromise = hackrf.receive();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const validation = hackrf.validateReadyForStreaming();

      expect(validation.ready).toBe(false);
      expect(validation.issues).toContain("Device is already streaming");

      await receivePromise;
    });

    it("reports consistent validation output shape", async () => {
      const { device } = createMockUSBDevice();
      const hackrf = new HackRFOne(device);
      await hackrf.setSampleRate(20_000_000);

      const validation = hackrf.validateReadyForStreaming();

      expect(validation).toHaveProperty("ready");
      expect(Array.isArray(validation.issues)).toBe(true);
    });

    it("returns ready true only when all conditions pass", async () => {
      const { device } = createMockUSBDevice();
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
    it("clears state without vendor reset command", async () => {
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      await adapter.setSampleRate(20_000_000);

      await expect(adapter.reset()).resolves.not.toThrow();
      // Verify no vendor RESET command (30) was sent
      const calls = (device.controlTransferOut as jest.Mock).mock.calls;
      const resetCall = calls.find((call) => call[0].request === 30);
      expect(resetCall).toBeUndefined();
    });

    it("preserves sample rate configuration after reset", async () => {
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      await adapter.setSampleRate(20_000_000);

      // Reset
      await adapter.reset();

      // Should still be configured (intentional behavior to support fast recovery)
      const status = adapter.getUnderlyingDevice().getConfigurationStatus();
      expect(status.isConfigured).toBe(true);
      expect(status.sampleRate).toBe(20_000_000);
    });
  });

  describe("Fast Recovery", () => {
    it("performs fast recovery reapplying configuration without vendor reset", async () => {
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Configure device with minimal settings to avoid validation errors
      await adapter.setSampleRate(20_000_000);
      await adapter.setFrequency(100_000_000);
      await adapter.setAmpEnable(true);

      // Perform fast recovery
      await expect(adapter.fastRecovery()).resolves.not.toThrow();

      const calls = (device.controlTransferOut as jest.Mock).mock.calls;
      const resetCall = calls.find((call) => call[0].request === 30);
      expect(resetCall).toBeUndefined();
      // Verify configuration commands were sent (sample rate, freq, amp enable)
      const hasSampleRate = calls.some((c) => c[0].request === 6);
      const hasFreq = calls.some((c) => c[0].request === 16);
      const hasAmp = calls.some((c) => c[0].request === 17);
      expect(hasSampleRate && hasFreq && hasAmp).toBe(true);

      // Should still be initialized after fastRecovery
      const status = adapter.getUnderlyingDevice().getConfigurationStatus();
      expect(status.isConfigured).toBe(true);
    });

    it("maintains initialized state after fast recovery", async () => {
      const { device } = createMockUSBDevice();
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
      const { device } = createMockUSBDevice();

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
      const { device } = createMockUSBDevice();
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
      const { device } = createMockUSBDevice();
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
      const { device } = createMockUSBDevice();
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
      const { device: originalDevice } = createMockUSBDevice();
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

    it("invokes fastRecovery after consecutive transfer timeouts", async () => {
      const { device } = createMockUSBDevice({
        transferInScript: ["timeout", "timeout", "abort"],
      });
      const adapter = new HackRFOneAdapter(device);
      await adapter.setSampleRate(20_000_000);

      const fastRecoverySpy = jest
        .spyOn(Recovery.prototype, "fastRecovery")
        .mockResolvedValue(undefined);

      try {
        await expect(
          adapter.receive(() => {
            /* no-op */
          }),
        ).resolves.not.toThrow();

        expect(fastRecoverySpy).toHaveBeenCalled();
      } finally {
        fastRecoverySpy.mockRestore();
      }
    });
  });

  describe("Error Detection and Reporting", () => {
    it("throws error when sample rate not set before streaming", async () => {
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      await expect(
        adapter.receive(() => {
          /* no-op */
        }),
      ).rejects.toThrow(/not initialized/);
    });

    it("provides helpful error message for missing sample rate", async () => {
      const { device } = createMockUSBDevice();
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
      const { device } = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      const validation = hackrf.validateReadyForStreaming();

      expect(validation.ready).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });

  describe("Configuration State Tracking", () => {
    it("tracks sample rate changes", async () => {
      const { device } = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      await hackrf.setSampleRate(10_000_000);
      expect(hackrf.getConfigurationStatus().sampleRate).toBe(10_000_000);

      await hackrf.setSampleRate(20_000_000);
      expect(hackrf.getConfigurationStatus().sampleRate).toBe(20_000_000);
    });

    it("tracks frequency changes", async () => {
      const { device } = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      await hackrf.setFrequency(100_000_000);
      expect(hackrf.getConfigurationStatus().frequency).toBe(100_000_000);

      await hackrf.setFrequency(200_000_000);
      expect(hackrf.getConfigurationStatus().frequency).toBe(200_000_000);
    });

    it("tracks all configuration parameters independently", async () => {
      const { device } = createMockUSBDevice();
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
    it("reset resolves (no vendor command to fail)", async () => {
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      await expect(adapter.reset()).resolves.not.toThrow();
    });

    it("propagates fastRecovery errors to caller", async () => {
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      await adapter.setSampleRate(20_000_000);

      // Mock recovery failure (persistent failure to ensure initialization also fails)
      (device.controlTransferOut as jest.Mock).mockRejectedValue(
        new Error("USB communication error"),
      );

      // fastRecovery still issues configuration transfers which can fail
      await expect(adapter.fastRecovery()).rejects.toThrow();
    });
  });

  describe("Adapter Coverage", () => {
    it("reports isOpen correctly for device state", () => {
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      // Default mock device opened=true
      expect(adapter.isOpen()).toBe(true);
      (device as any).opened = false;
      expect(adapter.isOpen()).toBe(false);
    });

    it("adjusts LNA gain to nearest supported step", async () => {
      const { device } = createMockUSBDevice();
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
      const { device } = createMockUSBDevice();
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
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      expect(typeof adapter.reset).toBe("function");
    });

    it("adapter implements optional fastRecovery() from ISDRDevice", () => {
      const { device } = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      expect(typeof adapter.fastRecovery).toBe("function");
    });

    it("getConfigurationStatus returns expected shape", () => {
      const { device } = createMockUSBDevice();
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
      const { device } = createMockUSBDevice();
      const hackrf = new HackRFOne(device);

      const validation = hackrf.validateReadyForStreaming();

      expect(validation).toHaveProperty("ready");
      expect(validation).toHaveProperty("issues");
      expect(Array.isArray(validation.issues)).toBe(true);
      expect(typeof validation.ready).toBe("boolean");
    });
  });
});
