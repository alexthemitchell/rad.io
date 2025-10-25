/**
 * Tests for DSPPipeline component
 */

import { render, screen } from "@testing-library/react";
import DSPPipeline from "../DSPPipeline";

describe("DSPPipeline", () => {
  it("renders the pipeline title", () => {
    render(<DSPPipeline />);
    expect(
      screen.getByText("Digital Signal Processing Pipeline"),
    ).toBeInTheDocument();
  });

  it("renders the pipeline subtitle/description", () => {
    render(<DSPPipeline />);
    expect(
      screen.getByText(
        "Visual representation of how your radio signal is processed",
      ),
    ).toBeInTheDocument();
  });

  it("renders all 6 DSP stages", () => {
    render(<DSPPipeline />);

    // Check all stage titles
    expect(screen.getByText("RF Input")).toBeInTheDocument();
    expect(screen.getByText("Tuner")).toBeInTheDocument();
    expect(screen.getByText("I/Q Sampling")).toBeInTheDocument();
    expect(screen.getByText("FFT")).toBeInTheDocument();
    expect(screen.getByText("Demodulation")).toBeInTheDocument();
    expect(screen.getByText("Audio Output")).toBeInTheDocument();
  });

  it("renders stage descriptions", () => {
    render(<DSPPipeline />);

    expect(screen.getByText("Antenna signal")).toBeInTheDocument();
    expect(screen.getByText("Frequency selection")).toBeInTheDocument();
    expect(screen.getByText("Digital conversion")).toBeInTheDocument();
    expect(screen.getByText("Frequency analysis")).toBeInTheDocument();
    expect(screen.getByText("Signal extraction")).toBeInTheDocument();
    expect(screen.getByText("Speaker/headphones")).toBeInTheDocument();
  });

  it("renders arrows between stages", () => {
    const { container } = render(<DSPPipeline />);
    const arrows = container.querySelectorAll(".dsp-arrow");

    // Should have 5 arrows (between 6 stages)
    expect(arrows).toHaveLength(5);
    arrows.forEach((arrow) => {
      expect(arrow.textContent).toBe("→");
    });
  });

  it("does not render arrow after the last stage", () => {
    const { container } = render(<DSPPipeline />);
    const stages = container.querySelectorAll(".dsp-stage");

    // Verify we have 6 stages but only 5 arrows
    expect(stages).toHaveLength(6);
    const arrows = container.querySelectorAll(".dsp-arrow");
    expect(arrows).toHaveLength(5);
  });

  it("renders stages in correct order", () => {
    const { container } = render(<DSPPipeline />);
    const stageTitles = container.querySelectorAll(".dsp-stage-title");

    expect(stageTitles[0]?.textContent).toBe("RF Input");
    expect(stageTitles[1]?.textContent).toBe("Tuner");
    expect(stageTitles[2]?.textContent).toBe("I/Q Sampling");
    expect(stageTitles[3]?.textContent).toBe("FFT");
    expect(stageTitles[4]?.textContent).toBe("Demodulation");
    expect(stageTitles[5]?.textContent).toBe("Audio Output");
  });

  it("wraps content in a card", () => {
    const { container } = render(<DSPPipeline />);
    const card = container.querySelector(".card");

    expect(card).toBeInTheDocument();
  });
});
