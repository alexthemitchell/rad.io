import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock the Zustand store's useDevice hook to avoid requiring real device state
jest.mock("../../store", () => ({
  __esModule: true,
  useDevice: jest.fn(() => ({
    devices: new Map(),
    primaryDevice: undefined,
    isCheckingPaired: false,
    requestDevice: jest.fn(),
    closeDevice: jest.fn(),
    closeAllDevices: jest.fn(),
    connectPairedUSBDevice: jest.fn(),
  })),
}));

// Mock dependencies
jest.mock("../../hooks/useLiveRegion", () => ({
  useLiveRegion: jest.fn(() => ({
    announce: jest.fn(),
    liveRegion: jest.fn(() => <div />),
  })),
}));

// Legacy hook mock retained for compatibility but not used by component anymore
jest.mock("../../hooks/useHackRFDevice", () => ({
  useHackRFDevice: jest.fn(() => ({
    device: null,
    initialize: jest.fn(),
    cleanup: jest.fn(),
    isCheckingPaired: false,
  })),
}));

// Import the component under test after mocks are in place
const Devices = require("../Devices").default;

describe("Devices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders as panel when isPanel is true", () => {
    render(<Devices isPanel={true} />);
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("renders as main page when isPanel is false", () => {
    render(<Devices isPanel={false} />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(<Devices />);
    expect(
      screen.getByRole("heading", { name: /^devices$/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows scan button when no device", () => {
    render(<Devices />);
    expect(
      screen.getByRole("button", { name: /scan for devices/i }),
    ).toBeInTheDocument();
  });

  it("calls requestDevice when scan button is clicked", async () => {
    const { useDevice } = require("../../store");
    const mockRequestDevice = jest.fn().mockResolvedValue(undefined);
    useDevice.mockReturnValue({
      devices: new Map(),
      primaryDevice: undefined,
      isCheckingPaired: false,
      requestDevice: mockRequestDevice,
      closeDevice: jest.fn(),
      closeAllDevices: jest.fn(),
      connectPairedUSBDevice: jest.fn(),
    });

    render(<Devices />);
    const scanButton = screen.getByRole("button", {
      name: /scan for devices/i,
    });
    fireEvent.click(scanButton);
    await waitFor(() => {
      expect(mockRequestDevice).toHaveBeenCalled();
    });
  });

  it("shows checking message when isCheckingPaired is true", () => {
    const { useDevice } = require("../../store");
    useDevice.mockReturnValue({
      devices: new Map(),
      primaryDevice: undefined,
      isCheckingPaired: true,
      requestDevice: jest.fn(),
      closeDevice: jest.fn(),
      closeAllDevices: jest.fn(),
      connectPairedUSBDevice: jest.fn(),
    });

    render(<Devices />);
    expect(
      screen.getByText(/checking for previously paired devices/i),
    ).toBeInTheDocument();
  });

  it("shows WebUSB support section", () => {
    render(<Devices />);
    expect(
      screen.getByRole("heading", { name: /webusb support/i }),
    ).toBeInTheDocument();
  });

  it("lists supported devices", () => {
    render(<Devices />);
    expect(screen.getByText(/HackRF One/i)).toBeInTheDocument();
  });

  it("shows HTTPS requirement note", () => {
    render(<Devices />);
    expect(screen.getByText(/https/i)).toBeInTheDocument();
  });

  it("displays connected USB device info including USB ID when available", async () => {
    const { useDevice } = require("../../store");
    const fakeUSB = {
      productName: "HackRF One",
      serialNumber: "ABC123",
      vendorId: 0x1d50,
      productId: 0x6089,
    };
    const fakeDevice = {
      isOpen: () => true,
      getSampleRate: jest.fn().mockResolvedValue(2_000_000),
      getFrequency: jest.fn().mockResolvedValue(100_000_000),
      // expose underlying USB device via `device` property
      device: fakeUSB,
    };
    useDevice.mockReturnValue({
      devices: new Map(),
      primaryDevice: fakeDevice,
      isCheckingPaired: false,
      requestDevice: jest.fn(),
      closeDevice: jest.fn(),
      closeAllDevices: jest.fn(),
      connectPairedUSBDevice: jest.fn(),
    });

    render(<Devices />);

    // USB ID should be displayed as hex 1d50:6089 after async info loads
    expect(await screen.findByText(/1d50:6089/i)).toBeInTheDocument();
  });
});
