/**
 * Tests for ATSCScanner component
 */

import { render, screen, fireEvent } from "@testing-library/react";
import ATSCScanner from "../ATSCScanner";
import type {
  ATSCScanConfig,
  ATSCScannerState,
} from "../../hooks/useATSCScanner";
import type { StoredATSCChannel } from "../../utils/atscChannelStorage";
import type { ATSCChannel } from "../../utils/atscChannels";

describe("ATSCScanner", () => {
  const mockConfig: ATSCScanConfig = {
    scanVHFLow: true,
    scanVHFHigh: true,
    scanUHF: true,
    thresholdDb: 15,
    dwellTime: 500,
    fftSize: 4096,
    requirePilot: true,
    requireSync: false,
  };

  const mockChannel: ATSCChannel = {
    channel: 7,
    frequency: 177e6,
    lowerEdge: 174e6,
    upperEdge: 180e6,
    pilotFrequency: 174e6 + 309440,
    band: "VHF-High",
  };

  const mockFoundChannel: StoredATSCChannel = {
    channel: mockChannel,
    strength: 0.8,
    snr: 25,
    mer: 30,
    pilotDetected: true,
    syncLocked: true,
    segmentSyncCount: 10,
    fieldSyncCount: 1,
    discoveredAt: new Date("2025-01-01T12:00:00Z"),
    lastScanned: new Date("2025-01-01T12:00:00Z"),
    scanCount: 1,
  };

  const mockProps = {
    state: "idle" as ATSCScannerState,
    config: mockConfig,
    currentChannel: null,
    progress: 0,
    foundChannels: [],
    onStartScan: jest.fn(),
    onPauseScan: jest.fn(),
    onResumeScan: jest.fn(),
    onStopScan: jest.fn(),
    onConfigChange: jest.fn(),
    onClearChannels: jest.fn(),
    onExportChannels: jest.fn(),
    deviceAvailable: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      render(<ATSCScanner {...mockProps} />);
      expect(screen.getByText("ATSC Channel Scanner")).toBeInTheDocument();
    });

    it("should render description", () => {
      render(<ATSCScanner {...mockProps} />);
      expect(
        screen.getByText(/Scan VHF and UHF frequencies/),
      ).toBeInTheDocument();
    });

    it("should render band selection checkboxes", () => {
      render(<ATSCScanner {...mockProps} />);
      expect(screen.getByText(/VHF-Low.*2-6.*54-88 MHz/)).toBeInTheDocument();
      expect(
        screen.getByText(/VHF-High.*7-13.*174-216 MHz/),
      ).toBeInTheDocument();
      expect(screen.getByText(/UHF.*14-36.*470-608 MHz/)).toBeInTheDocument();
    });

    it("should render detection settings", () => {
      render(<ATSCScanner {...mockProps} />);
      expect(screen.getByLabelText(/Threshold/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Dwell Time/)).toBeInTheDocument();
      expect(
        screen.getByText(/Require pilot tone detection/),
      ).toBeInTheDocument();
      expect(screen.getByText(/Require sync lock/)).toBeInTheDocument();
    });
  });

  describe("Idle State", () => {
    it("should show Start Scan button when idle", () => {
      render(<ATSCScanner {...mockProps} />);
      const button = screen.getByText("Start Scan");
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it("should disable Start Scan when device unavailable", () => {
      render(<ATSCScanner {...mockProps} deviceAvailable={false} />);
      const button = screen.getByText("Start Scan");
      expect(button).toBeDisabled();
    });

    it("should disable Start Scan when no bands selected", () => {
      const config = {
        ...mockConfig,
        scanVHFLow: false,
        scanVHFHigh: false,
        scanUHF: false,
      };
      render(<ATSCScanner {...mockProps} config={config} />);
      const button = screen.getByText("Start Scan");
      expect(button).toBeDisabled();
    });

    it("should call onStartScan when Start button clicked", () => {
      render(<ATSCScanner {...mockProps} />);

      fireEvent.click(screen.getByText("Start Scan"));
      expect(mockProps.onStartScan).toHaveBeenCalledTimes(1);
    });

    it("should allow config changes when idle", () => {
      render(<ATSCScanner {...mockProps} />);
      const thresholdInput = screen.getByLabelText(/Threshold/);
      expect(thresholdInput).not.toBeDisabled();
    });
  });

  describe("Scanning State", () => {
    it("should show Pause and Stop buttons when scanning", () => {
      render(<ATSCScanner {...mockProps} state="scanning" />);
      expect(screen.getByText("Pause")).toBeInTheDocument();
      expect(screen.getByText("Stop")).toBeInTheDocument();
      expect(screen.queryByText("Start Scan")).not.toBeInTheDocument();
    });

    it("should show progress bar when scanning", () => {
      render(
        <ATSCScanner
          {...mockProps}
          state="scanning"
          currentChannel={mockChannel}
          progress={45}
        />,
      );
      expect(screen.getByText(/Scanning.*Ch 7.*45\.0%/)).toBeInTheDocument();
    });

    it("should disable config inputs when scanning", () => {
      render(<ATSCScanner {...mockProps} state="scanning" />);
      const thresholdInput = screen.getByLabelText(/Threshold/);
      expect(thresholdInput).toBeDisabled();
    });

    it("should call onPauseScan when Pause clicked", () => {
      render(<ATSCScanner {...mockProps} state="scanning" />);

      fireEvent.click(screen.getByText("Pause"));
      expect(mockProps.onPauseScan).toHaveBeenCalledTimes(1);
    });

    it("should call onStopScan when Stop clicked", () => {
      render(<ATSCScanner {...mockProps} state="scanning" />);

      fireEvent.click(screen.getByText("Stop"));
      expect(mockProps.onStopScan).toHaveBeenCalledTimes(1);
    });
  });

  describe("Paused State", () => {
    it("should show Resume and Stop buttons when paused", () => {
      render(<ATSCScanner {...mockProps} state="paused" />);
      expect(screen.getByText("Resume")).toBeInTheDocument();
      expect(screen.getByText("Stop")).toBeInTheDocument();
      expect(screen.queryByText("Start Scan")).not.toBeInTheDocument();
    });

    it("should show progress bar when paused", () => {
      render(
        <ATSCScanner
          {...mockProps}
          state="paused"
          currentChannel={mockChannel}
          progress={45}
        />,
      );
      expect(screen.getByText(/Scanning.*Ch 7.*45\.0%/)).toBeInTheDocument();
    });

    it("should call onResumeScan when Resume clicked", () => {
      render(<ATSCScanner {...mockProps} state="paused" />);

      fireEvent.click(screen.getByText("Resume"));
      expect(mockProps.onResumeScan).toHaveBeenCalledTimes(1);
    });
  });

  describe("Configuration", () => {
    it("should handle band selection changes", () => {
      render(<ATSCScanner {...mockProps} />);

      const vhfLowCheckbox = screen.getByRole("checkbox", {
        name: /VHF-Low/,
      });
      fireEvent.click(vhfLowCheckbox);

      expect(mockProps.onConfigChange).toHaveBeenCalledWith({
        scanVHFLow: false,
      });
    });

    it("should handle threshold changes", () => {
      render(<ATSCScanner {...mockProps} />);

      const thresholdInput = screen.getByLabelText(
        /Threshold/,
      ) as HTMLInputElement;
      fireEvent.change(thresholdInput, { target: { value: "20" } });

      expect(mockProps.onConfigChange).toHaveBeenCalledWith({
        thresholdDb: 20,
      });
    });

    it("should handle dwell time changes", () => {
      render(<ATSCScanner {...mockProps} />);

      const dwellInput = screen.getByLabelText(
        /Dwell Time/,
      ) as HTMLInputElement;
      fireEvent.change(dwellInput, { target: { value: "1000" } });

      expect(mockProps.onConfigChange).toHaveBeenCalledWith({
        dwellTime: 1000,
      });
    });

    it("should handle pilot detection requirement toggle", () => {
      render(<ATSCScanner {...mockProps} />);

      const pilotCheckbox = screen.getByRole("checkbox", {
        name: /Require pilot tone detection/,
      });
      fireEvent.click(pilotCheckbox);

      expect(mockProps.onConfigChange).toHaveBeenCalledWith({
        requirePilot: false,
      });
    });

    it("should handle sync requirement toggle", () => {
      render(<ATSCScanner {...mockProps} />);

      const syncCheckbox = screen.getByRole("checkbox", {
        name: /Require sync lock/,
      });
      fireEvent.click(syncCheckbox);

      expect(mockProps.onConfigChange).toHaveBeenCalledWith({
        requireSync: true,
      });
    });
  });

  describe("Found Channels", () => {
    it("should show empty state when no channels found", () => {
      render(<ATSCScanner {...mockProps} />);
      expect(
        screen.getByText(/No ATSC channels detected yet/),
      ).toBeInTheDocument();
    });

    it("should display found channels count", () => {
      render(
        <ATSCScanner
          {...mockProps}
          foundChannels={[mockFoundChannel, mockFoundChannel]}
        />,
      );
      expect(screen.getByText("Found Channels (2)")).toBeInTheDocument();
    });

    it("should display channel information", () => {
      render(<ATSCScanner {...mockProps} foundChannels={[mockFoundChannel]} />);
      expect(screen.getByText("7")).toBeInTheDocument(); // Channel number
      expect(screen.getByText("177.0 MHz")).toBeInTheDocument();
      expect(screen.getByText("VHF-High")).toBeInTheDocument();
      expect(screen.getByText("25.0 dB")).toBeInTheDocument(); // SNR
    });

    it("should display signal quality info", () => {
      render(<ATSCScanner {...mockProps} foundChannels={[mockFoundChannel]} />);
      expect(
        screen.getByText(/Pilot.*Sync.*MER: 30\.0 dB/),
      ).toBeInTheDocument();
    });

    it("should show Export button when channels exist", () => {
      render(<ATSCScanner {...mockProps} foundChannels={[mockFoundChannel]} />);
      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    it("should show Clear button when channels exist", () => {
      render(<ATSCScanner {...mockProps} foundChannels={[mockFoundChannel]} />);
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });

    it("should call onExportChannels when Export clicked", () => {
      render(<ATSCScanner {...mockProps} foundChannels={[mockFoundChannel]} />);

      fireEvent.click(screen.getByText("Export"));
      expect(mockProps.onExportChannels).toHaveBeenCalledTimes(1);
    });

    it("should call onClearChannels when Clear clicked", () => {
      render(<ATSCScanner {...mockProps} foundChannels={[mockFoundChannel]} />);

      fireEvent.click(screen.getByText("Clear"));
      expect(mockProps.onClearChannels).toHaveBeenCalledTimes(1);
    });

    it("should sort channels by strength", () => {
      const weakChannel = { ...mockFoundChannel, strength: 0.3 };
      const strongChannel = { ...mockFoundChannel, strength: 0.9 };

      render(
        <ATSCScanner
          {...mockProps}
          foundChannels={[weakChannel, strongChannel]}
        />,
      );

      const strengthCells = screen.getAllByText(/\d+%/);
      expect(strengthCells[0]).toHaveTextContent("90%"); // Strong first
      expect(strengthCells[1]).toHaveTextContent("30%");
    });
  });

  describe("Tune to Channel", () => {
    it("should show Tune button when callback provided", () => {
      const onTuneToChannel = jest.fn();
      render(
        <ATSCScanner
          {...mockProps}
          foundChannels={[mockFoundChannel]}
          onTuneToChannel={onTuneToChannel}
        />,
      );
      expect(screen.getByText("Tune")).toBeInTheDocument();
    });

    it("should not show Tune button when callback not provided", () => {
      render(<ATSCScanner {...mockProps} foundChannels={[mockFoundChannel]} />);
      expect(screen.queryByText("Tune")).not.toBeInTheDocument();
    });

    it("should call onTuneToChannel with frequency", () => {
      const onTuneToChannel = jest.fn();
      render(
        <ATSCScanner
          {...mockProps}
          foundChannels={[mockFoundChannel]}
          onTuneToChannel={onTuneToChannel}
        />,
      );

      fireEvent.click(screen.getByText("Tune"));
      expect(onTuneToChannel).toHaveBeenCalledWith(177e6);
    });
  });

  describe("Accessibility", () => {
    it("should have accessible labels for inputs", () => {
      render(<ATSCScanner {...mockProps} />);
      expect(screen.getByLabelText(/Threshold/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Dwell Time/)).toBeInTheDocument();
    });

    it("should have meaningful button titles", () => {
      render(<ATSCScanner {...mockProps} />);
      const startButton = screen.getByTitle("Start ATSC channel scan");
      expect(startButton).toBeInTheDocument();
    });

    it("should show disabled state reason in title", () => {
      render(<ATSCScanner {...mockProps} deviceAvailable={false} />);
      const button = screen.getByTitle("Device not available");
      expect(button).toBeInTheDocument();
    });
  });
});
