/**
 * Shared helper for building mock USB devices used across HackRF tests.
 * Provides scriptable transferIn behavior so streaming tests can express
 * retry, timeout, and abort scenarios without poking internal flags.
 */

export type TransferInStep =
  | "success"
  | "timeout"
  | "error"
  | "abort"
  | "stall";

export interface MockUSBDeviceOptions {
  transferInBehavior?: "success" | "timeout" | "error";
  transferInScript?: TransferInStep[];
  overrides?: Partial<USBDevice>;
}

export interface MockUSBDeviceResult {
  device: USBDevice;
  controlTransferOut: jest.Mock<
    Promise<USBOutTransferResult>,
    [USBControlTransferParameters, BufferSource?]
  >;
  controlTransferIn: jest.Mock<
    Promise<USBInTransferResult>,
    [USBControlTransferParameters]
  >;
  transferIn: jest.Mock<Promise<USBInTransferResult>, [number, number]>;
}

function buildDefaultScript(
  behavior: MockUSBDeviceOptions["transferInBehavior"],
): TransferInStep[] {
  switch (behavior) {
    case "timeout":
      return ["timeout"];
    case "error":
      return ["error"];
    case "success":
    case undefined:
    default:
      return ["success", "abort"];
  }
}

export function createMockUSBDevice(
  options?: MockUSBDeviceOptions,
): MockUSBDeviceResult {
  const script =
    options?.transferInScript ??
    buildDefaultScript(options?.transferInBehavior);

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
      data: new DataView(new Uint8Array([1]).buffer),
      status: "ok",
    } as USBInTransferResult);

  let transferInCallCount = 0;
  const transferIn = jest
    .fn<Promise<USBInTransferResult>, [number, number]>()
    .mockImplementation(async () => {
      const step =
        script[Math.min(transferInCallCount, script.length - 1)] ?? "success";
      transferInCallCount += 1;

      switch (step) {
        case "timeout":
          return Promise.reject(
            new Error("transferIn timeout after 1000ms - simulated"),
          );
        case "error":
          return Promise.reject(new Error("USB transfer failed"));
        case "abort": {
          const abortError = new Error("AbortError");
          abortError.name = "AbortError";
          return Promise.reject(abortError);
        }
        case "stall":
          return new Promise<USBInTransferResult>(() => {
            /* intentionally never resolves */
          });
        case "success":
          return Promise.resolve({
            data: new DataView(new ArrayBuffer(4096)),
            status: "ok",
          } as USBInTransferResult);
        default:
          throw new Error(`Unexpected step: ${String(step)}`);
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
    transferOut: jest.fn().mockResolvedValue({
      bytesWritten: 0,
      status: "ok",
    } as USBOutTransferResult),
    configurations: [],
    configuration: undefined,
    open: jest.fn().mockImplementation(async () => {
      (mockDevice as { opened: boolean }).opened = true;
      return Promise.resolve();
    }),
    close: jest.fn().mockImplementation(async () => {
      (mockDevice as { opened: boolean }).opened = false;
      return Promise.resolve();
    }),
    reset: jest.fn().mockResolvedValue(undefined),
    clearHalt: jest.fn().mockResolvedValue(undefined),
    selectConfiguration: jest.fn().mockResolvedValue(undefined),
    selectAlternateInterface: jest.fn().mockResolvedValue(undefined),
    claimInterface: jest.fn().mockResolvedValue(undefined),
    releaseInterface: jest.fn().mockResolvedValue(undefined),
    forget: jest.fn().mockResolvedValue(undefined),
  } as unknown as USBDevice;

  if (options?.overrides) {
    Object.assign(mockDevice, options.overrides);
  }

  return {
    device: mockDevice,
    controlTransferOut,
    controlTransferIn,
    transferIn,
  };
}
