import { render, screen, fireEvent } from "@testing-library/react";
import FrequencyScanner from "../FrequencyScanner";
import { type ActiveSignal } from "../../hooks/useFrequencyScanner";

describe("FrequencyScanner", () => {
  const mockHandlers = {
    onStartScan: jest.fn(),
    onPauseScan: jest.fn(),
    onResumeScan: jest.fn(),
    onStopScan: jest.fn(),
    onConfigChange: jest.fn(),
    onClearSignals: jest.fn(),
  };

  const defaultConfig = {
    startFrequency: 88e6,
    endFrequency: 108e6,
    thresholdDb: 10,
    dwellTime: 50,
    fftSize: 2048,
    minPeakSpacing: 100e3,
  };

  const mockSignals: ActiveSignal[] = [
    {
      frequency: 100.3e6,
      strength: 0.75,
      timestamp: new Date("2024-01-01T12:00:00Z"),
    },
    {
      frequency: 95.5e6,
      strength: 0.45,
      timestamp: new Date("2024-01-01T12:00:01Z"),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders frequency scanner title", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={[]}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("Frequency Scanner")).toBeInTheDocument();
    });

    it("renders configuration inputs", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={[]}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByLabelText(/Start Frequency/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Frequency/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/FFT Size/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Detection Threshold/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Dwell Time/i)).toBeInTheDocument();
    });

    it("displays start scan button when idle", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={[]}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("Start Scan")).toBeInTheDocument();
    });
  });

  describe("Scanning States", () => {
    it("shows pause and stop buttons when scanning", () => {
      render(
        <FrequencyScanner
          state="scanning"
          config={defaultConfig}
          currentFrequency={100e6}
          activeSignals={[]}
          progress={50}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("Pause")).toBeInTheDocument();
      expect(screen.getByText("Stop")).toBeInTheDocument();
      expect(screen.queryByText("Start Scan")).not.toBeInTheDocument();
    });

    it("shows resume and stop buttons when paused", () => {
      render(
        <FrequencyScanner
          state="paused"
          config={defaultConfig}
          currentFrequency={100e6}
          activeSignals={[]}
          progress={50}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("Resume")).toBeInTheDocument();
      expect(screen.getByText("Stop")).toBeInTheDocument();
      expect(screen.queryByText("Start Scan")).not.toBeInTheDocument();
    });

    it("displays progress bar when scanning", () => {
      render(
        <FrequencyScanner
          state="scanning"
          config={defaultConfig}
          currentFrequency={100.3e6}
          activeSignals={[]}
          progress={75}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText(/Scanning: 100.300 MHz/)).toBeInTheDocument();
      expect(screen.getByText(/75.0%/)).toBeInTheDocument();
    });
  });

  describe("Configuration Changes", () => {
    it("calls onConfigChange when start frequency is updated", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={[]}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      const startFreqInput = screen.getByLabelText(/Start Frequency/i);
      fireEvent.change(startFreqInput, { target: { value: "90" } });

      expect(mockHandlers.onConfigChange).toHaveBeenCalledWith({
        startFrequency: 90e6,
      });
    });

    it("calls onConfigChange when end frequency is updated", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={[]}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      const endFreqInput = screen.getByLabelText(/End Frequency/i);
      fireEvent.change(endFreqInput, { target: { value: "110" } });

      expect(mockHandlers.onConfigChange).toHaveBeenCalledWith({
        endFrequency: 110e6,
      });
    });

    it("calls onConfigChange when threshold (dB) is adjusted", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={[]}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      const thresholdInput = screen.getByLabelText(/Detection Threshold/i);
      fireEvent.change(thresholdInput, { target: { value: "15" } });

      expect(mockHandlers.onConfigChange).toHaveBeenCalledWith({
        thresholdDb: 15,
      });
    });

    it("disables configuration inputs when scanning", () => {
      render(
        <FrequencyScanner
          state="scanning"
          config={defaultConfig}
          currentFrequency={100e6}
          activeSignals={[]}
          progress={50}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      const startFreqInput = screen.getByLabelText(
        /Start Frequency/i,
      ) as HTMLInputElement;
      expect(startFreqInput.disabled).toBe(true);
    });
  });

  describe("Control Actions", () => {
    it("calls onStartScan when start button is clicked", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={[]}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      const startButton = screen.getByText("Start Scan");
      fireEvent.click(startButton);

      expect(mockHandlers.onStartScan).toHaveBeenCalledTimes(1);
    });

    it("calls onPauseScan when pause button is clicked", () => {
      render(
        <FrequencyScanner
          state="scanning"
          config={defaultConfig}
          currentFrequency={100e6}
          activeSignals={[]}
          progress={50}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      const pauseButton = screen.getByText("Pause");
      fireEvent.click(pauseButton);

      expect(mockHandlers.onPauseScan).toHaveBeenCalledTimes(1);
    });

    it("calls onResumeScan when resume button is clicked", () => {
      render(
        <FrequencyScanner
          state="paused"
          config={defaultConfig}
          currentFrequency={100e6}
          activeSignals={[]}
          progress={50}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      const resumeButton = screen.getByText("Resume");
      fireEvent.click(resumeButton);

      expect(mockHandlers.onResumeScan).toHaveBeenCalledTimes(1);
    });

    it("calls onStopScan when stop button is clicked during scanning", () => {
      render(
        <FrequencyScanner
          state="scanning"
          config={defaultConfig}
          currentFrequency={100e6}
          activeSignals={[]}
          progress={50}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      const stopButton = screen.getByText("Stop");
      fireEvent.click(stopButton);

      expect(mockHandlers.onStopScan).toHaveBeenCalledTimes(1);
    });

    it("disables start button when device is not available", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={[]}
          progress={0}
          deviceAvailable={false}
          {...mockHandlers}
        />,
      );

      const startButton = screen.getByText("Start Scan") as HTMLButtonElement;
      expect(startButton.disabled).toBe(true);
    });
  });

  describe("Active Signals Display", () => {
    it("shows empty state when no signals detected", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={[]}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(
        screen.getByText(/No active signals detected yet/i),
      ).toBeInTheDocument();
    });

    it("displays signal count", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={mockSignals}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText(/Active Signals \(2\)/)).toBeInTheDocument();
    });

    it("displays signal frequencies and strengths", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={mockSignals}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("100.300 MHz")).toBeInTheDocument();
      expect(screen.getByText("95.500 MHz")).toBeInTheDocument();
      expect(screen.getByText("75.0%")).toBeInTheDocument();
      expect(screen.getByText("45.0%")).toBeInTheDocument();
    });

    it("sorts signals by strength in descending order", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={mockSignals}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      const rows = screen.getAllByRole("row");
      // First row is header, second should be strongest signal (100.3 MHz @ 75%)
      expect(rows[1]).toHaveTextContent("100.300 MHz");
      expect(rows[1]).toHaveTextContent("75.0%");
      // Third row should be second strongest (95.5 MHz @ 45%)
      expect(rows[2]).toHaveTextContent("95.500 MHz");
      expect(rows[2]).toHaveTextContent("45.0%");
    });

    it("shows export and clear buttons when signals exist", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={mockSignals}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("Export")).toBeInTheDocument();
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });

    it("calls onClearSignals when clear button is clicked", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={mockSignals}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      const clearButton = screen.getByText("Clear");
      fireEvent.click(clearButton);

      expect(mockHandlers.onClearSignals).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("has proper labels for all inputs", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={[]}
          progress={0}
          deviceAvailable={true}
          {...mockHandlers}
        />,
      );

      const startFreqInput = screen.getByLabelText(/Start Frequency/i);
      expect(startFreqInput).toHaveAttribute("id", "start-freq");

      const endFreqInput = screen.getByLabelText(/End Frequency/i);
      expect(endFreqInput).toHaveAttribute("id", "end-freq");

      const fftSizeInput = screen.getByLabelText(/FFT Size/i);
      expect(fftSizeInput).toHaveAttribute("id", "fft-size");

      const thresholdInput = screen.getByLabelText(/Detection Threshold/i);
      expect(thresholdInput).toHaveAttribute("id", "threshold");

      const dwellInput = screen.getByLabelText(/Dwell Time/i);
      expect(dwellInput).toHaveAttribute("id", "dwell-time");
    });

    it("provides descriptive titles for buttons", () => {
      render(
        <FrequencyScanner
          state="idle"
          config={defaultConfig}
          currentFrequency={null}
          activeSignals={[]}
          progress={0}
          deviceAvailable={false}
          {...mockHandlers}
        />,
      );

      const startButton = screen.getByText("Start Scan");
      expect(startButton).toHaveAttribute("title", "Device not available");
    });
  });
});
