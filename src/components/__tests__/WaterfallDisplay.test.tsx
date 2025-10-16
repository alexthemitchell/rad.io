import { render } from "@testing-library/react";
import WaterfallDisplay from "../WaterfallDisplay";

describe("WaterfallDisplay", () => {
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
    HTMLCanvasElement.prototype.getContext = jest.fn(() => {
      const mockContext = {
        fillRect: jest.fn(),
        strokeRect: jest.fn(),
        clearRect: jest.fn(),
        getImageData: jest.fn(),
        putImageData: jest.fn(),
        createImageData: jest.fn(),
        setTransform: jest.fn(),
        resetTransform: jest.fn(),
        drawImage: jest.fn(),
        save: jest.fn(),
        fillStyle: "",
        restore: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        closePath: jest.fn(),
        stroke: jest.fn(),
        translate: jest.fn(),
        scale: jest.fn(),
        rotate: jest.fn(),
        arc: jest.fn(),
        fill: jest.fn(),
        measureText: jest.fn(() => ({ width: 0 })),
        transform: jest.fn(),
        rect: jest.fn(),
        clip: jest.fn(),
        createLinearGradient: jest.fn(() => ({
          addColorStop: jest.fn(),
        })),
        createRadialGradient: jest.fn(() => ({
          addColorStop: jest.fn(),
        })),
        fillText: jest.fn(),
        strokeText: jest.fn(),
      };
      return mockContext;
    }) as jest.Mock;

    // Mock requestAnimationFrame and cancelAnimationFrame
    global.requestAnimationFrame = jest.fn((cb) => {
      setTimeout(cb, 16);
      return 1;
    }) as jest.Mock;

    global.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should render without crashing", () => {
    const fftData = createFFTData(10, 2048);
    const { unmount } = render(
      <WaterfallDisplay
        fftData={fftData}
        width={750}
        height={800}
        freqMin={1000}
        freqMax={1100}
      />,
    );
    expect(unmount).toBeDefined();
    unmount();
  });

  it("should render with empty data", () => {
    const { unmount } = render(
      <WaterfallDisplay
        fftData={[]}
        width={750}
        height={800}
        freqMin={1000}
        freqMax={1100}
      />,
    );
    expect(unmount).toBeDefined();
    unmount();
  });

  it("should use provided dimensions", async () => {
    const fftData = createFFTData(10, 2048);
    const { container, unmount } = render(
      <WaterfallDisplay
        fftData={fftData}
        width={600}
        height={400}
        freqMin={1000}
        freqMax={1100}
      />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeDefined();
    // Wait for useEffect to run
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(canvas?.style.width).toBe("600px");
    expect(canvas?.style.height).toBe("400px");
    unmount();
  });

  it("should render with custom frequency range", () => {
    const fftData = createFFTData(10, 2048);
    const { unmount } = render(
      <WaterfallDisplay
        fftData={fftData}
        width={750}
        height={800}
        freqMin={500}
        freqMax={1500}
      />,
    );
    expect(unmount).toBeDefined();
    unmount();
  });

  it("should handle single FFT frame", () => {
    const fftData = createFFTData(1, 2048);
    const { unmount } = render(
      <WaterfallDisplay
        fftData={fftData}
        width={750}
        height={800}
        freqMin={1000}
        freqMax={1100}
      />,
    );
    expect(unmount).toBeDefined();
    unmount();
  });

  it("should handle large number of FFT frames", () => {
    const fftData = createFFTData(100, 2048);
    const { unmount } = render(
      <WaterfallDisplay
        fftData={fftData}
        width={750}
        height={800}
        freqMin={1000}
        freqMax={1100}
      />,
    );
    expect(unmount).toBeDefined();
    unmount();
  });

  it("should render canvas with correct accessibility attributes", () => {
    const fftData = createFFTData(10, 2048);
    const { container, unmount } = render(
      <WaterfallDisplay
        fftData={fftData}
        width={750}
        height={800}
        freqMin={1000}
        freqMax={1100}
      />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas?.getAttribute("role")).toBe("img");
    expect(canvas?.getAttribute("aria-label")).toContain("Waterfall display");
    expect(canvas?.getAttribute("tabIndex")).toBe("0");
    unmount();
  });

  it("should include frequency range in accessible description", () => {
    const fftData = createFFTData(10, 2048);
    const { container, unmount } = render(
      <WaterfallDisplay
        fftData={fftData}
        width={750}
        height={800}
        freqMin={1000}
        freqMax={1100}
      />,
    );
    const canvas = container.querySelector("canvas");
    const ariaLabel = canvas?.getAttribute("aria-label");
    expect(ariaLabel).toContain("1000");
    expect(ariaLabel).toContain("1100");
    unmount();
  });

  it("should handle custom scroll speed", () => {
    const fftData = createFFTData(10, 2048);
    const { unmount } = render(
      <WaterfallDisplay
        fftData={fftData}
        width={750}
        height={800}
        freqMin={1000}
        freqMax={1100}
        scrollSpeed={5}
      />,
    );
    expect(unmount).toBeDefined();
    unmount();
  });

  it("should handle custom max history", () => {
    const fftData = createFFTData(10, 2048);
    const { unmount } = render(
      <WaterfallDisplay
        fftData={fftData}
        width={750}
        height={800}
        freqMin={1000}
        freqMax={1100}
        maxHistory={500}
      />,
    );
    expect(unmount).toBeDefined();
    unmount();
  });

  it("should display pause/resume button", () => {
    const fftData = createFFTData(10, 2048);
    const { container, unmount } = render(
      <WaterfallDisplay
        fftData={fftData}
        width={750}
        height={800}
        freqMin={1000}
        freqMax={1100}
      />,
    );
    const buttons = container.querySelectorAll("button");
    const pauseButton = Array.from(buttons).find(
      (btn) => btn.textContent === "Pause" || btn.textContent === "Resume",
    );
    expect(pauseButton).toBeDefined();
    unmount();
  });

  it("should handle NaN and Infinity values in FFT data", () => {
    const fftData = createFFTData(5, 2048);
    // Add some invalid values
    fftData[0]![1000] = NaN;
    fftData[1]![1050] = Infinity;
    fftData[2]![1025] = -Infinity;

    const { unmount } = render(
      <WaterfallDisplay
        fftData={fftData}
        width={750}
        height={800}
        freqMin={1000}
        freqMax={1100}
      />,
    );
    expect(unmount).toBeDefined();
    unmount();
  });

  it("should cleanup animation frame on unmount", () => {
    const fftData = createFFTData(10, 2048);
    const { unmount } = render(
      <WaterfallDisplay
        fftData={fftData}
        width={750}
        height={800}
        freqMin={1000}
        freqMax={1100}
      />,
    );

    unmount();
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });
});
