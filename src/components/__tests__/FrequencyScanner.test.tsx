import { render, screen, fireEvent } from "@testing-library/react";
import FrequencyScanner from "../FrequencyScanner";
import { FrequencyScannerState, ScanConfig } from "../../hooks/useFrequencyScanner";

describe("FrequencyScanner", () => {
  const mockState: FrequencyScannerState = {
    status: "idle",
    currentFrequency: 0,
    progress: 0,
    activeSignals: [],
    config: {
      startFrequency: 88.1e6,
      endFrequency: 107.9e6,
      stepSize: 0.2e6,
      dwellTime: 100,
      signalThreshold: -60,
    },
  };

  const mockHandlers = {
    onStartScan: jest.fn(),
    onPauseScan: jest.fn(),
    onResumeScan: jest.fn(),
    onStopScan: jest.fn(),
    onClearSignals: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render frequency scanner controls", () => {
    render(
      <FrequencyScanner
        state={mockState}
        {...mockHandlers}
        signalType="FM"
        disabled={false}
      />,
    );

    expect(screen.getByLabelText("Scan start frequency")).toBeInTheDocument();
    expect(screen.getByLabelText("Scan end frequency")).toBeInTheDocument();
    expect(screen.getByLabelText("Scan step size")).toBeInTheDocument();
    expect(screen.getByLabelText("Dwell time per frequency")).toBeInTheDocument();
    expect(screen.getByLabelText("Signal detection threshold")).toBeInTheDocument();
  });

  it("should render Start Scan button when idle", () => {
    render(
      <FrequencyScanner
        state={mockState}
        {...mockHandlers}
        signalType="FM"
        disabled={false}
      />,
    );

    const startButton = screen.getByLabelText("Start frequency scan");
    expect(startButton).toBeInTheDocument();
    expect(startButton).not.toBeDisabled();
  });

  it("should call onStartScan when Start Scan is clicked", () => {
    render(
      <FrequencyScanner
        state={mockState}
        {...mockHandlers}
        signalType="FM"
        disabled={false}
      />,
    );

    const startButton = screen.getByLabelText("Start frequency scan");
    fireEvent.click(startButton);

    expect(mockHandlers.onStartScan).toHaveBeenCalledTimes(1);
    expect(mockHandlers.onStartScan).toHaveBeenCalledWith(
      expect.objectContaining({
        startFrequency: expect.any(Number),
        endFrequency: expect.any(Number),
        stepSize: expect.any(Number),
        dwellTime: expect.any(Number),
        signalThreshold: expect.any(Number),
      }),
    );
  });

  it("should disable controls when scanning", () => {
    const scanningState = { ...mockState, status: "scanning" as const };
    render(
      <FrequencyScanner
        state={scanningState}
        {...mockHandlers}
        signalType="FM"
        disabled={false}
      />,
    );

    expect(screen.getByLabelText("Scan start frequency")).toBeDisabled();
    expect(screen.getByLabelText("Scan end frequency")).toBeDisabled();
  });

  it("should show progress when scanning", () => {
    const scanningState = {
      ...mockState,
      status: "scanning" as const,
      currentFrequency: 95e6,
      progress: 50,
    };
    render(
      <FrequencyScanner
        state={scanningState}
        {...mockHandlers}
        signalType="FM"
        disabled={false}
      />,
    );

    expect(screen.getByText(/Progress: 50%/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("should display active signals", () => {
    const stateWithSignals = {
      ...mockState,
      activeSignals: [
        { frequency: 95.5e6, signalStrength: -45, timestamp: Date.now() },
        { frequency: 100.3e6, signalStrength: -50, timestamp: Date.now() },
      ],
    };
    render(
      <FrequencyScanner
        state={stateWithSignals}
        {...mockHandlers}
        signalType="FM"
        disabled={false}
      />,
    );

    expect(screen.getByText(/95.50 MHz/)).toBeInTheDocument();
    expect(screen.getByText(/100.30 MHz/)).toBeInTheDocument();
    expect(screen.getByText(/-45.0 dBm/)).toBeInTheDocument();
    expect(screen.getByText(/-50.0 dBm/)).toBeInTheDocument();
  });

  it("should show no signals message when list is empty", () => {
    render(
      <FrequencyScanner
        state={mockState}
        {...mockHandlers}
        signalType="FM"
        disabled={false}
      />,
    );

    expect(
      screen.getByText("No active signals detected above threshold"),
    ).toBeInTheDocument();
  });

  it("should call onClearSignals when Clear button is clicked", () => {
    const stateWithSignals = {
      ...mockState,
      activeSignals: [
        { frequency: 95.5e6, signalStrength: -45, timestamp: Date.now() },
      ],
    };
    render(
      <FrequencyScanner
        state={stateWithSignals}
        {...mockHandlers}
        signalType="FM"
        disabled={false}
      />,
    );

    const clearButton = screen.getByLabelText("Clear active signals list");
    fireEvent.click(clearButton);

    expect(mockHandlers.onClearSignals).toHaveBeenCalledTimes(1);
  });

  it("should show pause button when scanning", () => {
    const scanningState = { ...mockState, status: "scanning" as const };
    render(
      <FrequencyScanner
        state={scanningState}
        {...mockHandlers}
        signalType="FM"
        disabled={false}
      />,
    );

    expect(screen.getByLabelText("Pause frequency scan")).toBeInTheDocument();
  });

  it("should show resume and stop buttons when paused", () => {
    const pausedState = { ...mockState, status: "paused" as const };
    render(
      <FrequencyScanner
        state={pausedState}
        {...mockHandlers}
        signalType="FM"
        disabled={false}
      />,
    );

    expect(screen.getByLabelText("Resume frequency scan")).toBeInTheDocument();
    expect(screen.getByLabelText("Stop frequency scan")).toBeInTheDocument();
  });

  it("should format AM frequencies in kHz", () => {
    const amConfig = {
      startFrequency: 530e3,
      endFrequency: 1700e3,
      stepSize: 10e3,
      dwellTime: 100,
      signalThreshold: -70,
    };
    const amState = { ...mockState, config: amConfig };
    render(
      <FrequencyScanner
        state={amState}
        {...mockHandlers}
        signalType="AM"
        disabled={false}
      />,
    );

    expect(screen.getByLabelText("Scan start frequency")).toHaveValue(530);
    expect(screen.getByLabelText("Scan end frequency")).toHaveValue(1700);
  });

  it("should format FM frequencies in MHz", () => {
    render(
      <FrequencyScanner
        state={mockState}
        {...mockHandlers}
        signalType="FM"
        disabled={false}
      />,
    );

    expect(screen.getByLabelText("Scan start frequency")).toHaveValue(88.1);
    expect(screen.getByLabelText("Scan end frequency")).toHaveValue(107.9);
  });

  it("should be disabled when disabled prop is true", () => {
    render(
      <FrequencyScanner
        state={mockState}
        {...mockHandlers}
        signalType="FM"
        disabled={true}
      />,
    );

    expect(screen.getByLabelText("Start frequency scan")).toBeDisabled();
  });
});
