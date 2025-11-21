/**
 * VfoManagerPanel Component Tests
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { VfoManagerPanel } from "../VfoManagerPanel";
import { VfoStatus } from "../../types/vfo";
import type { VfoState } from "../../types/vfo";

describe("VfoManagerPanel", () => {
  const mockOnToggleAudio = jest.fn();
  const mockOnRemove = jest.fn();
  const mockOnSelect = jest.fn();

  const createMockVfo = (
    id: string,
    centerHz: number,
    modeId: string,
    audioEnabled = true,
  ): VfoState => ({
    id,
    centerHz,
    modeId,
    bandwidthHz: 10_000,
    audioEnabled,
    audioGain: 1.0,
    status: VfoStatus.ACTIVE,
    demodulator: null,
    audioNode: null,
    metrics: {
      rssi: -50.5,
      samplesProcessed: 1000,
      processingTime: 5,
      timestamp: Date.now(),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render empty state when no VFOs", () => {
    render(
      <VfoManagerPanel
        vfos={[]}
        onToggleAudio={mockOnToggleAudio}
        onRemove={mockOnRemove}
      />,
    );

    expect(screen.getByText("No VFOs created")).toBeInTheDocument();
    expect(
      screen.getByText("Alt+Click on the waterfall to add a VFO"),
    ).toBeInTheDocument();
  });

  it("should render VFO list with count", () => {
    const vfos = [
      createMockVfo("vfo-1", 100_000_000, "am"),
      createMockVfo("vfo-2", 101_000_000, "wbfm"),
    ];

    render(
      <VfoManagerPanel
        vfos={vfos}
        onToggleAudio={mockOnToggleAudio}
        onRemove={mockOnRemove}
      />,
    );

    expect(screen.getByText("VFO Manager (2)")).toBeInTheDocument();
  });

  it("should display VFO information", () => {
    const vfos = [createMockVfo("vfo-1", 100_500_000, "am")];

    render(
      <VfoManagerPanel
        vfos={vfos}
        onToggleAudio={mockOnToggleAudio}
        onRemove={mockOnRemove}
      />,
    );

    expect(screen.getByText("AM")).toBeInTheDocument();
    expect(screen.getByText("100.500000 MHz")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("RSSI: -50.5 dBFS")).toBeInTheDocument();
  });

  it("should show audio indicator when audio enabled", () => {
    const vfos = [createMockVfo("vfo-1", 100_000_000, "am", true)];

    render(
      <VfoManagerPanel
        vfos={vfos}
        onToggleAudio={mockOnToggleAudio}
        onRemove={mockOnRemove}
      />,
    );

    expect(screen.getByLabelText("Audio active")).toBeInTheDocument();
  });

  it("should not show audio indicator when audio disabled", () => {
    const vfos = [createMockVfo("vfo-1", 100_000_000, "am", false)];

    render(
      <VfoManagerPanel
        vfos={vfos}
        onToggleAudio={mockOnToggleAudio}
        onRemove={mockOnRemove}
      />,
    );

    expect(screen.queryByLabelText("Audio active")).not.toBeInTheDocument();
  });

  it("should call onToggleAudio when audio checkbox is changed", () => {
    const vfos = [createMockVfo("vfo-1", 100_000_000, "am", true)];

    render(
      <VfoManagerPanel
        vfos={vfos}
        onToggleAudio={mockOnToggleAudio}
        onRemove={mockOnRemove}
      />,
    );

    const checkbox = screen.getByLabelText(
      "Enable audio for VFO at 100.000000 MHz",
    ) as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(mockOnToggleAudio).toHaveBeenCalledWith("vfo-1", false);
    expect(mockOnToggleAudio).toHaveBeenCalledTimes(1);
  });

  it("should call onRemove when remove button is clicked", () => {
    const vfos = [createMockVfo("vfo-1", 100_000_000, "am")];

    render(
      <VfoManagerPanel
        vfos={vfos}
        onToggleAudio={mockOnToggleAudio}
        onRemove={mockOnRemove}
      />,
    );

    const removeButton = screen.getByLabelText("Remove VFO at 100.000000 MHz");
    fireEvent.click(removeButton);

    expect(mockOnRemove).toHaveBeenCalledWith("vfo-1");
    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it("should call onSelect when VFO item is clicked", () => {
    const vfos = [createMockVfo("vfo-1", 100_000_000, "am")];

    render(
      <VfoManagerPanel
        vfos={vfos}
        onToggleAudio={mockOnToggleAudio}
        onRemove={mockOnRemove}
        onSelect={mockOnSelect}
      />,
    );

    const vfoItem = screen.getByText("AM").closest(".vfo-item");
    fireEvent.click(vfoItem!);

    expect(mockOnSelect).toHaveBeenCalledWith("vfo-1");
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it("should not call onSelect when audio checkbox is clicked", () => {
    const vfos = [createMockVfo("vfo-1", 100_000_000, "am", true)];

    render(
      <VfoManagerPanel
        vfos={vfos}
        onToggleAudio={mockOnToggleAudio}
        onRemove={mockOnRemove}
        onSelect={mockOnSelect}
      />,
    );

    const checkbox = screen.getByLabelText(
      "Enable audio for VFO at 100.000000 MHz",
    ) as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(mockOnToggleAudio).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it("should render multiple VFOs correctly", () => {
    const vfos = [
      createMockVfo("vfo-1", 100_000_000, "am"),
      createMockVfo("vfo-2", 101_000_000, "wbfm"),
      createMockVfo("vfo-3", 102_000_000, "nbfm"),
    ];

    render(
      <VfoManagerPanel
        vfos={vfos}
        onToggleAudio={mockOnToggleAudio}
        onRemove={mockOnRemove}
      />,
    );

    expect(screen.getByText("VFO Manager (3)")).toBeInTheDocument();
    expect(screen.getByText("AM")).toBeInTheDocument();
    expect(screen.getByText("WBFM")).toBeInTheDocument();
    expect(screen.getByText("NBFM")).toBeInTheDocument();
  });
});
