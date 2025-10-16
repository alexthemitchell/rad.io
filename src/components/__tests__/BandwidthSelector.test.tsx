/**
 * BandwidthSelector Component Tests
 */

import { render, screen, fireEvent } from "@testing-library/react";
import BandwidthSelector from "../BandwidthSelector";

describe("BandwidthSelector", () => {
  const defaultSupportedBandwidths = [
    1.75e6, 2.5e6, 3.5e6, 5e6, 5.5e6, 6e6, 7e6, 8e6, 9e6, 10e6, 12e6, 14e6,
    15e6, 20e6, 24e6, 28e6,
  ];

  it("renders bandwidth selector with current value", () => {
    const setBandwidth = jest.fn().mockResolvedValue(undefined);
    render(
      <BandwidthSelector
        bandwidth={20e6}
        setBandwidth={setBandwidth}
        supportedBandwidths={defaultSupportedBandwidths}
      />,
    );

    const select = screen.getByLabelText(/Baseband filter bandwidth/);
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("20000000");
  });

  it("displays all supported bandwidths as options", () => {
    const setBandwidth = jest.fn().mockResolvedValue(undefined);
    render(
      <BandwidthSelector
        bandwidth={20e6}
        setBandwidth={setBandwidth}
        supportedBandwidths={defaultSupportedBandwidths}
      />,
    );

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(defaultSupportedBandwidths.length);

    // Check that each bandwidth is present
    defaultSupportedBandwidths.forEach((bw) => {
      expect(
        screen.getByRole("option", { name: `${bw / 1e6} MHz` }),
      ).toBeInTheDocument();
    });
  });

  it("calls setBandwidth when selection changes", async () => {
    const setBandwidth = jest.fn().mockResolvedValue(undefined);
    render(
      <BandwidthSelector
        bandwidth={20e6}
        setBandwidth={setBandwidth}
        supportedBandwidths={defaultSupportedBandwidths}
      />,
    );

    const select = screen.getByLabelText(/Baseband filter bandwidth/);
    fireEvent.change(select, { target: { value: "10000000" } });

    expect(setBandwidth).toHaveBeenCalledWith(10e6);
  });

  it("formats bandwidth values correctly in MHz", () => {
    const setBandwidth = jest.fn().mockResolvedValue(undefined);
    render(
      <BandwidthSelector
        bandwidth={1.75e6}
        setBandwidth={setBandwidth}
        supportedBandwidths={defaultSupportedBandwidths}
      />,
    );

    expect(screen.getByRole("option", { name: "1.75 MHz" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "28 MHz" })).toBeInTheDocument();
  });

  it("uses default bandwidths when none provided", () => {
    const setBandwidth = jest.fn().mockResolvedValue(undefined);
    render(<BandwidthSelector bandwidth={20e6} setBandwidth={setBandwidth} />);

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    expect(
      screen.getByRole("option", { name: "20 MHz" }),
    ).toBeInTheDocument();
  });

  it("includes accessibility attributes", () => {
    const setBandwidth = jest.fn().mockResolvedValue(undefined);
    render(
      <BandwidthSelector
        bandwidth={20e6}
        setBandwidth={setBandwidth}
        supportedBandwidths={defaultSupportedBandwidths}
      />,
    );

    const select = screen.getByLabelText(/Baseband filter bandwidth/);
    expect(select).toHaveAttribute("aria-describedby", "bandwidth-hint");
    expect(select).toHaveAttribute("title");

    const hint = screen.getByText(/Baseband filter bandwidth controls/);
    expect(hint).toHaveClass("visually-hidden");
  });

  it("handles error when setBandwidth fails", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    const setBandwidth = jest.fn().mockRejectedValue(new Error("Test error"));

    render(
      <BandwidthSelector
        bandwidth={20e6}
        setBandwidth={setBandwidth}
        supportedBandwidths={defaultSupportedBandwidths}
      />,
    );

    const select = screen.getByLabelText(/Baseband filter bandwidth/);
    fireEvent.change(select, { target: { value: "10000000" } });

    expect(setBandwidth).toHaveBeenCalledWith(10e6);

    // Wait a tick for the promise rejection
    setTimeout(() => {
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    }, 0);
  });
});
