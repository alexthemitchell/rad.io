import React from "react";
import { render, fireEvent } from "@testing-library/react";
import InteractiveDSPPipeline from "../InteractiveDSPPipeline";

describe("InteractiveDSPPipeline", () => {
  const mockDevice = undefined;
  const mockSamples = Array.from({ length: 1024 }, (_, i) => ({
    I: Math.sin(i),
    Q: Math.cos(i),
  }));

  it("renders all stage buttons", () => {
    const { getAllByRole } = render(
      <InteractiveDSPPipeline device={mockDevice} samples={mockSamples} />,
    );
    const buttons = getAllByRole("tab");
    expect(buttons.length).toBeGreaterThanOrEqual(6);
  });

  it("shows stage panel when a stage is selected", () => {
    const { getByRole, getByTestId } = render(
      <InteractiveDSPPipeline device={mockDevice} samples={mockSamples} />,
    );
    const firstStage = getByRole("tab", {
      selected: true,
    }) as HTMLButtonElement | null;
    // Click FFT tab by data-stage attr
    const tabs = document.querySelectorAll("button[data-stage]");
    const fftTab = Array.from(tabs).find(
      (el) => el.getAttribute("data-stage") === "fft",
    ) as HTMLButtonElement | undefined;
    if (fftTab) {
      fireEvent.click(fftTab);
    } else if (firstStage) {
      fireEvent.click(firstStage);
    }
    expect(getByTestId("stage-panel")).toBeInTheDocument();
  });
});
