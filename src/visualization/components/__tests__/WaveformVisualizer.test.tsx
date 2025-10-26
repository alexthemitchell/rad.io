import { render } from "@testing-library/react";
import WaveformVisualizer from "../WaveformVisualizer";
import {
  createTestSamples,
  createMockCanvasContext,
  restoreDevicePixelRatio,
} from "../../../utils/testHelpers";

describe("WaveformVisualizer", () => {
  const createSamples = (count: number) => createTestSamples(count, "sine");

  beforeEach(() => {
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = jest.fn(() =>
      createMockCanvasContext(),
    ) as jest.Mock;
  });

  it("should render canvas element", () => {
    const samples = createSamples(100);
    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should set canvas dimensions", () => {
    const samples = createSamples(50);
    const width = 600;
    const height = 400;

    const { container } = render(
      <WaveformVisualizer samples={samples} width={width} height={height} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveStyle({
      width: `${width}px`,
      height: `${height}px`,
    });
  });

  it("should use default dimensions when not provided", () => {
    const samples = createSamples(50);
    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveStyle({
      width: "750px",
      height: "300px",
    });
  });

  it("should handle empty samples array", () => {
    const { container } = render(<WaveformVisualizer samples={[]} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should render with small sample count", () => {
    const samples = createSamples(10);
    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should render with large sample count", () => {
    const samples = createSamples(10000);
    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle varying amplitude samples", () => {
    const samples = createSamples(100).map((s, i) => ({
      I: s.I * (i / 100), // Varying amplitude
      Q: s.Q * (i / 100),
    }));

    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle constant amplitude samples", () => {
    const samples = Array.from({ length: 100 }, () => ({
      I: 0.5,
      Q: 0.5,
    }));

    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle zero amplitude samples", () => {
    const samples = Array.from({ length: 100 }, () => ({
      I: 0,
      Q: 0,
    }));

    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle negative amplitude samples", () => {
    const samples = createSamples(100).map((s) => ({
      I: -Math.abs(s.I),
      Q: -Math.abs(s.Q),
    }));

    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle mixed positive and negative amplitudes", () => {
    const samples = createSamples(100);
    // Already has mixed positive/negative from sine/cosine

    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should set high-DPI canvas dimensions", () => {
    const originalDPR = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", {
      writable: true,
      configurable: true,
      value: 2,
    });

    try {
      const samples = createSamples(100);
      const width = 750;
      const height = 300;

      const { container } = render(
        <WaveformVisualizer samples={samples} width={width} height={height} />,
      );

      const canvas = container.querySelector("canvas") as HTMLCanvasElement;
      expect(canvas.width).toBe(width * 2); // DPR * width
      expect(canvas.height).toBe(height * 2); // DPR * height
    } finally {
      // Restore original DPR
      restoreDevicePixelRatio(originalDPR);
    }
  });

  it("should handle continueInBackground prop", () => {
    const samples = createSamples(100);

    const { container } = render(
      <WaveformVisualizer samples={samples} continueInBackground={true} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should update when samples change", () => {
    const samples1 = createSamples(50);
    const { container, rerender } = render(
      <WaveformVisualizer samples={samples1} />,
    );

    const canvas1 = container.querySelector("canvas");
    expect(canvas1).toBeInTheDocument();

    // Update with different samples
    const samples2 = createSamples(100);
    rerender(<WaveformVisualizer samples={samples2} />);

    const canvas2 = container.querySelector("canvas");
    expect(canvas2).toBeInTheDocument();
  });

  it("should handle dimension changes", () => {
    const samples = createSamples(100);
    const { container, rerender } = render(
      <WaveformVisualizer samples={samples} width={600} height={400} />,
    );

    let canvas = container.querySelector("canvas");
    expect(canvas).toHaveStyle({
      width: "600px",
      height: "400px",
    });

    // Change dimensions
    rerender(<WaveformVisualizer samples={samples} width={800} height={600} />);

    canvas = container.querySelector("canvas");
    expect(canvas).toHaveStyle({
      width: "800px",
      height: "600px",
    });
  });

  it("should generate accessible description for non-empty samples", () => {
    const samples = createSamples(100);
    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    const ariaLabel = canvas?.getAttribute("aria-label");

    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toContain("Amplitude waveform");
    expect(ariaLabel).toContain("100");
    expect(ariaLabel).toContain("time-domain samples");
  });

  it("should generate accessible description for empty samples", () => {
    const { container } = render(<WaveformVisualizer samples={[]} />);

    const canvas = container.querySelector("canvas");
    const ariaLabel = canvas?.getAttribute("aria-label");

    expect(ariaLabel).toBe("No waveform data");
  });

  it("should include amplitude statistics in accessible description", () => {
    const samples = createSamples(100);
    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    const ariaLabel = canvas?.getAttribute("aria-label");

    // Should contain numeric statistics
    expect(ariaLabel).toMatch(/ranges from .+ to .+ with average/);
  });

  it("should render with extreme amplitude values", () => {
    const samples = Array.from({ length: 100 }, (_, i) => ({
      I: i % 2 === 0 ? 1.0 : -1.0, // Clipping
      Q: i % 2 === 0 ? 1.0 : -1.0,
    }));

    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle very small amplitude values", () => {
    const samples = Array.from({ length: 100 }, () => ({
      I: 0.001,
      Q: 0.001,
    }));

    const { container } = render(<WaveformVisualizer samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});
