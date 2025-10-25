import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock the DeviceContext to avoid requiring a real provider in tests
jest.mock("../../contexts/DeviceContext", () => ({
  DeviceProvider: ({ children }: any) => <>{children}</>,
  useDevice: jest.fn(() => ({
    device: null,
    initialize: jest.fn(),
    cleanup: jest.fn(),
    isCheckingPaired: false,
  })),
  useDeviceContext: jest.fn(() => ({
    devices: new Map(),
    primaryDevice: undefined,
    isCheckingPaired: false,
    requestDevice: jest.fn(),
    closeDevice: jest.fn(),
    closeAllDevices: jest.fn(),
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

  it("calls initialize when scan button is clicked", async () => {
    const { useDevice } = require("../../contexts/DeviceContext");
    const mockInitialize = jest.fn();
    useDevice.mockReturnValue({
      device: null,
      initialize: mockInitialize,
      cleanup: jest.fn(),
      isCheckingPaired: false,
    });

    render(<Devices />);
    const scanButton = screen.getByRole("button", {
      name: /scan for devices/i,
    });
    fireEvent.click(scanButton);
    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalled();
    });
  });

  it("shows checking message when isCheckingPaired is true", () => {
    const { useDevice } = require("../../contexts/DeviceContext");
    useDevice.mockReturnValue({
      device: null,
      initialize: jest.fn(),
      cleanup: jest.fn(),
      isCheckingPaired: true,
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
});
