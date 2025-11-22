/**
 * VfoBadgeOverlay Component Tests
 */

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { VfoBadgeOverlay } from "../VfoBadgeOverlay";
import { VfoStatus } from "../../types/vfo";
import type { VfoState } from "../../types/vfo";

describe("VfoBadgeOverlay", () => {
  const mockOnRemove = jest.fn();
  const mockOnSelect = jest.fn();

  const createMockVfo = (
    id: string,
    centerHz: number,
    modeId: string,
  ): VfoState => ({
    id,
    centerHz,
    modeId,
    bandwidthHz: 10_000,
    audioEnabled: true,
    audioGain: 1.0,
    status: VfoStatus.ACTIVE,
    demodulator: null,
    audioNode: null,
    metrics: {
      rssi: -50,
      samplesProcessed: 1000,
      processingTime: 5,
      timestamp: Date.now(),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render VFO badges for all VFOs", () => {
    const vfos = [
      createMockVfo("vfo-1", 100_000_000, "am"),
      createMockVfo("vfo-2", 101_000_000, "wbfm"),
    ];

    render(
      <VfoBadgeOverlay
        vfos={vfos}
        sampleRate={2_000_000}
        centerFrequency={100_000_000}
        width={750}
        height={400}
        onRemove={mockOnRemove}
      />,
    );

    expect(screen.getByText("AM")).toBeInTheDocument();
    expect(screen.getByText("WBFM")).toBeInTheDocument();
    expect(screen.getByText("100 MHz")).toBeInTheDocument();
    expect(screen.getByText("101 MHz")).toBeInTheDocument();
  });

  it("should not render VFOs outside visible range", () => {
    const vfos = [
      createMockVfo("vfo-1", 100_000_000, "am"),
      createMockVfo("vfo-2", 150_000_000, "wbfm"), // Outside range
    ];

    render(
      <VfoBadgeOverlay
        vfos={vfos}
        sampleRate={2_000_000}
        centerFrequency={100_000_000}
        width={750}
        height={400}
        onRemove={mockOnRemove}
      />,
    );

    expect(screen.getByText("AM")).toBeInTheDocument();
    expect(screen.queryByText("WBFM")).not.toBeInTheDocument();
  });

  it("should call onRemove when remove button is clicked", () => {
    const vfos = [createMockVfo("vfo-1", 100_000_000, "am")];

    render(
      <VfoBadgeOverlay
        vfos={vfos}
        sampleRate={2_000_000}
        centerFrequency={100_000_000}
        width={750}
        height={400}
        onRemove={mockOnRemove}
      />,
    );

    const removeButton = screen.getByLabelText("Remove VFO at 100 MHz");
    fireEvent.click(removeButton);

    expect(mockOnRemove).toHaveBeenCalledWith("vfo-1");
    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it("should call onSelect when badge is clicked", () => {
    const vfos = [createMockVfo("vfo-1", 100_000_000, "am")];

    render(
      <VfoBadgeOverlay
        vfos={vfos}
        sampleRate={2_000_000}
        centerFrequency={100_000_000}
        width={750}
        height={400}
        onRemove={mockOnRemove}
        onSelect={mockOnSelect}
      />,
    );

    const badge = screen.getByText("AM").closest(".vfo-badge");
    fireEvent.click(badge!);

    expect(mockOnSelect).toHaveBeenCalledWith("vfo-1");
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it("should not call onSelect when remove button is clicked", () => {
    const vfos = [createMockVfo("vfo-1", 100_000_000, "am")];

    render(
      <VfoBadgeOverlay
        vfos={vfos}
        sampleRate={2_000_000}
        centerFrequency={100_000_000}
        width={750}
        height={400}
        onRemove={mockOnRemove}
        onSelect={mockOnSelect}
      />,
    );

    const removeButton = screen.getByLabelText("Remove VFO at 100 MHz");
    fireEvent.click(removeButton);

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it("should render empty overlay when no VFOs", () => {
    const { container } = render(
      <VfoBadgeOverlay
        vfos={[]}
        sampleRate={2_000_000}
        centerFrequency={100_000_000}
        width={750}
        height={400}
        onRemove={mockOnRemove}
      />,
    );

    const overlay = container.querySelector(".vfo-badge-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay?.children.length).toBe(0);
  });
});
