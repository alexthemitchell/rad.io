/**
 * Tests for App component
 */

import { render, screen } from "@testing-library/react";
import App from "../App";
import * as dspWasm from "../utils/dspWasm";

// Mock the WASM module preload
jest.mock("../utils/dspWasm", () => ({
  preloadWasmModule: jest.fn(),
}));

// Mock the page components to avoid their dependencies
jest.mock("../pages/LiveMonitor", () => {
  return function LiveMonitor() {
    return <div data-testid="live-monitor">Live Monitor Page</div>;
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

  it("renders the LiveMonitor page by default (root route)", () => {
    render(<App />);
    expect(screen.getByTestId("live-monitor")).toBeInTheDocument();
  });

  it("has accessible header with banner role", () => {
    render(<App />);
    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();
    expect(header.tagName).toBe("HEADER");
  });
});
