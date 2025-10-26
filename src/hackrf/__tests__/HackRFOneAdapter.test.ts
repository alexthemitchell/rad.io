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
});
