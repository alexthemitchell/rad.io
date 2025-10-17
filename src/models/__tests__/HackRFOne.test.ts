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
});
