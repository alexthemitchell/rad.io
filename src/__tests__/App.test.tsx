/**
 * Tests for App component
 */

import { render, screen } from "@testing-library/react";
import App from "../App";
import * as dspWasm from "../utils/dspWasm";

// Mock WebUSB API
Object.defineProperty(global.navigator, "usb", {
  value: {
    getDevices: jest.fn().mockResolvedValue([]),
    requestDevice: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  writable: true,
});

// Mock the WASM module preload
jest.mock("../utils/dspWasm", () => ({
  preloadWasmModule: jest.fn(),
}));

// Mock the global shell components
jest.mock("../components/TopAppBar", () => {
  return function TopAppBar() {
    return <div data-testid="top-app-bar">Top App Bar</div>;
  };
});

jest.mock("../components/StatusBar", () => {
  return function StatusBar() {
    return <div data-testid="status-bar">Status Bar</div>;
  };
});

jest.mock("../components/FrequencyDisplay", () => {
  return function FrequencyDisplay() {
    return <div data-testid="frequency-display">Frequency Display</div>;
  };
});

// Mock the page components to avoid their dependencies
jest.mock("../pages/Monitor", () => {
  return function Monitor() {
    return <div data-testid="monitor">Monitor Page</div>;
  };
});

jest.mock("../pages/Scanner", () => {
  return function Scanner() {
    return <div data-testid="scanner">Scanner Page</div>;
  };
});

jest.mock("../pages/Analysis", () => {
  return function Analysis() {
    return <div data-testid="analysis">Analysis Page</div>;
  };
});

jest.mock("../pages/Decode", () => {
  return function Decode() {
    return <div data-testid="decode">Decode Page</div>;
  };
});

jest.mock("../pages/Recordings", () => {
  return function Recordings() {
    return <div data-testid="recordings">Recordings Page</div>;
  };
});

jest.mock("../pages/Settings", () => {
  return function Settings() {
    return <div data-testid="settings">Settings Page</div>;
  };
});

jest.mock("../pages/Calibration", () => {
  return function Calibration() {
    return <div data-testid="calibration">Calibration Page</div>;
  };
});

jest.mock("../pages/Help", () => {
  return function Help() {
    return <div data-testid="help">Help Page</div>;
  };
});

jest.mock("../panels/Bookmarks", () => {
  return function Bookmarks() {
    return <div data-testid="bookmarks">Bookmarks Panel</div>;
  };
});

jest.mock("../panels/Devices", () => {
  return function Devices() {
    return <div data-testid="devices">Devices Panel</div>;
  };
});

jest.mock("../panels/Measurements", () => {
  return function Measurements() {
    return <div data-testid="measurements">Measurements Panel</div>;
  };
});

jest.mock("../panels/Diagnostics", () => {
  return function Diagnostics() {
    return <div data-testid="diagnostics">Diagnostics Panel</div>;
  };
});

// Mock the DeviceContext
jest.mock("../contexts/DeviceContext", () => ({
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

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the app header with title", () => {
    render(<App />);
    expect(screen.getByText("rad.io")).toBeInTheDocument();
    expect(
      screen.getByText("Software-Defined Radio Visualizer"),
    ).toBeInTheDocument();
  });

  it("renders the navigation component", () => {
    render(<App />);
    // Navigation renders links
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("preloads WASM module on mount", () => {
    render(<App />);
    expect(dspWasm.preloadWasmModule).toHaveBeenCalledTimes(1);
  });

  it("renders the Monitor page by default (root route)", () => {
    render(<App />);
    expect(screen.getByTestId("monitor")).toBeInTheDocument();
  });

  it("has accessible header with banner role", () => {
    render(<App />);
    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();
    expect(header.tagName).toBe("HEADER");
  });
});
