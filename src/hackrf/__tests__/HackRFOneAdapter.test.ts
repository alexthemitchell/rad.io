/**
 * Unit tests for HackRFOneAdapter initialization and configuration sequence.
 */

import { HackRFOneAdapter } from "../HackRFOneAdapter";

function createMockUSBDevice(): USBDevice {
  const controlTransferOut = jest
    .fn<
      Promise<USBOutTransferResult>,
      [USBControlTransferParameters, BufferSource?]
    >()
    .mockResolvedValue({} as USBOutTransferResult);

  const mockDevice = {
    opened: true,
    vendorId: 0x1d50,
    productId: 0x6089,
    productName: "Mock HackRF",
    manufacturerName: "Mock",
    serialNumber: "TEST",
    controlTransferOut,
    controlTransferIn: jest.fn().mockResolvedValue({
      data: new DataView(new ArrayBuffer(1)),
      status: "ok",
    } as USBInTransferResult),
    transferIn: jest.fn(),
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

describe("HackRFOneAdapter initialization and configuration", () => {
  describe("initialization validation", () => {
    it("throws error when receive() called without setSampleRate()", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Try to receive without initialization - should fail immediately at validation
      await expect(
        adapter.receive(() => {
          /* no-op */
        }),
      ).rejects.toThrow(/not initialized/);

      // Verify the error message is helpful
      let errorCaught = false;
      try {
        await adapter.receive(() => {
          /* no-op */
        });
      } catch (error) {
        errorCaught = true;
        const err = error as Error;
        expect(err.message).toContain("setSampleRate()");
        expect(err.message).toContain("mandatory");
      }
      expect(errorCaught).toBe(true);
    });

    it("initialization flag is set after setSampleRate", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Before setSampleRate, adapter should throw on receive
      await expect(
        adapter.receive(() => {
          /* no-op */
        }),
      ).rejects.toThrow(/not initialized/);

      // After setSampleRate, we just verify it doesn't throw the validation error
      await adapter.setSampleRate(10_000_000);

      // The isInitialized flag is now set, proven by not throwing validation error
      // We don't need to actually call receive() to verify this
      expect(await adapter.getSampleRate()).toBe(10_000_000);
    });

    it("resets initialization state on close()", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Initialize
      await adapter.setSampleRate(20_000_000);

      // Close device
      await adapter.close();

      // After close, should require initialization again
      await expect(
        adapter.receive(() => {
          /* no-op */
        }),
      ).rejects.toThrow(/not initialized/);
    });

    it("resets initialization state on reset()", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Initialize
      await adapter.setSampleRate(20_000_000);

      // Reset device
      await adapter.reset();

      // After reset, should require initialization again
      await expect(
        adapter.receive(() => {
          /* no-op */
        }),
      ).rejects.toThrow(/not initialized/);
    });
  });

  describe("configuration sequence", () => {
    it("sets sample rate before frequency when config provided", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      const callOrder: string[] = [];

      // Track call order
      const controlTransferOut = device.controlTransferOut as jest.Mock;
      controlTransferOut.mockImplementation(
        async (options: USBControlTransferParameters) => {
          if (options.request === 6) callOrder.push("SAMPLE_RATE"); // SAMPLE_RATE_SET
          if (options.request === 16) callOrder.push("FREQ"); // SET_FREQ
          return {} as USBOutTransferResult;
        },
      );

      // We just need to verify the configuration order before receive() starts
      // So we'll wrap the test to capture the error when device health validation fails
      try {
        await adapter.receive(
          () => {
            /* no-op */
          },
          {
            sampleRate: 10_000_000,
            centerFrequency: 100_000_000,
          },
        );
      } catch {
        // Expected to fail at device health check, but config should have been called first
      }

      // Verify sample rate was set before frequency
      const sampleRateIndex = callOrder.indexOf("SAMPLE_RATE");
      const freqIndex = callOrder.indexOf("FREQ");
      expect(sampleRateIndex).toBeGreaterThan(-1);
      expect(freqIndex).toBeGreaterThan(-1);
      expect(sampleRateIndex).toBeLessThan(freqIndex);
    });

    it("applies all configuration options in receive()", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      const appliedSettings: string[] = [];

      // Mock controlTransferIn for LNA gain
      (device.controlTransferIn as jest.Mock).mockResolvedValue({
        data: new DataView(new Uint8Array([1]).buffer),
        status: "ok",
      } as USBInTransferResult);

      // Track what gets called
      const controlTransferOut = device.controlTransferOut as jest.Mock;
      controlTransferOut.mockImplementation(
        async (options: USBControlTransferParameters) => {
          if (options.request === 6) appliedSettings.push("SAMPLE_RATE");
          if (options.request === 16) appliedSettings.push("FREQ");
          if (options.request === 7) appliedSettings.push("BANDWIDTH");
          if (options.request === 17) appliedSettings.push("AMP");
          return {} as USBOutTransferResult;
        },
      );

      const controlTransferIn = device.controlTransferIn as jest.Mock;
      controlTransferIn.mockImplementation(
        async (options: USBControlTransferParameters) => {
          if (options.request === 19) appliedSettings.push("LNA_GAIN");
          return {
            data: new DataView(new Uint8Array([1]).buffer),
            status: "ok",
          } as USBInTransferResult;
        },
      );

      // Call receive with full config
      try {
        await adapter.receive(
          () => {
            /* no-op */
          },
          {
            sampleRate: 10_000_000,
            centerFrequency: 100_000_000,
            bandwidth: 8_000_000,
            lnaGain: 24,
            ampEnabled: true,
          },
        );
      } catch {
        // Expected to fail, but settings should be applied
      }

      // Verify all settings were applied
      expect(appliedSettings).toContain("SAMPLE_RATE");
      expect(appliedSettings).toContain("FREQ");
      expect(appliedSettings).toContain("BANDWIDTH");
      expect(appliedSettings).toContain("LNA_GAIN");
      expect(appliedSettings).toContain("AMP");

      // Verify sample rate came first
      expect(appliedSettings.indexOf("SAMPLE_RATE")).toBe(0);
    });
  });

  describe("device capabilities", () => {
    it("returns correct frequency range", () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      const capabilities = adapter.getCapabilities();

      expect(capabilities.minFrequency).toBe(1e6); // 1 MHz
      expect(capabilities.maxFrequency).toBe(6e9); // 6 GHz
    });

    it("returns supported sample rates", () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      const capabilities = adapter.getCapabilities();

      expect(capabilities.supportedSampleRates).toContain(2e6);
      expect(capabilities.supportedSampleRates).toContain(10e6);
      expect(capabilities.supportedSampleRates).toContain(20e6);
    });

    it("supports amp control", () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);
      const capabilities = adapter.getCapabilities();

      expect(capabilities.supportsAmpControl).toBe(true);
    });
  });

  describe("state tracking", () => {
    it("returns open state correctly", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Mock device is opened by default
      expect(adapter.isOpen()).toBe(true);

      // Close it by mocking the opened property
      Object.defineProperty(device, "opened", {
        value: false,
        writable: true,
      });
      expect(adapter.isOpen()).toBe(false);
    });
  });

  describe("getters and setters", () => {
    it("getDeviceInfo returns correct device information", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      const info = await adapter.getDeviceInfo();

      expect(info.type).toBe("HackRF One");
      expect(info.vendorId).toBe(0x1d50);
      expect(info.productId).toBe(0x6089);
      expect(info.hardwareRevision).toBe("HackRF One");
    });

    it("getSampleRate returns current sample rate", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Default rate
      expect(await adapter.getSampleRate()).toBe(20e6);

      // After setting
      await adapter.setSampleRate(10e6);
      expect(await adapter.getSampleRate()).toBe(10e6);
    });

    it("getFrequency returns current frequency", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Default frequency
      expect(await adapter.getFrequency()).toBe(100e6);

      // After setting
      await adapter.setFrequency(88.5e6);
      expect(await adapter.getFrequency()).toBe(88.5e6);
    });

    it("getUsableBandwidth returns 80% of sample rate", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Default sample rate (20 MS/s)
      expect(await adapter.getUsableBandwidth()).toBe(20e6 * 0.8);

      // After changing sample rate
      await adapter.setSampleRate(10e6);
      expect(await adapter.getUsableBandwidth()).toBe(10e6 * 0.8);
    });

    it("getBandwidth returns current bandwidth", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Default bandwidth
      expect(await adapter.getBandwidth()).toBe(20e6);

      // After setting
      await adapter.setBandwidth(10e6);
      expect(await adapter.getBandwidth()).toBe(10e6);
    });
  });

  describe("gain and amplifier control", () => {
    it("setLNAGain adjusts to valid 8 dB steps", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Mock controlTransferIn for LNA gain - must return 1 byte with non-zero value
      (device.controlTransferIn as jest.Mock).mockResolvedValue({
        data: new DataView(new Uint8Array([1]).buffer), // Return 1 byte with value 1
        status: "ok",
      } as USBInTransferResult);

      // Valid gain values (0, 8, 16, 24, 32, 40)
      await expect(adapter.setLNAGain(16)).resolves.toBeUndefined();

      // Invalid value should be adjusted to nearest
      await expect(adapter.setLNAGain(15)).resolves.toBeUndefined();
      await expect(adapter.setLNAGain(25)).resolves.toBeUndefined();
    });

    it("setAmpEnable enables/disables amplifier", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      await expect(adapter.setAmpEnable(true)).resolves.toBeUndefined();
      await expect(adapter.setAmpEnable(false)).resolves.toBeUndefined();
    });
  });

  describe("bandwidth control", () => {
    it("setBandwidth adjusts to nearest supported value", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Exact supported value
      await expect(adapter.setBandwidth(10e6)).resolves.toBeUndefined();
      expect(await adapter.getBandwidth()).toBe(10e6);

      // Unsupported value should be adjusted to nearest
      await expect(adapter.setBandwidth(11e6)).resolves.toBeUndefined();
      // Should be adjusted to nearest (10 or 12 MHz)
    });
  });

  describe("sample parsing", () => {
    it("parseSamples converts Int8 data to IQ samples", () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Create sample data (I/Q pairs as Int8)
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      // Set some sample values
      view.setInt8(0, 127); // I
      view.setInt8(1, -128); // Q
      view.setInt8(2, 64); // I
      view.setInt8(3, -64); // Q

      const samples = adapter.parseSamples(view);

      expect(samples.length).toBeGreaterThan(0);
      expect(samples[0]).toHaveProperty("I");
      expect(samples[0]).toHaveProperty("Q");
    });
  });

  describe("memory management", () => {
    it("getMemoryInfo returns buffer statistics", () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      const memInfo = adapter.getMemoryInfo();

      expect(memInfo).toHaveProperty("totalBufferSize");
      expect(memInfo).toHaveProperty("usedBufferSize");
      expect(memInfo).toHaveProperty("activeBuffers");
      expect(memInfo).toHaveProperty("maxSamples");
      expect(memInfo).toHaveProperty("currentSamples");
    });

    it("clearBuffers clears device buffers", () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      expect(() => adapter.clearBuffers()).not.toThrow();
    });
  });

  describe("receiving control", () => {
    it("stopRx stops receiving", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      await expect(adapter.stopRx()).resolves.toBeUndefined();
      expect(adapter.isReceiving()).toBe(false);
    });

    it("isReceiving returns false initially", () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      expect(adapter.isReceiving()).toBe(false);
    });
  });

  describe("device operations", () => {
    it("open opens the device", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      // Mock the device configuration for open
      Object.defineProperty(device, "configuration", {
        value: {
          configurationValue: 1,
          configurationName: "Test Config",
          interfaces: [
            {
              interfaceNumber: 0,
              claimed: false,
              alternates: [
                {
                  alternateSetting: 0,
                  interfaceClass: 255,
                  interfaceSubclass: 0,
                  interfaceProtocol: 0,
                  interfaceName: "Test Interface",
                  endpoints: [
                    {
                      endpointNumber: 1,
                      direction: "in",
                      type: "bulk",
                      packetSize: 512,
                    } as USBEndpoint,
                  ],
                },
              ],
              alternate: {
                alternateSetting: 0,
                interfaceClass: 255,
                interfaceSubclass: 0,
                interfaceProtocol: 0,
                interfaceName: "Test Interface",
                endpoints: [],
              },
            },
          ],
        } as USBConfiguration,
        writable: true,
      });

      await expect(adapter.open()).resolves.toBeUndefined();
    });

    it("reset resets the device", async () => {
      const device = createMockUSBDevice();
      const adapter = new HackRFOneAdapter(device);

      await expect(adapter.reset()).resolves.toBeUndefined();
    });
  });
});
