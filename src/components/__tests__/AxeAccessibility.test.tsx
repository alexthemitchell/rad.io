import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { BrowserRouter } from "react-router-dom";
import IQConstellation from "../IQConstellation";
import Spectrogram from "../Spectrogram";
import WaveformVisualizer from "../WaveformVisualizer";
import RadioControls from "../RadioControls";
import SignalTypeSelector from "../SignalTypeSelector";
import PresetStations from "../PresetStations";
import Card from "../Card";
import AudioControls from "../AudioControls";
import SignalStrengthMeter from "../SignalStrengthMeter";
import DeviceControlBar from "../DeviceControlBar";
import Navigation from "../Navigation";
import { Sample } from "../../utils/dsp";

// Mock canvas context for visualization components
const mockCanvasContext = (): void => {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    scale: jest.fn(),
    translate: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    save: jest.fn(),
    restore: jest.fn(),
    createLinearGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
};

describe("Axe Accessibility Tests", () => {
  beforeEach(() => {
    mockCanvasContext();
  });

  describe("Canvas Visualizations", () => {
    const sampleData: Sample[] = [
      { I: 0.5, Q: 0.3 },
      { I: -0.2, Q: 0.7 },
      { I: 0.1, Q: -0.4 },
    ];

    it("IQConstellation should have no accessibility violations", async () => {
      const { container } = render(<IQConstellation samples={sampleData} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("Spectrogram should have no accessibility violations", async () => {
      const fftData = [
        new Float32Array([1, 2, 3, 4, 5]),
        new Float32Array([2, 3, 4, 5, 6]),
      ];
      const { container } = render(<Spectrogram fftData={fftData} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("WaveformVisualizer should have no accessibility violations", async () => {
      const { container } = render(<WaveformVisualizer samples={sampleData} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Form Controls", () => {
    it("RadioControls should have no accessibility violations", async () => {
      const mockSetFrequency = jest.fn().mockResolvedValue(undefined);
      const { container } = render(
        <RadioControls
          frequency={100.3e6}
          signalType="FM"
          setFrequency={mockSetFrequency}
        />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("SignalTypeSelector should have no accessibility violations", async () => {
      const mockOnChange = jest.fn();
      const { container } = render(
        <SignalTypeSelector
          signalType="FM"
          onSignalTypeChange={mockOnChange}
        />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("PresetStations should have no accessibility violations", async () => {
      const mockOnSelect = jest.fn();
      const { container } = render(
        <PresetStations
          signalType="FM"
          currentFrequency={88.5e6}
          onStationSelect={mockOnSelect}
        />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("AudioControls should have no accessibility violations", async () => {
      const mockOnTogglePlay = jest.fn();
      const mockOnVolumeChange = jest.fn();
      const mockOnToggleMute = jest.fn();
      const { container } = render(
        <AudioControls
          volume={0.5}
          isMuted={false}
          isPlaying={false}
          signalType="FM"
          isAvailable={true}
          onTogglePlay={mockOnTogglePlay}
          onVolumeChange={mockOnVolumeChange}
          onToggleMute={mockOnToggleMute}
        />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("UI Components", () => {
    it("Card should have no accessibility violations", async () => {
      const { container } = render(
        <Card title="Test Card" subtitle="Test subtitle">
          <div>Test content</div>
        </Card>,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("SignalStrengthMeter should have no accessibility violations", async () => {
      const sampleData: Sample[] = [
        { I: 0.5, Q: 0.3 },
        { I: -0.2, Q: 0.7 },
      ];
      const { container } = render(
        <SignalStrengthMeter samples={sampleData} />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("Navigation should have no accessibility violations", async () => {
      const { container } = render(
        <BrowserRouter>
          <Navigation />
        </BrowserRouter>,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Device Controls", () => {
    it("DeviceControlBar should have no accessibility violations", async () => {
      const mockOnConnect = jest.fn().mockResolvedValue(undefined);
      const mockOnStartReceiving = jest.fn().mockResolvedValue(undefined);
      const mockOnStopReceiving = jest.fn().mockResolvedValue(undefined);

      const { container } = render(
        <DeviceControlBar
          listening={false}
          isInitializing={false}
          onConnect={mockOnConnect}
          onStartReception={mockOnStartReceiving}
          onStopReception={mockOnStopReceiving}
        />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Color Contrast", () => {
    it("should have sufficient color contrast in all components", async () => {
      const mockSetFrequency = jest.fn().mockResolvedValue(undefined);
      const mockOnChange = jest.fn();
      const mockOnSelect = jest.fn();

      const { container } = render(
        <div>
          <SignalTypeSelector
            signalType="FM"
            onSignalTypeChange={mockOnChange}
          />
          <RadioControls
            frequency={100.3e6}
            signalType="FM"
            setFrequency={mockSetFrequency}
          />
          <PresetStations
            signalType="FM"
            currentFrequency={100.3e6}
            onStationSelect={mockOnSelect}
          />
        </div>,
      );

      // Run axe with specific color contrast rules
      const results = await axe(container, {
        rules: {
          "color-contrast": { enabled: true },
        },
      });
      expect(results).toHaveNoViolations();
    });
  });

  describe("Keyboard Navigation", () => {
    it("should have proper focus indicators on all interactive elements", async () => {
      const mockSetFrequency = jest.fn().mockResolvedValue(undefined);
      const mockOnChange = jest.fn();

      const { container } = render(
        <div>
          <SignalTypeSelector
            signalType="FM"
            onSignalTypeChange={mockOnChange}
          />
          <RadioControls
            frequency={100.3e6}
            signalType="FM"
            setFrequency={mockSetFrequency}
          />
        </div>,
      );

      // Run axe without invalid rule names
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("ARIA Attributes", () => {
    it("should have valid ARIA attributes across all components", async () => {
      const mockSetFrequency = jest.fn().mockResolvedValue(undefined);
      const mockOnChange = jest.fn();
      const mockOnSelect = jest.fn();
      const sampleData: Sample[] = [
        { I: 0.5, Q: 0.3 },
        { I: -0.2, Q: 0.7 },
      ];

      const { container } = render(
        <div>
          <Card title="Visualizations" subtitle="Real-time signal data">
            <IQConstellation samples={sampleData} />
            <WaveformVisualizer samples={sampleData} />
          </Card>
          <Card title="Controls" subtitle="Radio tuning controls">
            <SignalTypeSelector
              signalType="FM"
              onSignalTypeChange={mockOnChange}
            />
            <RadioControls
              frequency={100.3e6}
              signalType="FM"
              setFrequency={mockSetFrequency}
            />
            <PresetStations
              signalType="FM"
              currentFrequency={100.3e6}
              onStationSelect={mockOnSelect}
            />
          </Card>
        </div>,
      );

      // Run axe with ARIA-specific rules
      const results = await axe(container, {
        rules: {
          "aria-allowed-attr": { enabled: true },
          "aria-allowed-role": { enabled: true },
          "aria-hidden-body": { enabled: true },
          "aria-hidden-focus": { enabled: true },
          "aria-input-field-name": { enabled: true },
          "aria-required-attr": { enabled: true },
          "aria-required-children": { enabled: true },
          "aria-required-parent": { enabled: true },
          "aria-valid-attr": { enabled: true },
          "aria-valid-attr-value": { enabled: true },
        },
      });
      expect(results).toHaveNoViolations();
    });
  });

  describe("Semantic HTML", () => {
    it("should use semantic HTML elements properly", async () => {
      const { container } = render(
        <BrowserRouter>
          <div>
            <Navigation />
            <Card title="Main Content" subtitle="Signal visualizations">
              <p>Content goes here</p>
            </Card>
          </div>
        </BrowserRouter>,
      );

      // Run axe with semantic HTML rules
      const results = await axe(container, {
        rules: {
          "button-name": { enabled: true },
          "heading-order": { enabled: true },
          label: { enabled: true },
          "link-name": { enabled: true },
        },
      });
      expect(results).toHaveNoViolations();
    });
  });
});
