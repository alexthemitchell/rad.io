import { render, screen } from "@testing-library/react";
import Diagnostics from "../Diagnostics";

// Mock the store hooks
jest.mock("../../store", () => ({
  useDiagnostics: jest.fn(() => ({
    dspCapabilities: null,
    events: [],
    demodulatorMetrics: null,
    tsParserMetrics: null,
    videoDecoderMetrics: null,
    audioDecoderMetrics: null,
    captionDecoderMetrics: null,
    overlayVisible: false,
    addDiagnosticEvent: jest.fn(),
    updateDemodulatorMetrics: jest.fn(),
    updateTSParserMetrics: jest.fn(),
    updateVideoDecoderMetrics: jest.fn(),
    updateAudioDecoderMetrics: jest.fn(),
    updateCaptionDecoderMetrics: jest.fn(),
    setDSPCapabilities: jest.fn(),
    clearDiagnosticEvents: jest.fn(),
    resetDiagnostics: jest.fn(),
    setOverlayVisible: jest.fn(),
  })),
}));

describe("Diagnostics", () => {
  it("renders as panel when isPanel is true", () => {
    render(<Diagnostics isPanel={true} />);
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("renders as main page when isPanel is false", () => {
    render(<Diagnostics isPanel={false} />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(<Diagnostics />);
    expect(
      screen.getByRole("heading", { name: /diagnostics/i }),
    ).toBeInTheDocument();
  });

  it("shows system status section", () => {
    render(<Diagnostics />);
    expect(screen.getByText(/system status/i)).toBeInTheDocument();
  });

  it("shows device information section", () => {
    render(<Diagnostics />);
    expect(screen.getByText(/device information/i)).toBeInTheDocument();
  });

  it("shows performance metrics section", () => {
    render(<Diagnostics />);
    expect(screen.getByText(/performance metrics/i)).toBeInTheDocument();
  });

  it("shows buffer health section", () => {
    render(<Diagnostics />);
    expect(screen.getByText(/buffer health/i)).toBeInTheDocument();
  });

  it("shows error log section", () => {
    render(<Diagnostics />);
    expect(screen.getByText(/error log/i)).toBeInTheDocument();
  });
});
