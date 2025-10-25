import { render, screen } from "@testing-library/react";
import StatusFooter from "../StatusFooter";

// Mock the performance monitoring dependencies
jest.mock("../../utils/performanceMonitor", () => ({
  performanceMonitor: {
    getFPS: jest.fn(() => 60),
  },
}));

jest.mock("../../lib/render/RenderTierManager", () => ({
  renderTierManager: {
    subscribe: jest.fn((callback) => {
      // Immediately call with Unknown tier
      callback("Unknown");
      // Return unsubscribe function
      return jest.fn();
    }),
  },
}));

describe("StatusFooter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the status footer", () => {
    render(<StatusFooter />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("displays FPS metric", () => {
    render(<StatusFooter />);
    expect(screen.getByText(/FPS/i)).toBeInTheDocument();
  });

  it("displays GPU mode", () => {
    render(<StatusFooter />);
    expect(screen.getByText(/GPU/i)).toBeInTheDocument();
  });

  it("displays audio state", () => {
    render(<StatusFooter />);
    expect(screen.getByText(/Audio/i)).toBeInTheDocument();
  });

  it("displays storage info", () => {
    render(<StatusFooter />);
    expect(screen.getByText(/Storage/i)).toBeInTheDocument();
  });

  it("has correct aria label", () => {
    render(<StatusFooter />);
    expect(screen.getByLabelText("System status")).toBeInTheDocument();
  });
});
