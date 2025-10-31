import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TopAppBar from "../TopAppBar";

// Mock the device context hooks used by TopAppBar and useStatusMetrics
jest.mock("../../contexts/DeviceContext", () => ({
  useDevice: jest.fn(() => ({
    device: null,
    initialize: jest.fn(),
    cleanup: jest.fn(),
    isCheckingPaired: false,
  })),
  useDeviceContext: jest.fn(() => ({
    primaryDevice: null,
  })),
}));

describe("TopAppBar", () => {
  it("renders the top app bar", () => {
    render(
      <MemoryRouter>
        <TopAppBar />
      </MemoryRouter>,
    );
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("displays device status section", () => {
    render(
      <MemoryRouter>
        <TopAppBar />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Device Status")).toBeInTheDocument();
  });

  it("displays disconnected status when no device", () => {
    render(
      <MemoryRouter>
        <TopAppBar />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No Device|Disconnected/i)).toBeInTheDocument();
  });

  it("displays sample rate placeholder", () => {
    render(
      <MemoryRouter>
        <TopAppBar />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Sample Rate/i)).toBeInTheDocument();
  });

  it("displays buffer health", () => {
    render(
      <MemoryRouter>
        <TopAppBar />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Buffer/i)).toBeInTheDocument();
  });

  it("displays record button", () => {
    render(
      <MemoryRouter>
        <TopAppBar />
      </MemoryRouter>,
    );
    const recordButton = screen.getByRole("button", {
      name: /start recording|stop recording/i,
    });
    expect(recordButton).toBeInTheDocument();
    expect(recordButton).toBeDisabled();
  });

  it("shows quick actions section", () => {
    render(
      <MemoryRouter>
        <TopAppBar />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Quick Actions")).toBeInTheDocument();
  });
});
