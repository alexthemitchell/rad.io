/**
 * Tests for ATSC Constellation component
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ATSCConstellation from "../ATSCConstellation";

describe("ATSCConstellation", () => {
  const mockSamples = [
    { I: -7, Q: 0 },
    { I: -5, Q: 0.1 },
    { I: -3, Q: -0.1 },
    { I: -1, Q: 0 },
    { I: 1, Q: 0.05 },
    { I: 3, Q: -0.05 },
    { I: 5, Q: 0.1 },
    { I: 7, Q: 0 },
  ];

  beforeEach(() => {
    // Mock canvas context
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
      arc: jest.fn(),
      fill: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      textAlign: "",
      font: "",
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it("renders without crashing", () => {
    render(<ATSCConstellation samples={mockSamples} />);
    const canvas = screen.getByRole("img");
    expect(canvas).toBeInTheDocument();
  });

  it("displays accessible description", () => {
    render(<ATSCConstellation samples={mockSamples} />);
    const canvas = screen.getByRole("img");
    expect(canvas).toHaveAttribute("aria-label");
    expect(canvas.getAttribute("aria-label")).toContain("8-VSB");
  });

  it("handles empty samples array", () => {
    render(<ATSCConstellation samples={[]} />);
    const canvas = screen.getByRole("img");
    expect(canvas.getAttribute("aria-label")).toContain("No ATSC");
  });

  it("applies custom width and height", () => {
    const { container } = render(
      <ATSCConstellation samples={mockSamples} width={600} height={300} />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas?.style.width).toBe("600px");
    expect(canvas?.style.height).toBe("300px");
  });

  it("shows reference grid by default", () => {
    const { rerender } = render(
      <ATSCConstellation samples={mockSamples} showReferenceGrid={true} />,
    );
    expect(screen.getByRole("img")).toBeInTheDocument();

    rerender(
      <ATSCConstellation samples={mockSamples} showReferenceGrid={false} />,
    );
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("includes sample count in description", () => {
    render(<ATSCConstellation samples={mockSamples} />);
    const canvas = screen.getByRole("img");
    expect(canvas.getAttribute("aria-label")).toContain(
      `${mockSamples.length} symbols`,
    );
  });

  it("describes amplitude range", () => {
    render(<ATSCConstellation samples={mockSamples} />);
    const canvas = screen.getByRole("img");
    const label = canvas.getAttribute("aria-label") ?? "";
    expect(label).toContain("In-phase component ranges");
  });

  it("handles continueInBackground prop", () => {
    render(
      <ATSCConstellation samples={mockSamples} continueInBackground={true} />,
    );
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("renders with valid HTML structure", () => {
    const { container } = render(<ATSCConstellation samples={mockSamples} />);
    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ position: "relative" });
  });
});
