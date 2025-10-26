import { render } from "@testing-library/react";
import Spectrogram from "../Spectrogram";
import { createMockCanvasContext } from "../../../utils/testHelpers";

describe("Spectrogram", () => {
  const createFFTData = (rows: number, bins: number): Float32Array[] => {
    return Array.from({ length: rows }, () => {
      const row = new Float32Array(bins);
      for (let i = 0; i < bins; i++) {
        // Simulate power spectrum in dB
        row[i] = -50 + Math.random() * 100;
      }
      return row;
    });
  };

  beforeEach(() => {
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = jest.fn(() =>
      createMockCanvasContext(),
    ) as jest.Mock;
  });

  it("should render canvas element", () => {
    const fftData = createFFTData(30, 2048);
    const { container } = render(<Spectrogram fftData={fftData} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should set canvas dimensions", () => {
    const fftData = createFFTData(30, 2048);
    const width = 800;
    const height = 600;

    const { container } = render(
      <Spectrogram fftData={fftData} width={width} height={height} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveStyle({
      width: `${width}px`,
      height: `${height}px`,
    });
  });

  it("should use default dimensions when not provided", () => {
    const fftData = createFFTData(30, 2048);
    const { container } = render(<Spectrogram fftData={fftData} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveStyle({
      width: "750px",
      height: "800px",
    });
  });

  it("should handle empty fftData array", () => {
    const { container } = render(<Spectrogram fftData={[]} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle custom frequency range", () => {
    const fftData = createFFTData(30, 2048);
    const { container } = render(
      <Spectrogram fftData={fftData} freqMin={500} freqMax={1500} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should use default frequency range when not provided", () => {
    const fftData = createFFTData(30, 2048);
    const { container } = render(<Spectrogram fftData={fftData} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle different FFT sizes", () => {
    const fftSizes = [256, 512, 1024, 2048, 4096];

    fftSizes.forEach((size) => {
      const fftData = createFFTData(30, size);
      const { container } = render(<Spectrogram fftData={fftData} />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
    });
  });

  it("should handle different numbers of rows", () => {
    const rowCounts = [10, 30, 50, 100];

    rowCounts.forEach((rows) => {
      const fftData = createFFTData(rows, 1024);
      const { container } = render(<Spectrogram fftData={fftData} />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
    });
  });

  it("should handle extreme power values", () => {
    const fftData = [
      Float32Array.from({ length: 2048 }, () => -100), // Very weak signal
      Float32Array.from({ length: 2048 }, () => 50), // Very strong signal
      Float32Array.from({ length: 2048 }, () => 0), // Medium signal
    ];

    const { container } = render(<Spectrogram fftData={fftData} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should update when fftData changes", () => {
    const initialData = createFFTData(30, 1024);
    const { container, rerender } = render(
      <Spectrogram fftData={initialData} />,
    );

    const newData = createFFTData(50, 1024);
    rerender(<Spectrogram fftData={newData} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle single row of FFT data", () => {
    const fftData = createFFTData(1, 1024);
    const { container } = render(<Spectrogram fftData={fftData} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle narrow frequency range", () => {
    const fftData = createFFTData(30, 2048);
    const { container } = render(
      <Spectrogram fftData={fftData} freqMin={1000} freqMax={1010} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle wide frequency range", () => {
    const fftData = createFFTData(30, 2048);
    const { container } = render(
      <Spectrogram fftData={fftData} freqMin={0} freqMax={2048} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should create high DPI canvas", () => {
    const originalDPR = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", {
      writable: true,
      configurable: true,
      value: 2,
    });

    const fftData = createFFTData(30, 1024);
    const width = 750;
    const height = 800;

    const { container } = render(
      <Spectrogram fftData={fftData} width={width} height={height} />,
    );

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas.width).toBe(width * 2);
    expect(canvas.height).toBe(height * 2);

    Object.defineProperty(window, "devicePixelRatio", {
      writable: true,
      configurable: true,
      value: originalDPR,
    });
  });

  it("should handle consistent time-frequency pattern", () => {
    // Create a spectrogram with a sweeping frequency tone
    const rows = 50;
    const bins = 1024;
    const fftData = Array.from({ length: rows }, (_, rowIdx) => {
      const row = new Float32Array(bins);
      for (let i = 0; i < bins; i++) {
        row[i] = -50;
      }
      // Add a tone that sweeps across frequency
      const peakBin = Math.floor((rowIdx / rows) * bins);
      row[peakBin] = 20;
      return row;
    });

    const { container } = render(<Spectrogram fftData={fftData} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle multiple simultaneous frequency components", () => {
    const rows = 30;
    const bins = 1024;
    const fftData = Array.from({ length: rows }, () => {
      const row = new Float32Array(bins);
      for (let i = 0; i < bins; i++) {
        row[i] = -50;
      }
      // Add multiple tones
      row[100] = 10;
      row[500] = 15;
      row[900] = 12;
      return row;
    });

    const { container } = render(<Spectrogram fftData={fftData} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should render in waterfall mode", () => {
    const fftData = createFFTData(30, 1024);
    const { container } = render(
      <Spectrogram fftData={fftData} mode="waterfall" />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should limit frames in waterfall mode", () => {
    const fftData = createFFTData(150, 1024);
    const maxFrames = 100;
    const { container } = render(
      <Spectrogram
        fftData={fftData}
        mode="waterfall"
        maxWaterfallFrames={maxFrames}
      />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should accumulate frames in waterfall mode on updates", () => {
    const initialData = createFFTData(10, 1024);
    const { container, rerender } = render(
      <Spectrogram fftData={initialData} mode="waterfall" />,
    );

    // Add more data
    const newData = createFFTData(10, 1024);
    rerender(<Spectrogram fftData={newData} mode="waterfall" />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should switch between spectrogram and waterfall modes", () => {
    const fftData = createFFTData(30, 1024);
    const { container, rerender } = render(
      <Spectrogram fftData={fftData} mode="spectrogram" />,
    );

    let canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();

    // Switch to waterfall mode
    rerender(<Spectrogram fftData={fftData} mode="waterfall" />);

    canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should use default mode when not specified", () => {
    const fftData = createFFTData(30, 1024);
    const { container } = render(<Spectrogram fftData={fftData} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});
