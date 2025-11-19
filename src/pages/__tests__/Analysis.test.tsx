import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

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
  useMarkers: jest.fn(() => ({
    markers: [],
    addMarker: jest.fn(),
    removeMarker: jest.fn(),
    clearMarkers: jest.fn(),
  })),
}));

// Mock the hooks
jest.mock("../../hooks/useHackRFDevice");
jest.mock("../../hooks/useLiveRegion");

// Mock the complex components
jest.mock("../../components/DeviceControlBar", () => ({
  __esModule: true,
  default: () => <div data-testid="device-control-bar">DeviceControlBar</div>,
}));

jest.mock("../../components/InteractiveDSPPipeline", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="interactive-dsp-pipeline">InteractiveDSPPipeline</div>
  ),
}));

jest.mock("../../components/PerformanceMetrics", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="performance-metrics">PerformanceMetrics</div>
  ),
}));

jest.mock("../../components/Card", () => ({
  __esModule: true,
  default: ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="card">
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  ),
}));

// Import the component under test after mocks are in place
const Analysis = require("../Analysis").default;

describe("Analysis", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useHackRFDevice hook
    const { useHackRFDevice } = require("../../hooks/useHackRFDevice");
    useHackRFDevice.mockReturnValue({
      device: null,
      initialize: jest.fn(),
      isCheckingPaired: false,
    });

    // Mock useLiveRegion hook
    const { useLiveRegion } = require("../../hooks/useLiveRegion");
    useLiveRegion.mockReturnValue({
      announce: jest.fn(),
      liveRegion: () => <div role="status" aria-live="polite" />,
    });
  });

  it("renders the analysis page", () => {
    render(
      <BrowserRouter>
        <Analysis />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays skip link for accessibility", () => {
    render(
      <BrowserRouter>
        <Analysis />
      </BrowserRouter>,
    );
    expect(screen.getByText(/skip to main content/i)).toBeInTheDocument();
  });

  it("renders device control bar", () => {
    render(
      <BrowserRouter>
        <Analysis />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("device-control-bar")).toBeInTheDocument();
  });

  it("displays signal analysis card with title", () => {
    render(
      <BrowserRouter>
        <Analysis />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /signal analysis/i }),
    ).toBeInTheDocument();
  });

  it("shows message when no device is connected", () => {
    render(
      <BrowserRouter>
        <Analysis />
      </BrowserRouter>,
    );
    expect(screen.getByText(/no device connected/i)).toBeInTheDocument();
  });

  it("renders interactive DSP pipeline component", () => {
    render(
      <BrowserRouter>
        <Analysis />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("interactive-dsp-pipeline")).toBeInTheDocument();
  });

  it("renders performance metrics component", () => {
    render(
      <BrowserRouter>
        <Analysis />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("performance-metrics")).toBeInTheDocument();
  });

  it("shows different message when device is connected but not listening", () => {
    const { useDevice } = require("../../store");
    useDevice.mockReturnValue({
      devices: new Map(),
      primaryDevice: {},
      isCheckingPaired: false,
      requestDevice: jest.fn(),
      closeDevice: jest.fn(),
      closeAllDevices: jest.fn(),
      connectPairedUSBDevice: jest.fn(),
    });

    render(
      <BrowserRouter>
        <Analysis />
      </BrowserRouter>,
    );
    expect(
      screen.getByText(/click.*start reception.*to begin/i),
    ).toBeInTheDocument();
  });
});
