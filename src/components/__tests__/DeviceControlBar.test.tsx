import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DeviceControlBar } from "../DeviceControlBar";
import type { ISDRDevice } from "../../models/SDRDevice";

// Mock device
const createMockDevice = (overrides = {}): ISDRDevice => ({
  isOpen: jest.fn(() => true),
  isReceiving: jest.fn(() => false),
  open: jest.fn(),
  close: jest.fn(),
  setFrequency: jest.fn(),
  getFrequency: jest.fn(),
  setSampleRate: jest.fn(),
  getSampleRate: jest.fn(() => Promise.resolve(2048000)),
  getUsableBandwidth: jest.fn(() => Promise.resolve(1638400)),
  setLNAGain: jest.fn(),
  setAmpEnable: jest.fn(),
  receive: jest.fn(),
  stopRx: jest.fn(),
  getDeviceInfo: jest.fn(),
  getCapabilities: jest.fn(() => ({
    supportedSampleRates: [2048000],
    minFrequency: 1e6,
    maxFrequency: 6e9,
    supportsAmpControl: true,
    supportsAntennaControl: false,
  })),
  parseSamples: jest.fn(() => []),
  reset: jest.fn(),
  getMemoryInfo: jest.fn(() => ({
    totalSamples: 0,
    totalBytes: 0,
    oldestTimestamp: 0,
    totalBufferSize: 0,
    usedBufferSize: 0,
    activeBuffers: 0,
    maxSamples: 0,
    currentSamples: 0,
  })),
  clearBuffers: jest.fn(),
  ...overrides,
});

describe("DeviceControlBar", () => {
  const mockHandlers = {
    onConnect: jest.fn(),
    onStartReception: jest.fn(),
    onStopReception: jest.fn(),
    onResetDevice: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders connect button when no device is present", () => {
    render(
      <DeviceControlBar
        listening={false}
        isInitializing={false}
        {...mockHandlers}
      />,
    );

    expect(screen.getByText(/Connect Device/i)).toBeInTheDocument();
  });

  it("renders start reception button when device is connected but not listening", () => {
    const mockDevice = createMockDevice();
    render(
      <DeviceControlBar
        device={mockDevice}
        listening={false}
        isInitializing={false}
        {...mockHandlers}
      />,
    );

    expect(screen.getByText(/Start Reception/i)).toBeInTheDocument();
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
  });

  it("renders stop reception button when device is listening", () => {
    const mockDevice = createMockDevice({ isReceiving: () => true });
    render(
      <DeviceControlBar
        device={mockDevice}
        listening={true}
        isInitializing={false}
        {...mockHandlers}
      />,
    );

    expect(screen.getByText(/Stop Reception/i)).toBeInTheDocument();
    expect(screen.getByText(/Receiving/i)).toBeInTheDocument();
  });

  it("calls onConnect when connect button is clicked", async () => {
    render(
      <DeviceControlBar
        listening={false}
        isInitializing={false}
        {...mockHandlers}
      />,
    );

    const connectButton = screen.getByText(/Connect Device/i);
    fireEvent.click(connectButton);

    expect(mockHandlers.onConnect).toHaveBeenCalledTimes(1);
  });

  it("calls onStartReception when start button is clicked", async () => {
    const mockDevice = createMockDevice();
    render(
      <DeviceControlBar
        device={mockDevice}
        listening={false}
        isInitializing={false}
        {...mockHandlers}
      />,
    );

    const startButton = screen.getByText(/Start Reception/i);
    fireEvent.click(startButton);

    expect(mockHandlers.onStartReception).toHaveBeenCalledTimes(1);
  });

  it("calls onStopReception when stop button is clicked", async () => {
    const mockDevice = createMockDevice({ isReceiving: () => true });
    render(
      <DeviceControlBar
        device={mockDevice}
        listening={true}
        isInitializing={false}
        {...mockHandlers}
      />,
    );

    const stopButton = screen.getByText(/Stop Reception/i);
    fireEvent.click(stopButton);

    expect(mockHandlers.onStopReception).toHaveBeenCalledTimes(1);
  });

  it("toggles diagnostics panel visibility", () => {
    const mockDevice = createMockDevice();
    render(
      <DeviceControlBar
        device={mockDevice}
        listening={false}
        isInitializing={false}
        {...mockHandlers}
      />,
    );

    // Initially, diagnostics should not be visible
    expect(screen.queryByText(/Device Connection/i)).not.toBeInTheDocument();

    // Click show diagnostics button
    const toggleButton = screen.getByText(/Show Diagnostics/i);
    fireEvent.click(toggleButton);

    // Diagnostics should now be visible
    expect(screen.getByText(/Device Connection/i)).toBeInTheDocument();

    // Click hide diagnostics button
    const hideButton = screen.getByText(/Hide Diagnostics/i);
    fireEvent.click(hideButton);

    // Diagnostics should be hidden again
    expect(screen.queryByText(/Device Connection/i)).not.toBeInTheDocument();
  });

  it("displays device error badge when error is present", () => {
    const mockDevice = createMockDevice();
    const mockError = new Error("Test error");

    render(
      <DeviceControlBar
        device={mockDevice}
        listening={false}
        isInitializing={false}
        deviceError={mockError}
        {...mockHandlers}
      />,
    );

    expect(screen.getByText(/Device Error/i)).toBeInTheDocument();
  });

  it("disables connect button when initializing", () => {
    render(
      <DeviceControlBar
        listening={false}
        isInitializing={true}
        {...mockHandlers}
      />,
    );

    const connectButton = screen.getByText(/Connecting/i);
    expect(connectButton).toBeDisabled();
  });

  it("disables connect button when checking for paired devices", () => {
    render(
      <DeviceControlBar
        listening={false}
        isInitializing={false}
        isCheckingPaired={true}
        {...mockHandlers}
      />,
    );

    const connectButton = screen.getByText(/Checking for Device/i);
    expect(connectButton).toBeDisabled();
  });
});
