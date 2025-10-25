import { render } from "@testing-library/react";
import IQConstellation from "../IQConstellation";
import {
  createTestSamples,
  createMockCanvasContext,
} from "../../utils/testHelpers";

describe("IQConstellation", () => {
  const createSamples = (count: number) => createTestSamples(count, "linear");

  beforeEach(() => {
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = jest.fn(() =>
      createMockCanvasContext(),
    ) as jest.Mock;
  });

  it("should render canvas element", () => {
    const samples = createSamples(100);
    const { container } = render(<IQConstellation samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should set canvas dimensions", () => {
    const samples = createSamples(50);
    const width = 600;
    const height = 400;

    const { container } = render(
      <IQConstellation samples={samples} width={width} height={height} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveStyle({
      width: `${width}px`,
      height: `${height}px`,
    });
  });

  it("should use default dimensions when not provided", () => {
    const samples = createSamples(50);
    const { container } = render(<IQConstellation samples={samples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveStyle({
      width: "750px",
      height: "400px",
    });
  });

  it("should handle empty samples array", () => {
    const { container } = render(<IQConstellation samples={[]} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle samples at boundaries", () => {
    const boundarySamples: Sample[] = [
      { I: -0.1, Q: -0.1 },
      { I: 0.1, Q: 0.1 },
      { I: -0.1, Q: 0.1 },
      { I: 0.1, Q: -0.1 },
      { I: 0, Q: 0 },
    ];

    const { container } = render(<IQConstellation samples={boundarySamples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should render different sample patterns", () => {
    const patterns = [
      // Circular pattern (QPSK-like)
      Array.from({ length: 100 }, (_, i) => ({
        I: 0.05 * Math.cos((2 * Math.PI * i) / 100),
        Q: 0.05 * Math.sin((2 * Math.PI * i) / 100),
      })),
      // Linear pattern
      Array.from({ length: 100 }, (_, i) => ({
        I: (i / 100 - 0.5) * 0.1,
        Q: (i / 100 - 0.5) * 0.1,
      })),
      // Random constellation
      Array.from({ length: 100 }, () => ({
        I: (Math.random() - 0.5) * 0.2,
        Q: (Math.random() - 0.5) * 0.2,
      })),
    ];

    patterns.forEach((pattern) => {
      const { container } = render(<IQConstellation samples={pattern} />);
      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
    });
  });

  it("should handle large number of samples", () => {
    const largeSampleSet = createSamples(10000);
    const { container } = render(<IQConstellation samples={largeSampleSet} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should update when samples change", () => {
    const initialSamples = createSamples(50);
    const { container, rerender } = render(
      <IQConstellation samples={initialSamples} />,
    );

    const newSamples = createSamples(100);
    rerender(<IQConstellation samples={newSamples} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should handle samples with extreme values", () => {
    const extremeSamples: Sample[] = [
      { I: -1, Q: -1 },
      { I: 1, Q: 1 },
      { I: -0.5, Q: 0.5 },
      { I: 0.001, Q: -0.001 },
    ];

    const { container } = render(<IQConstellation samples={extremeSamples} />);

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

    const samples = createSamples(50);
    const width = 750;
    const height = 400;

    const { container } = render(
      <IQConstellation samples={samples} width={width} height={height} />,
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
});
