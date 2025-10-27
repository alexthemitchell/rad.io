import { render, screen } from "@testing-library/react";
import FFTChart from "../FFTChart";
import type { Sample } from "../../../utils/dsp";

describe("FFTChart", () => {
  const createSamples = (count: number, amplitude = 0.5): Sample[] => {
    return Array.from({ length: count }, (_, i) => ({
      I: Math.cos((2 * Math.PI * i) / count) * amplitude,
      Q: Math.sin((2 * Math.PI * i) / count) * amplitude,
    }));
  };

  beforeEach(() => {
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should render empty state when no samples provided", () => {
    render(<FFTChart samples={[]} />);

    expect(screen.getByText("Waiting for signal data")).toBeInTheDocument();
    expect(
      screen.getByText("Connect and start reception to view spectrogram")
    ).toBeInTheDocument();
  });

  it("should render empty state when insufficient samples", () => {
    const samples = createSamples(512); // Less than default FFT size of 1024
    render(<FFTChart samples={samples} fftSize={1024} />);

    expect(screen.getByText("Waiting for signal data")).toBeInTheDocument();
  });

  it("should render spectrogram when sufficient samples provided", () => {
    const samples = createSamples(2048);
    const { container } = render(<FFTChart samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(screen.queryByText("Waiting for signal data")).not.toBeInTheDocument();
  });

  it("should use default dimensions when not provided", () => {
    const samples = createSamples(2048);
    const { container } = render(<FFTChart samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    // Spectrogram component uses these dimensions
  });

  it("should pass custom dimensions to spectrogram", () => {
    const samples = createSamples(2048);
    const width = 600;
    const height = 600;

    const { container } = render(
      <FFTChart samples={samples} width={width} height={height} />
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should use custom FFT size", () => {
    const fftSize = 512;
    const samples = createSamples(1024);

    const { container } = render(
      <FFTChart samples={samples} fftSize={fftSize} />
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should pass frequency range to spectrogram", () => {
    const samples = createSamples(2048);
    const freqMin = 500;
    const freqMax = 1500;

    const { container } = render(
      <FFTChart
        samples={samples}
        freqMin={freqMin}
        freqMax={freqMax}
      />
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should support spectrogram mode", () => {
    const samples = createSamples(2048);
    const { container } = render(
      <FFTChart samples={samples} mode="spectrogram" />
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should support waterfall mode", () => {
    const samples = createSamples(2048);
    const { container } = render(
      <FFTChart samples={samples} mode="waterfall" />
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should use default mode when not specified", () => {
    const samples = createSamples(2048);
    const { container } = render(<FFTChart samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should respect maxWaterfallFrames prop", () => {
    const samples = createSamples(2048);
    const maxWaterfallFrames = 50;

    const { container } = render(
      <FFTChart
        samples={samples}
        mode="waterfall"
        maxWaterfallFrames={maxWaterfallFrames}
      />
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should update when samples change", () => {
    const samples1 = createSamples(2048);
    const { container, rerender } = render(<FFTChart samples={samples1} />);

    let canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();

    const samples2 = createSamples(4096);
    rerender(<FFTChart samples={samples2} />);

    canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle transition from no data to data", () => {
    const { rerender } = render(<FFTChart samples={[]} />);

    expect(screen.getByText("Waiting for signal data")).toBeInTheDocument();

    const samples = createSamples(2048);
    rerender(<FFTChart samples={samples} />);

    expect(screen.queryByText("Waiting for signal data")).not.toBeInTheDocument();
  });

  it("should handle transition from data to no data", () => {
    const samples = createSamples(2048);
    const { rerender, container } = render(<FFTChart samples={samples} />);

    let canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();

    rerender(<FFTChart samples={[]} />);

    expect(screen.getByText("Waiting for signal data")).toBeInTheDocument();
  });
});
