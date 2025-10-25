import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

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

// Mock the hooks
jest.mock("../../hooks/useHackRFDevice");
jest.mock("../../hooks/useLiveRegion");

// Mock the components
jest.mock("../../components/DeviceControlBar", () => ({
  __esModule: true,
  default: () => <div data-testid="device-control-bar">DeviceControlBar</div>,
}));

jest.mock("../../components/AudioControls", () => ({
  __esModule: true,
  default: () => <div data-testid="audio-controls">AudioControls</div>,
}));

jest.mock("../../components/BandwidthSelector", () => ({
  __esModule: true,
  default: () => <div data-testid="bandwidth-selector">BandwidthSelector</div>,
}));

jest.mock("../../components/RadioControls", () => ({
  __esModule: true,
  default: () => <div data-testid="radio-controls">RadioControls</div>,
}));

jest.mock("../../components/SignalTypeSelector", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="signal-type-selector">SignalTypeSelector</div>
  ),
}));

jest.mock("../../components/Spectrogram", () => ({
  __esModule: true,
  default: () => <div data-testid="spectrogram">Spectrogram</div>,
}));

jest.mock("../../components/StatusBar", () => ({
  __esModule: true,
  default: () => <div data-testid="status-bar">StatusBar</div>,
  RenderTier: {
    Unknown: 0,
    CPU: 1,
    WebGL: 2,
    WebGPU: 3,
  },
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

// Mock the render tier manager
jest.mock("../../lib/render/RenderTierManager", () => ({
  renderTierManager: {
    subscribe: jest.fn(() => jest.fn()),
  },
}));

// Mock performance monitor
jest.mock("../../utils/performanceMonitor", () => ({
  performanceMonitor: {
    getFPS: jest.fn(() => 60),
  },
}));

// Import the component under test after mocks are in place
const LiveMonitor = require("../LiveMonitor").default;

describe("LiveMonitor", () => {
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

    // Mock storage API
    Object.defineProperty(navigator, "storage", {
      value: {
        estimate: jest.fn().mockResolvedValue({
          usage: 1000000,
          quota: 10000000,
        }),
      },
      writable: true,
    });
  });

  it("renders the live monitor page", () => {
    render(
      <BrowserRouter>
        <LiveMonitor />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays skip link for accessibility", () => {
    render(
      <BrowserRouter>
        <LiveMonitor />
      </BrowserRouter>,
    );
    expect(screen.getByText(/skip to main content/i)).toBeInTheDocument();
  });

  it("renders device control bar", () => {
    render(
      <BrowserRouter>
        <LiveMonitor />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("device-control-bar")).toBeInTheDocument();
  });

  it("renders radio controls card", () => {
    render(
      <BrowserRouter>
        <LiveMonitor />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /radio controls/i }),
    ).toBeInTheDocument();
  });

  it("renders signal type selector", () => {
    render(
      <BrowserRouter>
        <LiveMonitor />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("signal-type-selector")).toBeInTheDocument();
  });

  it("renders radio controls component", () => {
    render(
      <BrowserRouter>
        <LiveMonitor />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("radio-controls")).toBeInTheDocument();
  });

  it("renders audio controls", () => {
    render(
      <BrowserRouter>
        <LiveMonitor />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("audio-controls")).toBeInTheDocument();
  });

  it("renders spectrogram card", () => {
    render(
      <BrowserRouter>
        <LiveMonitor />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /spectrogram/i }),
    ).toBeInTheDocument();
  });

  it("renders spectrogram component", () => {
    render(
      <BrowserRouter>
        <LiveMonitor />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("spectrogram")).toBeInTheDocument();
  });

  it("renders status bar", () => {
    render(
      <BrowserRouter>
        <LiveMonitor />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
  });

  it("includes live region for screen reader announcements", () => {
    render(
      <BrowserRouter>
        <LiveMonitor />
      </BrowserRouter>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
