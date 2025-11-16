import { render, screen } from "@testing-library/react";
import ATSCPlayer from "../ATSCPlayer";
import { BrowserRouter } from "react-router-dom";

// Mock useATSCPlayer hook
jest.mock("../../hooks/useATSCPlayer", () => ({
  useATSCPlayer: jest.fn(() => ({
    playerState: "idle",
    currentChannel: null,
    programInfo: null,
    signalQuality: null,
    audioTracks: [],
    selectedAudioTrack: null,
    videoPID: null,
    closedCaptionsEnabled: false,
    volume: 1.0,
    muted: false,
    tuneToChannel: jest.fn(),
    selectAudioTrack: jest.fn(),
    setVolume: jest.fn(),
    setMuted: jest.fn(),
    toggleClosedCaptions: jest.fn(),
    stop: jest.fn(),
  })),
}));

// Mock useATSCScanner hook
jest.mock("../../hooks/useATSCScanner", () => ({
  useATSCScanner: jest.fn(() => ({
    state: "idle",
    config: {
      scanVHFLow: true,
      scanVHFHigh: true,
      scanUHF: true,
      thresholdDb: 15,
      dwellTime: 500,
      fftSize: 4096,
      requirePilot: true,
      requireSync: false,
    },
    currentChannel: null,
    progress: 0,
    foundChannels: [],
    startScan: jest.fn(),
    pauseScan: jest.fn(),
    resumeScan: jest.fn(),
    stopScan: jest.fn(),
    updateConfig: jest.fn(),
    clearChannels: jest.fn(),
    loadStoredChannels: jest.fn(),
    exportChannels: jest.fn(),
    importChannels: jest.fn(),
  })),
}));

// Mock useDevice store
jest.mock("../../store", () => ({
  useDevice: jest.fn(() => ({
    primaryDevice: null,
  })),
  useDiagnostics: jest.fn(() => ({
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
    clearDiagnosticEvents: jest.fn(),
    resetDiagnostics: jest.fn(),
    setOverlayVisible: jest.fn(),
  })),
}));

describe("ATSCPlayer", () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ATSCPlayer />
      </BrowserRouter>,
    );
  };

  it("should render the page title", () => {
    renderComponent();
    expect(screen.getByText("ATSC Digital TV Player")).toBeInTheDocument();
  });

  it("should render the show scanner button", () => {
    renderComponent();
    expect(screen.getByText("Show Scanner")).toBeInTheDocument();
  });

  it("should render the channel selector", () => {
    renderComponent();
    expect(screen.getByText("Available Channels")).toBeInTheDocument();
  });

  it("should show empty state when no channels available", () => {
    renderComponent();
    expect(
      screen.getByText(
        "No channels available. Please scan for channels first.",
      ),
    ).toBeInTheDocument();
  });

  it("should render the video player", () => {
    renderComponent();
    const canvas = document.getElementById("atsc-video-canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("width", "1280");
    expect(canvas).toHaveAttribute("height", "720");
  });

  it("should show idle status message", () => {
    renderComponent();
    expect(
      screen.getByText("Select a channel to start playback"),
    ).toBeInTheDocument();
  });

  it("should render playback controls", () => {
    renderComponent();
    expect(screen.getByText("Stop")).toBeInTheDocument();
    expect(screen.getByText("CC")).toBeInTheDocument();
  });

  it("should render program info section", () => {
    renderComponent();
    expect(screen.getByText("Program Information")).toBeInTheDocument();
  });

  it("should render signal quality section", () => {
    renderComponent();
    expect(screen.getByText("Signal Quality")).toBeInTheDocument();
  });
});
