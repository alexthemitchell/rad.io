/**
 * Tests for BER Counter component
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BERCounter from "../BERCounter";

describe("BERCounter", () => {
  it("renders without crashing", () => {
    render(<BERCounter totalBits={1000000} errorBits={100} />);
    expect(screen.getByText("Bit Error Rate (BER)")).toBeInTheDocument();
  });

  it("displays BER value", () => {
    render(<BERCounter totalBits={1000000} errorBits={100} />);
    expect(screen.getByLabelText(/BER value:/)).toBeInTheDocument();
  });

  it("shows quality indicator", () => {
    render(<BERCounter totalBits={1000000} errorBits={1} />);
    expect(screen.getByLabelText(/Error rate quality:/)).toBeInTheDocument();
  });

  it("handles zero errors", () => {
    render(<BERCounter totalBits={1000000} errorBits={0} />);
    expect(screen.getByText("Bit Error Rate (BER)")).toBeInTheDocument();
  });

  it("handles zero total bits", () => {
    render(<BERCounter totalBits={0} errorBits={0} />);
    expect(screen.getByText("Bit Error Rate (BER)")).toBeInTheDocument();
  });

  it("shows detailed stats when enabled", () => {
    render(
      <BERCounter
        totalBits={1000000}
        errorBits={100}
        showDetails={true}
      />,
    );
    expect(screen.getByText(/Total Bits:/)).toBeInTheDocument();
    expect(screen.getByText(/Error Bits:/)).toBeInTheDocument();
  });

  it("displays duration and rates when provided", () => {
    render(
      <BERCounter
        totalBits={1000000}
        errorBits={100}
        duration={10}
        showDetails={true}
      />,
    );
    expect(screen.getByText(/Duration:/)).toBeInTheDocument();
    expect(screen.getByText(/Bit Rate:/)).toBeInTheDocument();
    expect(screen.getByText(/Error Rate:/)).toBeInTheDocument();
  });

  it("formats large numbers with locale separators", () => {
    render(
      <BERCounter
        totalBits={10000000}
        errorBits={1000}
        showDetails={true}
      />,
    );
    const totalBitsText = screen.getByText(/10,000,000/);
    expect(totalBitsText).toBeInTheDocument();
  });

  it("has proper ARIA region", () => {
    render(<BERCounter totalBits={1000000} errorBits={100} />);
    expect(screen.getByRole("region", { name: /BER measurement/ })).toBeInTheDocument();
  });
});
