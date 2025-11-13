/**
 * Tests for ATSC Spectrum component
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ATSCSpectrum from "../ATSCSpectrum";

describe("ATSCSpectrum", () => {
  const mockFFTData = new Float32Array(512);
  for (let i = 0; i < 512; i++) {
    mockFFTData[i] = -60 + Math.random() * 40; // -60 to -20 dB
  }

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
      closePath: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
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
    render(
      <ATSCSpectrum
        fftData={mockFFTData}
        centerFrequency={533e6}
        sampleRate={10e6}
      />,
    );
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("displays accessible description", () => {
    render(
      <ATSCSpectrum
        fftData={mockFFTData}
        centerFrequency={533e6}
        sampleRate={10e6}
      />,
    );
    const canvas = screen.getByRole("img");
    const label = canvas.getAttribute("aria-label") ?? "";
    expect(label).toContain("ATSC Spectrum");
    expect(label).toContain("Pilot tone");
  });

  it("handles empty FFT data", () => {
    render(
      <ATSCSpectrum
        fftData={new Float32Array(0)}
        centerFrequency={533e6}
        sampleRate={10e6}
      />,
    );
    const canvas = screen.getByRole("img");
    expect(canvas.getAttribute("aria-label")).toContain("No spectrum data");
  });

  it("applies custom dimensions", () => {
    const { container } = render(
      <ATSCSpectrum
        fftData={mockFFTData}
        centerFrequency={533e6}
        sampleRate={10e6}
        width={600}
        height={250}
      />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas?.style.width).toBe("600px");
    expect(canvas?.style.height).toBe("250px");
  });

  it("shows pilot marker by default", () => {
    render(
      <ATSCSpectrum
        fftData={mockFFTData}
        centerFrequency={533e6}
        sampleRate={10e6}
        showPilotMarker={true}
      />,
    );
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("shows bandwidth markers when enabled", () => {
    render(
      <ATSCSpectrum
        fftData={mockFFTData}
        centerFrequency={533e6}
        sampleRate={10e6}
        showBandwidthMarkers={true}
      />,
    );
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});
