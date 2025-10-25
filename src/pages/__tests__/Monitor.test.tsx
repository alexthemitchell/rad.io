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

import Monitor from "../Monitor";

describe("Monitor", () => {
  it("renders the monitor page", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /monitor/i }),
    ).toBeInTheDocument();
  });

  it("shows spectrum section", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(
      screen.getByLabelText(/spectrum visualization/i),
    ).toBeInTheDocument();
  });

  it("shows audio controls section", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/audio controls/i)).toBeInTheDocument();
  });

  it("shows signal info section", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/signal information/i)).toBeInTheDocument();
  });
});
