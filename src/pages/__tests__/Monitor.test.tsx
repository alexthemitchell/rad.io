import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

// Mock the worker pool to avoid Worker initialization errors in Jest
jest.mock("../../workers/dspWorkerPool", () => ({
  dspWorkerPool: {
    postMessage: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

// Mock WebGL renderers to avoid WebGL initialization errors in Jest
jest.mock("../../visualization", () => ({
  WebGLSpectrum: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(false),
    cleanup: jest.fn(),
  })),
  WebGLWaterfall: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(false),
    cleanup: jest.fn(),
  })),
}));

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

import Monitor from "../Monitor";
import { FrequencyProvider } from "../../contexts/FrequencyContext";

describe("Monitor", () => {
  it("renders the monitor page", () => {
    render(
      <BrowserRouter>
        <FrequencyProvider initialHz={100_000_000}>
          <Monitor />
        </FrequencyProvider>
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(
      <BrowserRouter>
        <FrequencyProvider initialHz={100_000_000}>
          <Monitor />
        </FrequencyProvider>
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /monitor/i }),
    ).toBeInTheDocument();
  });

  it("shows spectrum section", () => {
    render(
      <BrowserRouter>
        <FrequencyProvider initialHz={100_000_000}>
          <Monitor />
        </FrequencyProvider>
      </BrowserRouter>,
    );
    expect(
      screen.getByLabelText(/spectrum visualization/i),
    ).toBeInTheDocument();
  });

  it("shows audio controls section", () => {
    render(
      <BrowserRouter>
        <FrequencyProvider initialHz={100_000_000}>
          <Monitor />
        </FrequencyProvider>
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/audio controls/i)).toBeInTheDocument();
  });

  it("shows signal info section", () => {
    render(
      <BrowserRouter>
        <FrequencyProvider initialHz={100_000_000}>
          <Monitor />
        </FrequencyProvider>
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/signal information/i)).toBeInTheDocument();
  });
});
