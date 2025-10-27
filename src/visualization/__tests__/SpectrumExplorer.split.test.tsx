import { render, screen, fireEvent } from "@testing-library/react";
import SpectrumExplorer from "../../visualization/components/SpectrumExplorer";

// Minimal samples to satisfy component logic
const makeSamples = (n: number) =>
  Array.from({ length: n }, () => ({ I: 0, Q: 0 }));

describe("SpectrumExplorer resizable split", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders a resize handle and updates persisted ratio with keyboard", () => {
    render(
      <SpectrumExplorer
        samples={makeSamples(4096)}
        sampleRate={2_000_000}
        centerFrequency={100_000_000}
        fftSize={2048}
        frames={24}
        overlap={0.5}
        showWaterfall={true}
      />,
    );

    // Handle is a focusable separator with an aria-label including current percentage
    const handle = screen.getByRole("separator", {
      name: /Resize split between spectrum and waterfall/i,
    });
    expect(handle).toBeInTheDocument();
    const labelBefore = handle.getAttribute("aria-label") || "";
    expect(labelBefore).toMatch(/Current: \d+ percent spectrum/);

    // Press ArrowUp to increase spectrum portion
    fireEvent.keyDown(handle, { key: "ArrowUp" });

    const labelAfter = handle.getAttribute("aria-label") || "";
    expect(labelAfter).toMatch(/Current: \d+ percent spectrum/);
    expect(labelAfter).not.toEqual(labelBefore);

    // Persisted
    const stored = window.localStorage.getItem("viz.splitRatio");
    expect(stored).toBeTruthy();
  });
});
