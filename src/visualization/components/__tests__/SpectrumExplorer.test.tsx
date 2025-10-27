import { render, fireEvent } from "@testing-library/react";
import SpectrumExplorer from "../SpectrumExplorer";
import {
  createMockCanvasContext,
  createTestSamples,
} from "../../../utils/testHelpers";

describe("SpectrumExplorer", () => {
  beforeEach(() => {
    // Mock canvas 2D context
    HTMLCanvasElement.prototype.getContext = jest.fn(() =>
      createMockCanvasContext(),
    ) as jest.Mock;
  });

  it("renders controls and canvases", () => {
    const samples = createTestSamples(2048, "sine");
    const { getByLabelText, container } = render(
      <SpectrumExplorer
        samples={samples}
        sampleRate={2_000_000}
        centerFrequency={100_000_000}
        fftSize={2048}
      />,
    );

    expect(getByLabelText(/Spectrum plot/i)).toBeInTheDocument();
    expect(container.querySelector("canvas")).toBeInTheDocument();
    expect(container.textContent).toMatch(/Window/i);
    expect(container.textContent).toMatch(/Video Avg/i);
    expect(container.textContent).toMatch(/Peak Hold/i);
  });

  it("invokes onTune on double-click near center", () => {
    const samples = createTestSamples(2048, "sine");
    const onTune = jest.fn();
    const { getByRole } = render(
      <SpectrumExplorer
        samples={samples}
        sampleRate={2_000_000}
        centerFrequency={100_000_000}
        fftSize={2048}
        onTune={onTune}
      />,
    );

    const canvas = getByRole("img", {
      name: /Spectrum plot/i,
    }) as HTMLCanvasElement;

    // Stub bounding box for coordinate math
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (canvas as any).getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 900,
      bottom: 260,
      width: 900,
      height: 260,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // Double click in the horizontal center should map ~centerFrequency
    fireEvent.doubleClick(canvas, { clientX: 450, clientY: 50 });

    expect(onTune).toHaveBeenCalled();
    const tuned = onTune.mock.calls[0][0] as number;
    expect(Math.abs(tuned - 100_000_000)).toBeLessThan(2_000_000 / 2); // within half-span
  });

  it("can disable waterfall for performance", () => {
    const samples = createTestSamples(2048, "sine");
    const { container } = render(
      <SpectrumExplorer
        samples={samples}
        sampleRate={2_000_000}
        centerFrequency={100_000_000}
        fftSize={2048}
        showWaterfall={false}
      />,
    );

    // Only the spectrum canvas should be present
    const canvases = container.querySelectorAll("canvas");
    expect(canvases.length).toBe(1);
  });
});
