import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Devices from "../Devices";

// Mock dependencies
jest.mock("../../hooks/useLiveRegion", () => ({
  useLiveRegion: jest.fn(() => ({
    announce: jest.fn(),
    liveRegion: jest.fn(() => <div />),
  })),
}));

const mockInitialize = jest.fn();
const mockCleanup = jest.fn();

jest.mock("../../hooks/useHackRFDevice", () => ({
  useHackRFDevice: jest.fn(() => ({
    device: null,
    initialize: mockInitialize,
    cleanup: mockCleanup,
    isCheckingPaired: false,
  })),
}));

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
      screen.getByRole("heading", { name: /devices/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows scan button when no device", () => {
    render(<Devices />);
    expect(
      screen.getByRole("button", { name: /scan for devices/i }),
    ).toBeInTheDocument();
  });

  it("calls initialize when scan button is clicked", async () => {
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
    const useHackRFDevice =
      require("../../hooks/useHackRFDevice").useHackRFDevice;
    useHackRFDevice.mockReturnValue({
      device: null,
      initialize: mockInitialize,
      cleanup: mockCleanup,
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
