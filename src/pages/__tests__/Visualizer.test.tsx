import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Visualizer from "../Visualizer";

// Mock the hooks
jest.mock("../../hooks/useHackRFDevice");
jest.mock("../../hooks/useFrequencyScanner");

// Mock all the complex components
jest.mock("../../components/DeviceControlBar", () => ({
  __esModule: true,
  default: () => <div data-testid="device-control-bar">DeviceControlBar</div>,
}));

jest.mock("../../components/AudioControls", () => ({
  __esModule: true,
  default: () => <div data-testid="audio-controls">AudioControls</div>,
}));

jest.mock("../../components/BandwidthSelector", () => ({
  __esModule: true,
  default: () => <div data-testid="bandwidth-selector">BandwidthSelector</div>,
}));

jest.mock("../../components/FFTChart", () => ({
  __esModule: true,
  default: () => <div data-testid="fft-chart">FFTChart</div>,
}));

jest.mock("../../components/FrequencyScanner", () => ({
  __esModule: true,
  default: () => <div data-testid="frequency-scanner">FrequencyScanner</div>,
}));

jest.mock("../../components/InteractiveDSPPipeline", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="interactive-dsp-pipeline">InteractiveDSPPipeline</div>
  ),
}));

jest.mock("../../components/P25SystemPresets", () => ({
  __esModule: true,
  default: () => <div data-testid="p25-system-presets">P25SystemPresets</div>,
}));

jest.mock("../../components/PerformanceMetrics", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="performance-metrics">PerformanceMetrics</div>
  ),
}));

jest.mock("../../components/PresetStations", () => ({
  __esModule: true,
  default: () => <div data-testid="preset-stations">PresetStations</div>,
}));

jest.mock("../../components/RadioControls", () => ({
  __esModule: true,
  default: () => <div data-testid="radio-controls">RadioControls</div>,
}));

jest.mock("../../components/RDSDisplay", () => ({
  __esModule: true,
  default: () => <div data-testid="rds-display">RDSDisplay</div>,
}));

jest.mock("../../components/RecordingControls", () => ({
  __esModule: true,
  default: () => <div data-testid="recording-controls">RecordingControls</div>,
}));

jest.mock("../../components/SampleChart", () => ({
  __esModule: true,
  default: () => <div data-testid="sample-chart">SampleChart</div>,
}));

jest.mock("../../components/SignalStrengthMeterChart", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="signal-strength-meter-chart">
      SignalStrengthMeterChart
    </div>
  ),
}));

jest.mock("../../components/SignalTypeSelector", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="signal-type-selector">SignalTypeSelector</div>
  ),
}));

jest.mock("../../components/TalkgroupScanner", () => ({
  __esModule: true,
  default: () => <div data-testid="talkgroup-scanner">TalkgroupScanner</div>,
}));

jest.mock("../../components/TalkgroupStatus", () => ({
  __esModule: true,
  default: () => <div data-testid="talkgroup-status">TalkgroupStatus</div>,
}));

jest.mock("../../components/TrunkedRadioControls", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="trunked-radio-controls">TrunkedRadioControls</div>
  ),
}));

jest.mock("../../components/WaveformChart", () => ({
  __esModule: true,
  default: () => <div data-testid="waveform-chart">WaveformChart</div>,
}));

jest.mock("../../components/Card", () => ({
  __esModule: true,
  default: ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="card">
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  ),
}));

// Mock the audio stream processor
jest.mock("../../utils/audioStream", () => ({
  AudioStreamProcessor: jest.fn().mockImplementation(() => ({
    extractAudio: jest.fn(),
    reset: jest.fn(),
    cleanup: jest.fn(),
  })),
  DemodulationType: {
    FM: "FM",
    AM: "AM",
    USB: "USB",
    LSB: "LSB",
  },
}));

// Mock the IQ recorder utilities
jest.mock("../../utils/iqRecorder", () => ({
  IQRecorder: jest.fn().mockImplementation(() => ({
    addSamples: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  })),
  IQPlayback: jest.fn().mockImplementation(() => ({
    getSamples: jest.fn().mockReturnValue([]),
    reset: jest.fn(),
  })),
  downloadRecording: jest.fn(),
}));

// Mock performance monitor
jest.mock("../../utils/performanceMonitor", () => ({
  performanceMonitor: {
    mark: jest.fn(),
    measure: jest.fn(),
    getFPS: jest.fn(() => 60),
  },
}));

// Mock AudioContext
global.AudioContext = jest.fn().mockImplementation(() => ({
  createGain: jest.fn().mockReturnValue({
    connect: jest.fn(),
    gain: { value: 0.5 },
  }),
  createBufferSource: jest.fn().mockReturnValue({
    buffer: null,
    connect: jest.fn(),
    start: jest.fn(),
  }),
  createBuffer: jest.fn(),
  destination: {},
  resume: jest.fn().mockResolvedValue(undefined),
})) as any;

describe("Visualizer", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useHackRFDevice hook with a device that has isOpen and getCapabilities methods
    const { useHackRFDevice } = require("../../hooks/useHackRFDevice");
    useHackRFDevice.mockReturnValue({
      device: {
        isOpen: jest.fn().mockReturnValue(false),
        isReceiving: jest.fn().mockReturnValue(false),
        getCapabilities: jest.fn().mockReturnValue({
          supportedBandwidths: [20e6],
        }),
      },
      initialize: jest.fn(),
      cleanup: jest.fn(),
      isCheckingPaired: false,
    });

    // Mock useFrequencyScanner hook
    const { useFrequencyScanner } = require("../../hooks/useFrequencyScanner");
    useFrequencyScanner.mockReturnValue({
      state: "idle",
      config: {},
      currentFrequency: 0,
      activeSignals: [],
      progress: 0,
      startScan: jest.fn(),
      pauseScan: jest.fn(),
      resumeScan: jest.fn(),
      stopScan: jest.fn(),
      updateConfig: jest.fn(),
      clearSignals: jest.fn(),
    });
  });

  it("renders the visualizer page", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays skip link for accessibility", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(screen.getByText(/skip to main content/i)).toBeInTheDocument();
  });

  it("renders device control bar", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("device-control-bar")).toBeInTheDocument();
  });

  it("renders radio controls card", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /radio controls/i }),
    ).toBeInTheDocument();
  });

  it("renders audio playback card", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /audio playback/i }),
    ).toBeInTheDocument();
  });

  it("renders audio controls", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("audio-controls")).toBeInTheDocument();
  });

  it("renders recording controls", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("recording-controls")).toBeInTheDocument();
  });

  it("renders frequency scanner", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("frequency-scanner")).toBeInTheDocument();
  });

  it("renders interactive DSP pipeline", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("interactive-dsp-pipeline")).toBeInTheDocument();
  });

  it("renders signal strength meter card", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /signal strength meter/i }),
    ).toBeInTheDocument();
  });

  it("renders performance metrics", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("performance-metrics")).toBeInTheDocument();
  });

  it("renders signal visualizations region", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("region", { name: /signal visualizations/i }),
    ).toBeInTheDocument();
  });

  it("renders IQ constellation diagram card", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /iq constellation diagram/i }),
    ).toBeInTheDocument();
  });

  it("renders amplitude waveform card", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /amplitude waveform/i }),
    ).toBeInTheDocument();
  });

  it("renders FFT chart", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("fft-chart")).toBeInTheDocument();
  });

  it("renders spectrogram mode toggle button", () => {
    render(
      <BrowserRouter>
        <Visualizer />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("button", { name: /switch to.*mode/i }),
    ).toBeInTheDocument();
  });
});
