/**
 * Tests for MER Display component
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MERDisplay from "../MERDisplay";

describe("MERDisplay", () => {
  const mockSamples = [
    { I: -7, Q: 0 },
    { I: -5, Q: 0.05 },
    { I: -3, Q: -0.05 },
    { I: -1, Q: 0.02 },
    { I: 1, Q: -0.02 },
    { I: 3, Q: 0.03 },
    { I: 5, Q: -0.03 },
    { I: 7, Q: 0.01 },
  ];

  it("renders without crashing", () => {
    render(<MERDisplay samples={mockSamples} />);
    expect(screen.getByText("Modulation Error Ratio (MER)")).toBeInTheDocument();
  });

  it("displays MER value in dB", () => {
    render(<MERDisplay samples={mockSamples} />);
    expect(screen.getByLabelText(/MER value:/)).toBeInTheDocument();
  });

  it("shows quality indicator", () => {
    render(<MERDisplay samples={mockSamples} />);
    expect(screen.getByLabelText(/Signal quality:/)).toBeInTheDocument();
  });

  it("handles empty samples", () => {
    render(<MERDisplay samples={[]} />);
    expect(screen.getByText("Modulation Error Ratio (MER)")).toBeInTheDocument();
  });

  it("shows detailed stats when enabled", () => {
    render(<MERDisplay samples={mockSamples} showDetails={true} />);
    expect(screen.getByText(/MER \(linear\):/)).toBeInTheDocument();
    expect(screen.getByText(/Error Power:/)).toBeInTheDocument();
    expect(screen.getByText(/Signal Power:/)).toBeInTheDocument();
  });

  it("hides detailed stats by default", () => {
    render(<MERDisplay samples={mockSamples} showDetails={false} />);
    expect(screen.queryByText(/MER \(linear\):/)).not.toBeInTheDocument();
  });

  it("displays sample count in details", () => {
    render(<MERDisplay samples={mockSamples} showDetails={true} />);
    expect(screen.getByText(/Samples:/)).toBeInTheDocument();
  });

  it("uses reference symbols when provided", () => {
    const referenceSymbols = [-7, -5, -3, -1, 1, 3, 5, 7];
    render(
      <MERDisplay
        samples={mockSamples}
        referenceSymbols={referenceSymbols}
      />,
    );
    expect(screen.getByText("Modulation Error Ratio (MER)")).toBeInTheDocument();
  });

  it("has proper ARIA region", () => {
    render(<MERDisplay samples={mockSamples} />);
    expect(screen.getByRole("region", { name: /MER measurement/ })).toBeInTheDocument();
  });
});
