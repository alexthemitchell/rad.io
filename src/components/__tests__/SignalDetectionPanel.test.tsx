/**
 * SignalDetectionPanel Tests
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SignalDetectionPanel } from "../SignalDetectionPanel";
import type { ClassifiedSignal } from "../../lib/detection";

describe("SignalDetectionPanel", () => {
  const mockSignals: ClassifiedSignal[] = [
    {
      binIndex: 100,
      frequency: 146_000_000,
      power: -50,
      bandwidth: 15_000,
      snr: 30,
      type: "narrowband-fm",
      confidence: 0.8,
    },
    {
      binIndex: 200,
      frequency: 146_500_000,
      power: -45,
      bandwidth: 200_000,
      snr: 35,
      type: "wideband-fm",
      confidence: 0.9,
    },
    {
      binIndex: 300,
      frequency: 446_000_000,
      power: -55,
      bandwidth: 3_000,
      snr: 25,
      type: "digital",
      confidence: 0.7,
    },
  ];

  it("should render with no signals", () => {
    render(
      <SignalDetectionPanel
        signals={[]}
        noiseFloor={-80}
      />
    );

    expect(screen.getByText(/no signals detected/i)).toBeInTheDocument();
  });

  it("should display noise floor", () => {
    render(
      <SignalDetectionPanel
        signals={[]}
        noiseFloor={-75.5}
      />
    );

    expect(screen.getByText(/noise floor: -75\.5 dB/i)).toBeInTheDocument();
  });

  it("should display signal count", () => {
    render(
      <SignalDetectionPanel
        signals={mockSignals}
        noiseFloor={-80}
      />
    );

    expect(screen.getByText(/3 signals/i)).toBeInTheDocument();
  });

  it("should render all signals", () => {
    render(
      <SignalDetectionPanel
        signals={mockSignals}
        noiseFloor={-80}
      />
    );

    expect(screen.getByText(/146\.000 MHz/)).toBeInTheDocument();
    expect(screen.getByText(/146\.500 MHz/)).toBeInTheDocument();
    expect(screen.getByText(/446\.000 MHz/)).toBeInTheDocument();
  });

  it("should sort signals by SNR descending", () => {
    render(
      <SignalDetectionPanel
        signals={mockSignals}
        noiseFloor={-80}
      />
    );

    const frequencies = screen.getAllByText(/MHz/);
    // First should be highest SNR (146.500 MHz with SNR 35)
    expect(frequencies[0]).toHaveTextContent("146.500 MHz");
  });

  it("should display signal type badges", () => {
    render(
      <SignalDetectionPanel
        signals={mockSignals}
        noiseFloor={-80}
      />
    );

    expect(screen.getByText(/NARROWBAND FM/)).toBeInTheDocument();
    expect(screen.getByText(/WIDEBAND FM/)).toBeInTheDocument();
    expect(screen.getByText(/DIGITAL/)).toBeInTheDocument();
  });

  it("should display signal details", () => {
    render(
      <SignalDetectionPanel
        signals={[mockSignals[0]]}
        noiseFloor={-80}
      />
    );

    expect(screen.getByText(/-50\.0 dB/)).toBeInTheDocument(); // Power
    expect(screen.getByText(/30\.0 dB/)).toBeInTheDocument(); // SNR
    expect(screen.getByText(/15\.0 kHz/)).toBeInTheDocument(); // Bandwidth
    expect(screen.getByText(/80%/)).toBeInTheDocument(); // Confidence
  });

  it("should call onTuneToSignal when signal clicked", () => {
    const onTuneToSignal = jest.fn();
    
    render(
      <SignalDetectionPanel
        signals={[mockSignals[0]]}
        noiseFloor={-80}
        onTuneToSignal={onTuneToSignal}
      />
    );

    const signalItem = screen.getByRole("button");
    fireEvent.click(signalItem);

    expect(onTuneToSignal).toHaveBeenCalledWith(146_000_000);
  });

  it("should not make signals clickable without onTuneToSignal", () => {
    render(
      <SignalDetectionPanel
        signals={[mockSignals[0]]}
        noiseFloor={-80}
      />
    );

    const signalItems = screen.queryAllByRole("button");
    expect(signalItems).toHaveLength(0);
  });

  it("should call onClearSignals when clear button clicked", () => {
    const onClearSignals = jest.fn();
    
    render(
      <SignalDetectionPanel
        signals={mockSignals}
        noiseFloor={-80}
        onClearSignals={onClearSignals}
      />
    );

    const clearButton = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(clearButton);

    expect(onClearSignals).toHaveBeenCalled();
  });

  it("should disable clear button when no signals", () => {
    const onClearSignals = jest.fn();
    
    render(
      <SignalDetectionPanel
        signals={[]}
        noiseFloor={-80}
        onClearSignals={onClearSignals}
      />
    );

    const clearButton = screen.getByRole("button", { name: /clear/i });
    expect(clearButton).toBeDisabled();
  });

  it("should not show clear button without onClearSignals", () => {
    render(
      <SignalDetectionPanel
        signals={mockSignals}
        noiseFloor={-80}
      />
    );

    const clearButton = screen.queryByRole("button", { name: /clear/i });
    expect(clearButton).not.toBeInTheDocument();
  });

  it("should format frequencies correctly", () => {
    const signals: ClassifiedSignal[] = [
      {
        ...mockSignals[0],
        frequency: 1_000_000, // 1 MHz
      },
      {
        ...mockSignals[0],
        frequency: 500_000, // 500 kHz
      },
    ];

    render(
      <SignalDetectionPanel
        signals={signals}
        noiseFloor={-80}
      />
    );

    expect(screen.getByText(/1\.000 MHz/)).toBeInTheDocument();
    expect(screen.getByText(/500\.0 kHz/)).toBeInTheDocument();
  });

  it("should show tune hint when onTuneToSignal provided", () => {
    render(
      <SignalDetectionPanel
        signals={[mockSignals[0]]}
        noiseFloor={-80}
        onTuneToSignal={() => {}}
      />
    );

    expect(screen.getByText(/click to tune/i)).toBeInTheDocument();
  });
});
