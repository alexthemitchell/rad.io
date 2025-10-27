import { render, screen } from "@testing-library/react";
import WaveformChart from "../WaveformChart";
import type { Sample } from "../../utils/dsp";
import { createMockCanvasContext } from "../../utils/testHelpers";

describe("WaveformChart", () => {
  const createSamples = (count: number, amplitude = 0.5): Sample[] => {
    return Array.from({ length: count }, (_, i) => ({
      I: Math.cos((2 * Math.PI * i) / count) * amplitude,
      Q: Math.sin((2 * Math.PI * i) / count) * amplitude,
    }));
  };

  beforeEach(() => {
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = jest.fn(() =>
      createMockCanvasContext(),
    ) as jest.Mock;

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should render empty state when no samples provided", () => {
    render(<WaveformChart samples={[]} />);

    expect(screen.getByText("Waiting for signal data")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Connect and start reception to view amplitude waveform",
      ),
    ).toBeInTheDocument();
  });

  it("should render WaveformVisualizer when samples provided", () => {
    const samples = createSamples(100);
    const { container } = render(<WaveformChart samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(
      screen.queryByText("Waiting for signal data"),
    ).not.toBeInTheDocument();
  });

  it("should use default dimensions when not provided", () => {
    const samples = createSamples(100);
    const { container } = render(<WaveformChart samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveStyle({
      width: "750px",
      height: "300px",
    });
  });

  it("should pass custom width to WaveformVisualizer", () => {
    const samples = createSamples(100);
    const width = 600;

    const { container } = render(
      <WaveformChart samples={samples} width={width} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveStyle({
      width: `${width}px`,
    });
  });

  it("should pass custom height to WaveformVisualizer", () => {
    const samples = createSamples(100);
    const height = 400;

    const { container } = render(
      <WaveformChart samples={samples} height={height} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveStyle({
      height: `${height}px`,
    });
  });

  it("should pass both custom width and height", () => {
    const samples = createSamples(100);
    const width = 600;
    const height = 400;

    const { container } = render(
      <WaveformChart samples={samples} width={width} height={height} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveStyle({
      width: `${width}px`,
      height: `${height}px`,
    });
  });

  it("should handle single sample", () => {
    const samples = createSamples(1);
    const { container } = render(<WaveformChart samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle large number of samples", () => {
    const samples = createSamples(10000);
    const { container } = render(<WaveformChart samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should update when samples change from empty to data", () => {
    const { rerender } = render(<WaveformChart samples={[]} />);

    expect(screen.getByText("Waiting for signal data")).toBeInTheDocument();

    const samples = createSamples(100);
    rerender(<WaveformChart samples={samples} />);

    expect(
      screen.queryByText("Waiting for signal data"),
    ).not.toBeInTheDocument();
  });

  it("should update when samples change from data to empty", () => {
    const samples = createSamples(100);
    const { rerender, container } = render(<WaveformChart samples={samples} />);

    let canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();

    rerender(<WaveformChart samples={[]} />);

    expect(screen.getByText("Waiting for signal data")).toBeInTheDocument();
  });

  it("should update when sample data changes", () => {
    const samples1 = createSamples(100, 0.3);
    const { rerender, container } = render(
      <WaveformChart samples={samples1} />,
    );

    let canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();

    const samples2 = createSamples(200, 0.7);
    rerender(<WaveformChart samples={samples2} />);

    canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});
