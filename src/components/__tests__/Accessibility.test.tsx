import { render, screen, fireEvent } from "@testing-library/react";
import IQConstellation from "../../visualization/components/IQConstellation";
import Spectrogram from "../../visualization/components/Spectrogram";
import WaveformVisualizer from "../../visualization/components/WaveformVisualizer";
import RadioControls from "../RadioControls";
import SignalTypeSelector from "../SignalTypeSelector";
import PresetStations from "../PresetStations";
import Card from "../Card";
import type { Sample } from "../../utils/dsp";

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

describe("Accessibility Features", () => {
  beforeEach(() => {
    mockCanvasContext();
  });

  describe("Canvas Visualizations", () => {
    const sampleData: Sample[] = [
      { I: 0.5, Q: 0.3 },
      { I: -0.2, Q: 0.7 },
      { I: 0.1, Q: -0.4 },
    ];

    it("IQConstellation should have ARIA role and label", () => {
      const { container } = render(<IQConstellation samples={sampleData} />);
      const canvas = container.querySelector("canvas");

      expect(canvas).toHaveAttribute("role", "img");
      expect(canvas).toHaveAttribute("aria-label");
      expect(canvas?.getAttribute("aria-label")).toContain("IQ Constellation");
    });

    it("IQConstellation should provide meaningful description for screen readers", () => {
      const { container } = render(<IQConstellation samples={sampleData} />);
      const canvas = container.querySelector("canvas");
      const ariaLabel = canvas?.getAttribute("aria-label");

      expect(ariaLabel).toContain("3 signal samples");
      expect(ariaLabel).toContain("In-phase (I) component");
      expect(ariaLabel).toContain("Quadrature (Q) component");
    });

    it("IQConstellation should be keyboard focusable", () => {
      const { container } = render(<IQConstellation samples={sampleData} />);
      const canvas = container.querySelector("canvas");

      expect(canvas).toHaveAttribute("tabIndex", "0");
    });

    it("Spectrogram should have ARIA role and label", () => {
      const fftData = [
        new Float32Array([1, 2, 3, 4, 5]),
        new Float32Array([2, 3, 4, 5, 6]),
      ];
      const { container } = render(<Spectrogram fftData={fftData} />);
      const canvas = container.querySelector("canvas");

      expect(canvas).toHaveAttribute("role", "img");
      expect(canvas).toHaveAttribute("aria-label");
      expect(canvas?.getAttribute("aria-label")).toContain("Spectrogram");
    });

    it("Spectrogram should describe data range", () => {
      const fftData = [
        new Float32Array([1, 2, 3, 4, 5]),
        new Float32Array([2, 3, 4, 5, 6]),
      ];
      const { container } = render(<Spectrogram fftData={fftData} />);
      const canvas = container.querySelector("canvas");
      const ariaLabel = canvas?.getAttribute("aria-label");

      expect(ariaLabel).toContain("2 time frames");
      expect(ariaLabel).toContain("frequency bins");
    });

    it("WaveformVisualizer should have ARIA role and label", () => {
      const { container } = render(<WaveformVisualizer samples={sampleData} />);
      const canvas = container.querySelector("canvas");

      expect(canvas).toHaveAttribute("role", "img");
      expect(canvas).toHaveAttribute("aria-label");
      expect(canvas?.getAttribute("aria-label")).toContain(
        "Amplitude waveform",
      );
    });

    it("WaveformVisualizer should describe amplitude range", () => {
      const { container } = render(<WaveformVisualizer samples={sampleData} />);
      const canvas = container.querySelector("canvas");
      const ariaLabel = canvas?.getAttribute("aria-label");

      expect(ariaLabel).toContain("amplitude ranges");
      expect(ariaLabel).toContain("average");
    });

    it("Empty visualizations should provide appropriate message", () => {
      const { container: iqContainer } = render(
        <IQConstellation samples={[]} />,
      );
      const iqCanvas = iqContainer.querySelector("canvas");
      expect(iqCanvas?.getAttribute("aria-label")).toContain(
        "No IQ constellation data",
      );

      const { container: waveContainer } = render(
        <WaveformVisualizer samples={[]} />,
      );
      const waveCanvas = waveContainer.querySelector("canvas");
      expect(waveCanvas?.getAttribute("aria-label")).toContain(
        "No waveform data",
      );

      const { container: specContainer } = render(<Spectrogram fftData={[]} />);
      const specCanvas = specContainer.querySelector("canvas");
      expect(specCanvas?.getAttribute("aria-label")).toContain(
        "No spectrogram data",
      );
    });
  });

  describe("Keyboard Navigation", () => {
    it("RadioControls should support arrow key navigation", () => {
      const mockSetFrequency = jest.fn().mockResolvedValue(undefined);
      render(
        <RadioControls
          frequency={100.3e6}
          signalType="FM"
          setFrequency={mockSetFrequency}
        />,
      );

      const input = screen.getByLabelText(/Center frequency/i);

      // Arrow Up should increase frequency
      fireEvent.keyDown(input, { key: "ArrowUp" });
      // Use toBeCloseTo for floating point comparison
      expect(mockSetFrequency).toHaveBeenCalledWith(expect.closeTo(100.4e6, 0));

      mockSetFrequency.mockClear();

      // Arrow Down should decrease frequency
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(mockSetFrequency).toHaveBeenCalledWith(expect.closeTo(100.2e6, 0));
    });

    it("RadioControls should support Page Up/Down for coarse tuning", () => {
      const mockSetFrequency = jest.fn().mockResolvedValue(undefined);
      render(
        <RadioControls
          frequency={100.3e6}
          signalType="FM"
          setFrequency={mockSetFrequency}
        />,
      );

      const input = screen.getByLabelText(/Center frequency/i);

      // Page Up should increase by 1 MHz
      fireEvent.keyDown(input, { key: "PageUp" });
      expect(mockSetFrequency).toHaveBeenCalledWith(expect.closeTo(101.3e6, 0));

      mockSetFrequency.mockClear();

      // Page Down should decrease by 1 MHz
      fireEvent.keyDown(input, { key: "PageDown" });
      expect(mockSetFrequency).toHaveBeenCalledWith(expect.closeTo(99.3e6, 0));
    });

    it("RadioControls should respect min/max bounds with keyboard", () => {
      const mockSetFrequency = jest.fn().mockResolvedValue(undefined);
      render(
        <RadioControls
          frequency={107.9e6}
          signalType="FM"
          setFrequency={mockSetFrequency}
        />,
      );

      const input = screen.getByLabelText(/Center frequency/i);

      // Arrow Up at max should stay at max
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(mockSetFrequency).toHaveBeenCalledWith(107.9e6);
    });

    it("RadioControls should have descriptive aria-label", () => {
      const mockSetFrequency = jest.fn().mockResolvedValue(undefined);
      render(
        <RadioControls
          frequency={100.3e6}
          signalType="FM"
          setFrequency={mockSetFrequency}
        />,
      );

      const input = screen.getByLabelText(/Center frequency/i);
      const ariaLabel = input.getAttribute("aria-label");

      expect(ariaLabel).toContain("Center frequency");
      expect(ariaLabel).toContain("MHz");
      expect(ariaLabel).toContain("100.3");
      expect(ariaLabel).toContain("arrow keys");
    });
  });

  describe("Form Controls ARIA", () => {
    it("SignalTypeSelector buttons should have aria-pressed", () => {
      const mockOnChange = jest.fn();
      render(
        <SignalTypeSelector
          signalType="FM"
          onSignalTypeChange={mockOnChange}
        />,
      );

      const fmButton = screen.getByRole("button", { name: /FM Radio/i });
      const amButton = screen.getByRole("button", { name: /AM Radio/i });

      expect(fmButton).toHaveAttribute("aria-pressed", "true");
      expect(amButton).toHaveAttribute("aria-pressed", "false");
    });

    it("SignalTypeSelector buttons should have descriptive labels", () => {
      const mockOnChange = jest.fn();
      render(
        <SignalTypeSelector
          signalType="FM"
          onSignalTypeChange={mockOnChange}
        />,
      );

      const fmButton = screen.getByRole("button", { name: /FM Radio/i });
      expect(fmButton.getAttribute("aria-label")).toContain(
        "currently selected",
      );
    });

    it("PresetStations buttons should have aria-pressed for active station", () => {
      const mockOnSelect = jest.fn();
      render(
        <PresetStations
          signalType="FM"
          currentFrequency={88.5e6}
          onStationSelect={mockOnSelect}
        />,
      );

      const buttons = screen.getAllByRole("button");
      const nprButton = buttons.find((btn) => btn.textContent?.includes("NPR"));

      expect(nprButton).toHaveAttribute("aria-pressed", "true");
    });

    it("PresetStations buttons should have descriptive aria-labels", () => {
      const mockOnSelect = jest.fn();
      render(
        <PresetStations
          signalType="FM"
          currentFrequency={100.3e6}
          onStationSelect={mockOnSelect}
        />,
      );

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        const ariaLabel = button.getAttribute("aria-label");
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel).toContain("MHz");
      });
    });
  });

  describe("Semantic HTML", () => {
    it("Card should use section element with aria-labelledby", () => {
      const { container } = render(
        <Card title="Test Title" subtitle="Test subtitle">
          <div>Content</div>
        </Card>,
      );

      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
      expect(section).toHaveAttribute("aria-labelledby");

      const titleId = section?.getAttribute("aria-labelledby");
      const heading = container.querySelector(`#${titleId}`);
      expect(heading).toHaveTextContent("Test Title");
      expect(heading?.tagName).toBe("H2");
    });

    it("Card subtitle should use paragraph element", () => {
      const { container } = render(
        <Card title="Test Title" subtitle="Test subtitle">
          <div>Content</div>
        </Card>,
      );

      const subtitle = container.querySelector("p.card-subtitle");
      expect(subtitle).toBeInTheDocument();
      expect(subtitle).toHaveTextContent("Test subtitle");
    });
  });

  describe("Focus Management", () => {
    it("All interactive elements should be keyboard focusable", () => {
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

      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button.tabIndex).toBeGreaterThanOrEqual(0);
      });

      const inputs = container.querySelectorAll("input");
      inputs.forEach((input) => {
        expect(input.tabIndex).toBeGreaterThanOrEqual(-1);
      });
    });

    it("Canvas visualizations should be keyboard focusable", () => {
      const { container } = render(
        <IQConstellation samples={[{ I: 0, Q: 0 }]} />,
      );
      const canvas = container.querySelector("canvas");

      expect(canvas?.tabIndex).toBe(0);
    });
  });

  describe("Screen Reader Hints", () => {
    it("RadioControls should provide keyboard navigation hints", () => {
      const mockSetFrequency = jest.fn().mockResolvedValue(undefined);
      render(
        <RadioControls
          frequency={100.3e6}
          signalType="FM"
          setFrequency={mockSetFrequency}
        />,
      );

      const hint = screen.getByText(/Use arrow keys for/i);
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveClass("visually-hidden");
    });
  });
});
