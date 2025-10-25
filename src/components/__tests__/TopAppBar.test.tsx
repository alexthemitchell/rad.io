import { render, screen } from "@testing-library/react";
import TopAppBar from "../TopAppBar";

// Mock the useDevice hook from DeviceContext
jest.mock("../../contexts/DeviceContext", () => ({
  useDevice: jest.fn(() => ({
    device: null,
    initialize: jest.fn(),
    cleanup: jest.fn(),
    isCheckingPaired: false,
  })),
}));

describe("TopAppBar", () => {
  it("renders the top app bar", () => {
    render(<TopAppBar />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("displays device status section", () => {
    render(<TopAppBar />);
    expect(screen.getByLabelText("Device Status")).toBeInTheDocument();
  });

  it("displays disconnected status when no device", () => {
    render(<TopAppBar />);
    expect(screen.getByText(/No Device|Disconnected/i)).toBeInTheDocument();
  });

  it("displays sample rate placeholder", () => {
    render(<TopAppBar />);
    expect(screen.getByText(/Sample Rate/i)).toBeInTheDocument();
  });

  it("displays buffer health", () => {
    render(<TopAppBar />);
    expect(screen.getByText(/Buffer/i)).toBeInTheDocument();
  });

  it("displays record button", () => {
    render(<TopAppBar />);
    const recordButton = screen.getByRole("button", {
      name: /start recording|stop recording/i,
    });
    expect(recordButton).toBeInTheDocument();
    expect(recordButton).toBeDisabled();
  });

  it("shows quick actions section", () => {
    render(<TopAppBar />);
    expect(screen.getByLabelText("Quick Actions")).toBeInTheDocument();
  });
});
