import type React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { useUSBDevice } from "../useUSBDevice";

// Minimal stub for USBDevice shape used by the hook
function makeUSBDevice(
  vendorId: number,
  productId: number,
  serialNumber?: string,
  productName?: string,
): USBDevice {
  return {
    vendorId,
    productId,
    serialNumber: serialNumber as string | undefined,
    productName: productName as string | undefined,
    // Unused members mocked as no-ops or defaults
    opened: false,
    configured: false as unknown as boolean,
    configuration: undefined,
    configurations: [] as any,
    deviceClass: 0,
    deviceProtocol: 0,
    deviceSubclass: 0,
    deviceVersionMajor: 0,
    deviceVersionMinor: 0,
    deviceVersionSubminor: 0,
    manufacturerName: undefined,
    usbVersionMajor: 0,
    usbVersionMinor: 0,
    usbVersionSubminor: 0,
    productIdHex: "",
    vendorIdHex: "",
    // Methods
    open: async () => void 0,
    close: async () => void 0,
    selectConfiguration: async () => void 0,
    claimInterface: async () => void 0,
    releaseInterface: async () => void 0,
    selectAlternateInterface: async () => void 0,
    controlTransferIn: async () => ({ data: null, status: "ok" }) as any,
    controlTransferOut: async () => ({ bytesWritten: 0, status: "ok" }) as any,
    clearHalt: async () => void 0,
    transferIn: async () =>
      ({ data: new DataView(new ArrayBuffer(0)), status: "ok" }) as any,
    transferOut: async () => ({ bytesWritten: 0, status: "ok" }) as any,
    reset: async () => void 0,
  } as unknown as USBDevice;
}

function TestHook({
  filters,
}: {
  filters: USBDeviceFilter[];
}): React.JSX.Element {
  const { device, isCheckingPaired } = useUSBDevice(filters);
  return (
    <div>
      <div data-testid="status">{isCheckingPaired ? "checking" : "done"}</div>
      <div data-testid="device">{device ? "set" : "unset"}</div>
    </div>
  );
}

describe.skip("useUSBDevice paired device behavior", () => {
  const originalNavigatorUSB = (navigator as any).usb;

  beforeEach(() => {
    (navigator as any).usb = {
      getDevices: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      requestDevice: jest.fn(),
    };
  });

  afterEach(() => {
    (navigator as any).usb = originalNavigatorUSB;
    jest.restoreAllMocks();
  });

  it("auto-selects when exactly one matched device is present", async () => {
    const hackrf = makeUSBDevice(0x1d50, 0x6089, "ABC123", "HackRF One");
    (navigator as any).usb.getDevices.mockResolvedValue([hackrf]);

    render(<TestHook filters={[{ vendorId: 0x1d50 }, { vendorId: 0x0bda }]} />);

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("done"),
    );
    expect(screen.getByTestId("device").textContent).toBe("set");
  });

  it("defers selection when multiple matched devices are present", async () => {
    const hackrf = makeUSBDevice(0x1d50, 0x6089, "ABC123", "HackRF One");
    const rtlsdr = makeUSBDevice(0x0bda, 0x2838, "XYZ789", "RTL-SDR");
    (navigator as any).usb.getDevices.mockResolvedValue([hackrf, rtlsdr]);

    render(<TestHook filters={[{ vendorId: 0x1d50 }, { vendorId: 0x0bda }]} />);

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("done"),
    );
    expect(screen.getByTestId("device").textContent).toBe("unset");
  });
});
