import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

// Mock the DeviceContext to avoid requiring a real provider in tests
jest.mock("../../contexts/DeviceContext", () => ({
  DeviceProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
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
jest.mock("../../hooks/useFrequencyScanner");
jest.mock("../../hooks/useLiveRegion");

// Import the component under test after mocks are in place
const Scanner = require("../Scanner").default;

// Mock react-router-dom's useNavigate
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// Mock the components
jest.mock("../../components/FrequencyScanner", () => ({
  __esModule: true,
  default: () => <div data-testid="frequency-scanner">FrequencyScanner</div>,
}));

jest.mock("../../components/SignalTypeSelector", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="signal-type-selector">SignalTypeSelector</div>
  ),
}));

jest.mock("../../components/TalkgroupScanner", () => ({
  __esModule: true,
  default: () => <div data-testid="talkgroup-scanner">TalkgroupScanner</div>,
}));

jest.mock("../../components/TalkgroupStatus", () => ({
  __esModule: true,
  default: () => <div data-testid="talkgroup-status">TalkgroupStatus</div>,
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

describe("Scanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useHackRFDevice hook
    const { useHackRFDevice } = require("../../hooks/useHackRFDevice");
    useHackRFDevice.mockReturnValue({
      device: { isOpen: () => false },
    });

    // Mock useFrequencyScanner hook
    const { useFrequencyScanner } = require("../../hooks/useFrequencyScanner");
    useFrequencyScanner.mockReturnValue({
      state: "idle",
      config: {},
      currentFrequency: 0,
      activeSignals: [],
      progress: 0,
      startScan: jest.fn(),
      pauseScan: jest.fn(),
      resumeScan: jest.fn(),
      stopScan: jest.fn(),
      updateConfig: jest.fn(),
      clearSignals: jest.fn(),
    });

    // Mock useLiveRegion hook
    const { useLiveRegion } = require("../../hooks/useLiveRegion");
    useLiveRegion.mockReturnValue({
      announce: jest.fn(),
      liveRegion: () => <div role="status" aria-live="polite" />,
    });
  });

  it("renders the scanner page", () => {
    render(
      <BrowserRouter>
        <Scanner />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays skip link for accessibility", () => {
    render(
      <BrowserRouter>
        <Scanner />
      </BrowserRouter>,
    );
    expect(screen.getByText(/skip to main content/i)).toBeInTheDocument();
  });

  it("renders scanner configuration card", () => {
    render(
      <BrowserRouter>
        <Scanner />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /scanner configuration/i }),
    ).toBeInTheDocument();
  });

  it("renders signal type selector", () => {
    render(
      <BrowserRouter>
        <Scanner />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("signal-type-selector")).toBeInTheDocument();
  });

  it("renders frequency scanner by default (non-P25 mode)", () => {
    render(
      <BrowserRouter>
        <Scanner />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("frequency-scanner")).toBeInTheDocument();
  });

  it("does not render talkgroup components in non-P25 mode", () => {
    render(
      <BrowserRouter>
        <Scanner />
      </BrowserRouter>,
    );
    expect(screen.queryByTestId("talkgroup-scanner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("talkgroup-status")).not.toBeInTheDocument();
  });

  // Live region is now centralized in ToastProvider at the app shell; page does not render its own.
});
