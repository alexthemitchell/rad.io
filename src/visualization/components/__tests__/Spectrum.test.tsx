import { render, screen, waitFor } from "@testing-library/react";
import Spectrum from "../Spectrum";

describe("Spectrum", () => {
  const createMagnitudes = (size: number): Float32Array => {
    const mags = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      // Create some test magnitude data (simulated dB values)
      mags[i] = -80 + Math.sin((i * Math.PI) / size) * 40;
    }
    return mags;
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
    const magnitudes = createMagnitudes(1024);
    const { container } = render(<Spectrum magnitudes={magnitudes} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should set default canvas dimensions", () => {
    const magnitudes = createMagnitudes(1024);
    const { container } = render(<Spectrum magnitudes={magnitudes} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveAttribute("width", "750");
    expect(canvas).toHaveAttribute("height", "400");
  });

  it("should set custom canvas dimensions", () => {
    const magnitudes = createMagnitudes(1024);
    const width = 600;
    const height = 300;

    const { container } = render(
      <Spectrum magnitudes={magnitudes} width={width} height={height} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveAttribute("width", width.toString());
    expect(canvas).toHaveAttribute("height", height.toString());
  });

  it("should have accessible aria-label", () => {
    const magnitudes = createMagnitudes(1024);
    const freqMin = 100;
    const freqMax = 900;

    render(
      <Spectrum magnitudes={magnitudes} freqMin={freqMin} freqMax={freqMax} />,
    );

    const canvas = screen.getByLabelText(
      /Spectrum display showing frequency bins/,
    );
    expect(canvas).toBeInTheDocument();
  });

  it("should use default frequency range when not provided", () => {
    const magnitudes = createMagnitudes(1024);
    render(<Spectrum magnitudes={magnitudes} />);

    const canvas = screen.getByLabelText(/frequency bins 0 to 1024/);
    expect(canvas).toBeInTheDocument();
  });

  it("should display renderer type indicator", async () => {
    const magnitudes = createMagnitudes(1024);
    const { container } = render(<Spectrum magnitudes={magnitudes} />);

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

  it("should handle empty magnitude array", () => {
    const magnitudes = new Float32Array(0);
    const { container } = render(<Spectrum magnitudes={magnitudes} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should update when magnitude data changes", () => {
    const magnitudes1 = createMagnitudes(1024);
    const { rerender, container } = render(
      <Spectrum magnitudes={magnitudes1} />,
    );

    const magnitudes2 = createMagnitudes(2048);
    rerender(<Spectrum magnitudes={magnitudes2} />);

    // Component should not crash on data update
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle frequency range updates", () => {
    const magnitudes = createMagnitudes(1024);
    const { rerender, container } = render(
      <Spectrum magnitudes={magnitudes} freqMin={0} freqMax={512} />,
    );

    rerender(<Spectrum magnitudes={magnitudes} freqMin={256} freqMax={768} />);

    // Component should not crash on frequency range update
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});
