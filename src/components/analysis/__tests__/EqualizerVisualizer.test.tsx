/**
 * Tests for Equalizer Visualizer component
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import EqualizerVisualizer from "../EqualizerVisualizer";

describe("EqualizerVisualizer", () => {
  const mockTaps = new Float32Array(64);
  // Set center tap to 1, with some multipath echoes
  mockTaps[32] = 1.0;
  mockTaps[30] = 0.15;
  mockTaps[35] = -0.12;
  mockTaps[28] = 0.08;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      scale: jest.fn(),
      fillStyle: "",
      fillRect: jest.fn(),
      strokeStyle: "",
      lineWidth: 0,
      setLineDash: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fillText: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      textAlign: "",
      font: "",
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it("renders without crashing", () => {
    render(<EqualizerVisualizer taps={mockTaps} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("displays accessible description", () => {
    render(<EqualizerVisualizer taps={mockTaps} />);
    const canvas = screen.getByRole("img");
    const label = canvas.getAttribute("aria-label") ?? "";
    expect(label).toContain("Equalizer tap");
    expect(label).toContain("64 taps");
  });

  it("handles empty taps array", () => {
    render(<EqualizerVisualizer taps={new Float32Array(0)} />);
    const canvas = screen.getByRole("img");
    expect(canvas.getAttribute("aria-label")).toContain("No equalizer");
  });

  it("applies custom dimensions", () => {
    const { container } = render(
      <EqualizerVisualizer taps={mockTaps} width={500} height={200} />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas?.style.width).toBe("500px");
    expect(canvas?.style.height).toBe("200px");
  });

  it("shows time axis when enabled", () => {
    render(<EqualizerVisualizer taps={mockTaps} showTimeAxis={true} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("hides time axis when disabled", () => {
    render(<EqualizerVisualizer taps={mockTaps} showTimeAxis={false} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("uses symbol rate for time calculations", () => {
    render(
      <EqualizerVisualizer
        taps={mockTaps}
        symbolRate={10.76e6}
        showTimeAxis={true}
      />,
    );
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("describes multipath components", () => {
    render(<EqualizerVisualizer taps={mockTaps} />);
    const canvas = screen.getByRole("img");
    const label = canvas.getAttribute("aria-label") ?? "";
    expect(label).toContain("multipath");
  });
});
