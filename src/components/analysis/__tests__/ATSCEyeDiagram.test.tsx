/**
 * Tests for ATSC Eye Diagram component
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ATSCEyeDiagram from "../ATSCEyeDiagram";

describe("ATSCEyeDiagram", () => {
  const mockSamples = [];
  // Generate several symbol periods
  for (let i = 0; i < 256; i++) {
    const phase = (i % 128) / 128;
    const level = Math.round(Math.sin(phase * Math.PI * 2) * 3.5) * 2 + 1;
    mockSamples.push({ I: level, Q: 0.05 * Math.random() });
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
      stroke: jest.fn(),
      fill: jest.fn(),
      fillText: jest.fn(),
      arc: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      textAlign: "",
      font: "",
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it("renders without crashing", () => {
    render(<ATSCEyeDiagram samples={mockSamples} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("displays accessible description", () => {
    render(<ATSCEyeDiagram samples={mockSamples} />);
    const canvas = screen.getByRole("img");
    const label = canvas.getAttribute("aria-label") ?? "";
    expect(label).toContain("8-VSB eye diagram");
    expect(label).toContain("overlaid symbol periods");
  });

  it("handles insufficient samples", () => {
    render(<ATSCEyeDiagram samples={[{ I: 1, Q: 0 }]} />);
    const canvas = screen.getByRole("img");
    expect(canvas.getAttribute("aria-label")).toContain("No samples");
  });

  it("applies custom dimensions", () => {
    const { container } = render(
      <ATSCEyeDiagram samples={mockSamples} width={600} height={250} />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas?.style.width).toBe("600px");
    expect(canvas?.style.height).toBe("250px");
  });

  it("respects periodSamples setting", () => {
    render(<ATSCEyeDiagram samples={mockSamples} periodSamples={64} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("respects maxOverlays setting", () => {
    render(<ATSCEyeDiagram samples={mockSamples} maxOverlays={30} />);
    const canvas = screen.getByRole("img");
    const label = canvas.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/\d+ overlaid/);
  });

  it("shows level markers when enabled", () => {
    render(<ATSCEyeDiagram samples={mockSamples} showLevelMarkers={true} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("hides level markers when disabled", () => {
    render(<ATSCEyeDiagram samples={mockSamples} showLevelMarkers={false} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});
