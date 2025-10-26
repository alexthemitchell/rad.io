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
});
