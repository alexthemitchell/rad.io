/**
 * Unit tests for HackRFOne control transfer formatting.
 */

import { HackRFOne, RequestCommand } from "../HackRFOne";

function createMockUSBDevice(): {
  device: USBDevice;
  controlTransferOut: jest.Mock<
    Promise<USBOutTransferResult>,
    [USBControlTransferParameters, BufferSource?]
  >;
} {
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
    controlTransferIn: jest.fn(),
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

  return { device: mockDevice, controlTransferOut };
}

describe("HackRFOne control formatting", () => {
  it("formats frequency command per HackRF protocol", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const frequency = 123_456_789; // Hz

    await hackRF.setFrequency(frequency);

    expect(controlTransferOut).toHaveBeenCalledTimes(1);
    const [options, data] = controlTransferOut.mock.calls[0] ?? [];
    expect(options).toMatchObject({
      requestType: "vendor",
      recipient: "device",
      request: RequestCommand.SET_FREQ,
    });
    expect(data).toBeInstanceOf(ArrayBuffer);

    const view = new DataView(data as ArrayBuffer);
    expect(view.getUint32(0, true)).toBe(123);
    expect(view.getUint32(4, true)).toBe(456_789);
  });

  it("formats sample rate with divider", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const sampleRate = 12_500_000; // Hz

    await hackRF.setSampleRate(sampleRate);

    expect(controlTransferOut).toHaveBeenCalledTimes(1);
    const [, data] = controlTransferOut.mock.calls[0] ?? [];
    expect(data).toBeInstanceOf(ArrayBuffer);

    const view = new DataView(data as ArrayBuffer);
    expect(view.getUint32(0, true)).toBe(12_500_000);
    expect(view.getUint32(4, true)).toBe(1);
  });

  it("splits bandwidth into value/index words", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const bandwidth = 20_000_000; // Hz

    await hackRF.setBandwidth(bandwidth);

    expect(controlTransferOut).toHaveBeenCalledTimes(1);
    const [options, data] = controlTransferOut.mock.calls[0] ?? [];
    expect(options).toMatchObject({
      request: RequestCommand.BASEBAND_FILTER_BANDWIDTH_SET,
      value: bandwidth & 0xffff,
      index: bandwidth >>> 16,
    });
    expect(data).toBeUndefined();
  });

  it("throws error when receive() called without sample rate", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    // Try to receive without setting sample rate first
    await expect(hackRF.receive()).rejects.toThrow(
      /Sample rate not configured/,
    );
  });

  it("allows receive() after sample rate is configured", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    // Set sample rate first (required)
    await hackRF.setSampleRate(20_000_000);

    // Mock transferIn to return data once then fail to stop the loop
    let callCount = 0;
    (device.transferIn as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call returns data
        return Promise.resolve({
          data: new DataView(new ArrayBuffer(4096)),
          status: "ok",
        } as USBInTransferResult);
      }
      // Stop the loop by making subsequent calls hang
      return new Promise(() => {
        /* never resolves */
      });
    });

    // Start receive in background
    const receivePromise = hackRF.receive();

    // Give it time to start and process one buffer
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify that transceiver mode was set to RECEIVE
    const setTransceiverCalls = controlTransferOut.mock.calls.filter(
      (call) => call[0].request === RequestCommand.SET_TRANSCEIVER_MODE,
    );
    expect(setTransceiverCalls.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(setTransceiverCalls[0]![0]).toMatchObject({
      request: RequestCommand.SET_TRANSCEIVER_MODE,
      value: 1, // RECEIVE mode
    });

    // Stop the receive loop
    hackRF.stopRx();

    // Wait for the promise to complete
    await expect(receivePromise).resolves.toBeUndefined();
  });

  it("validates sample rate range", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    // Too low
    await expect(hackRF.setSampleRate(1_000_000)).rejects.toThrow(
      /out of range/,
    );

    // Too high
    await expect(hackRF.setSampleRate(30_000_000)).rejects.toThrow(
      /out of range/,
    );

    // Valid range (2-20 MSPS)
    await expect(hackRF.setSampleRate(10_000_000)).resolves.toBeUndefined();
  });

  it("validates frequency range", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    // Too low (< 1 MHz)
    await expect(hackRF.setFrequency(500_000)).rejects.toThrow(/out of range/);

    // Too high (> 6 GHz)
    await expect(hackRF.setFrequency(7_000_000_000)).rejects.toThrow(
      /out of range/,
    );

    // Valid range
    await expect(hackRF.setFrequency(100_000_000)).resolves.toBeUndefined();
  });

  it("sets bandwidth correctly", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const bandwidth = 10_000_000; // 10 MHz

    await hackRF.setBandwidth(bandwidth);

    expect(controlTransferOut).toHaveBeenCalledWith(
      expect.objectContaining({
        request: RequestCommand.BASEBAND_FILTER_BANDWIDTH_SET,
        value: bandwidth & 0xffff,
        index: bandwidth >>> 16,
      }),
      undefined,
    );
  });

  it("sets LNA gain correctly", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    // Mock controlTransferIn for LNA gain - must return 1 byte with non-zero value
    (device.controlTransferIn as jest.Mock).mockResolvedValue({
      data: new DataView(new Uint8Array([1]).buffer), // Return 1 byte with value 1
      status: "ok",
    } as USBInTransferResult);

    await hackRF.setLNAGain(24);

    expect(device.controlTransferIn).toHaveBeenCalledWith(
      expect.objectContaining({
        request: RequestCommand.SET_LNA_GAIN,
        index: 24,
      }),
      1,
    );
  });

  it("sets amp enable correctly", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    await hackRF.setAmpEnable(true);

    expect(controlTransferOut).toHaveBeenCalledWith(
      expect.objectContaining({
        request: RequestCommand.AMP_ENABLE,
        value: 1,
      }),
      undefined,
    );

    await hackRF.setAmpEnable(false);

    expect(controlTransferOut).toHaveBeenCalledWith(
      expect.objectContaining({
        request: RequestCommand.AMP_ENABLE,
        value: 0,
      }),
      undefined,
    );
  });

  it("stops receive correctly", () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    expect(() => hackRF.stopRx()).not.toThrow();
  });

  it("returns memory info", () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    const memInfo = hackRF.getMemoryInfo();

    expect(memInfo).toHaveProperty("totalBufferSize");
    expect(memInfo).toHaveProperty("usedBufferSize");
    expect(memInfo).toHaveProperty("activeBuffers");
  });

  it("clears buffers", () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    expect(() => hackRF.clearBuffers()).not.toThrow();
  });

  it("resets device", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    await hackRF.reset();

    expect(controlTransferOut).toHaveBeenCalledWith(
      expect.objectContaining({
        request: RequestCommand.RESET,
      }),
      undefined,
    );
  });

  it("logs configuration in development mode for setSampleRate", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const originalEnv = process.env["NODE_ENV"];
    const consoleSpy = jest.spyOn(console, "debug").mockImplementation();

    try {
      process.env["NODE_ENV"] = "development";
      await hackRF.setSampleRate(10_000_000);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("setSampleRate"),
        expect.objectContaining({
          sampleRate: 10_000_000,
          sampleRateMSPS: "10.000",
        }),
      );
    } finally {
      process.env["NODE_ENV"] = originalEnv;
      consoleSpy.mockRestore();
    }
  });

  it("logs configuration in development mode for setFrequency", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const originalEnv = process.env["NODE_ENV"];
    const consoleSpy = jest.spyOn(console, "debug").mockImplementation();

    try {
      process.env["NODE_ENV"] = "development";
      await hackRF.setFrequency(100_000_000);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("setFrequency"),
        expect.objectContaining({
          frequency: 100_000_000,
          frequencyMHz: "100.000",
        }),
      );
    } finally {
      process.env["NODE_ENV"] = originalEnv;
      consoleSpy.mockRestore();
    }
  });

  it("does not log in non-development mode", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const originalEnv = process.env["NODE_ENV"];
    const consoleSpy = jest.spyOn(console, "debug").mockImplementation();

    try {
      process.env["NODE_ENV"] = "production";
      await hackRF.setSampleRate(10_000_000);
      await hackRF.setFrequency(100_000_000);

      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      process.env["NODE_ENV"] = originalEnv;
      consoleSpy.mockRestore();
    }
  });
});
