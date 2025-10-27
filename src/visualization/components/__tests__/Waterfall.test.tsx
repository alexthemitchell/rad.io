import { render, screen, waitFor } from "@testing-library/react";
import Waterfall from "../Waterfall";

describe("Waterfall", () => {
  const createFrames = (frameCount: number, size: number): Float32Array[] => {
    return Array.from({ length: frameCount }, () => {
      const frame = new Float32Array(size);
      for (let i = 0; i < size; i++) {
        // Create some test magnitude data (simulated dB values)
        frame[i] = -80 + Math.random() * 40;
      }
      return frame;
    });
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

  it("should render canvas element", () => {
    const frames = createFrames(32, 1024);
    const { container } = render(<Waterfall frames={frames} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should set default canvas dimensions", () => {
    const frames = createFrames(32, 1024);
    const { container } = render(<Waterfall frames={frames} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveAttribute("width", "750");
    expect(canvas).toHaveAttribute("height", "800");
  });

  it("should set custom canvas dimensions", () => {
    const frames = createFrames(32, 1024);
    const width = 600;
    const height = 600;

    const { container } = render(
      <Waterfall frames={frames} width={width} height={height} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveAttribute("width", width.toString());
    expect(canvas).toHaveAttribute("height", height.toString());
  });

  it("should have accessible aria-label with frame count", () => {
    const frames = createFrames(32, 1024);
    const freqMin = 100;
    const freqMax = 900;

    render(<Waterfall frames={frames} freqMin={freqMin} freqMax={freqMax} />);

    const canvas = screen.getByLabelText(
      /Waterfall display showing 32 frames across frequency bins/,
    );
    expect(canvas).toBeInTheDocument();
  });

  it("should use default frequency range when not provided", () => {
    const frames = createFrames(32, 1024);
    render(<Waterfall frames={frames} />);

    const canvas = screen.getByLabelText(/frequency bins 0 to 1024/);
    expect(canvas).toBeInTheDocument();
  });

  it("should display renderer type indicator", async () => {
    const frames = createFrames(32, 1024);
    const { container } = render(<Waterfall frames={frames} />);

    // Wait for renderer initialization
    await waitFor(
      () => {
        const indicator = container.querySelector(
          'div[style*="position: absolute"]',
        );
        expect(indicator).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("should handle empty frames array", () => {
    const frames: Float32Array[] = [];
    const { container } = render(<Waterfall frames={frames} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle single frame", () => {
    const frames = createFrames(1, 1024);
    render(<Waterfall frames={frames} />);

    const canvas = screen.getByLabelText(/showing 1 frames/);
    expect(canvas).toBeInTheDocument();
  });

  it("should update when frames data changes", () => {
    const frames1 = createFrames(16, 1024);
    const { rerender, container } = render(<Waterfall frames={frames1} />);

    const frames2 = createFrames(32, 1024);
    rerender(<Waterfall frames={frames2} />);

    // Component should not crash on data update
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle frequency range updates", () => {
    const frames = createFrames(32, 1024);
    const { rerender, container } = render(
      <Waterfall frames={frames} freqMin={0} freqMax={512} />,
    );

    rerender(<Waterfall frames={frames} freqMin={256} freqMax={768} />);

    // Component should not crash on frequency range update
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle large number of frames", () => {
    const frames = createFrames(100, 1024);
    const { container } = render(<Waterfall frames={frames} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});
