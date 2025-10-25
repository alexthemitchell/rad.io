/**
 * ScanControl Tests
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScanControl } from "../ScanControl";
import type { ScanConfig } from "../../lib/scanning/types";

describe("ScanControl", () => {
  const defaultProps = {
    isScanning: false,
    progress: 0,
    onStartScan: jest.fn(),
    onStopScan: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render with default values", () => {
    render(<ScanControl {...defaultProps} />);

    expect(screen.getByText(/frequency scanner/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start scan/i })).toBeInTheDocument();
  });

  it("should display initial frequency values", () => {
    render(<ScanControl {...defaultProps} />);

    expect(screen.getByText(/146\.000 MHz/)).toBeInTheDocument(); // Start freq
    expect(screen.getByText(/148\.000 MHz/)).toBeInTheDocument(); // End freq
  });

  it("should use initial config values", () => {
    const initialConfig = {
      startFreq: 100_000_000,
      endFreq: 120_000_000,
      step: 50_000,
      strategy: "adaptive" as const,
    };

    render(<ScanControl {...defaultProps} initialConfig={initialConfig} />);

    expect(screen.getByText(/100\.000 MHz/)).toBeInTheDocument();
    expect(screen.getByText(/120\.000 MHz/)).toBeInTheDocument();
    expect(screen.getByText(/50\.0 kHz/)).toBeInTheDocument();
  });

  it("should update start frequency", () => {
    render(<ScanControl {...defaultProps} />);

    const startFreqInput = screen.getByLabelText(/start frequency/i);
    fireEvent.change(startFreqInput, { target: { value: "100000000" } });

    expect(screen.getByText(/100\.000 MHz/)).toBeInTheDocument();
  });

  it("should update end frequency", () => {
    render(<ScanControl {...defaultProps} />);

    const endFreqInput = screen.getByLabelText(/end frequency/i);
    fireEvent.change(endFreqInput, { target: { value: "150000000" } });

    expect(screen.getByText(/150\.000 MHz/)).toBeInTheDocument();
  });

  it("should update step size", () => {
    render(<ScanControl {...defaultProps} />);

    const stepInput = screen.getByLabelText(/step size/i);
    fireEvent.change(stepInput, { target: { value: "50000" } });

    expect(screen.getByText(/50\.0 kHz/)).toBeInTheDocument();
  });

  it("should update scan strategy", () => {
    render(<ScanControl {...defaultProps} />);

    const strategySelect = screen.getByLabelText(/scan strategy/i);
    fireEvent.change(strategySelect, { target: { value: "adaptive" } });

    expect(strategySelect).toHaveValue("adaptive");
  });

  it("should calculate total frequencies", () => {
    render(<ScanControl {...defaultProps} />);

    // Default: 146 MHz to 148 MHz, step 25 kHz
    // (148000000 - 146000000) / 25000 = 80 + 1 = 81 frequencies
    expect(screen.getByText(/81/)).toBeInTheDocument();
  });

  it("should calculate estimated time", () => {
    render(<ScanControl {...defaultProps} />);

    // 81 frequencies * 50ms = 4050ms = 4.1s
    expect(screen.getByText(/4\.1s/)).toBeInTheDocument();
  });

  it("should call onStartScan with correct config", () => {
    const onStartScan = jest.fn();
    
    render(<ScanControl {...defaultProps} onStartScan={onStartScan} />);

    const startButton = screen.getByRole("button", { name: /start scan/i });
    fireEvent.click(startButton);

    expect(onStartScan).toHaveBeenCalledWith(
      expect.objectContaining({
        startFreq: 146_000_000,
        endFreq: 148_000_000,
        step: 25_000,
        strategy: "linear",
        settlingTime: 50,
        sampleCount: 2048,
      })
    );
  });

  it("should show validation error for invalid frequency range", () => {
    render(<ScanControl {...defaultProps} />);

    const startFreqInput = screen.getByLabelText(/start frequency/i);
    fireEvent.change(startFreqInput, { target: { value: "150000000" } });

    const startButton = screen.getByRole("button", { name: /start scan/i });
    fireEvent.click(startButton);

    expect(screen.getByText(/start frequency must be less than end frequency/i)).toBeInTheDocument();
  });

  it("should not call onStartScan with invalid range", () => {
    const onStartScan = jest.fn();
    
    render(<ScanControl {...defaultProps} onStartScan={onStartScan} />);

    const startFreqInput = screen.getByLabelText(/start frequency/i);
    fireEvent.change(startFreqInput, { target: { value: "150000000" } });

    const startButton = screen.getByRole("button", { name: /start scan/i });
    fireEvent.click(startButton);

    expect(onStartScan).not.toHaveBeenCalled();
  });

  it("should clear validation error on next attempt", () => {
    render(<ScanControl {...defaultProps} />);

    // Create error
    const startFreqInput = screen.getByLabelText(/start frequency/i);
    fireEvent.change(startFreqInput, { target: { value: "150000000" } });
    
    const startButton = screen.getByRole("button", { name: /start scan/i });
    fireEvent.click(startButton);
    
    expect(screen.getByText(/start frequency must be less than end frequency/i)).toBeInTheDocument();

    // Fix and try again
    fireEvent.change(startFreqInput, { target: { value: "146000000" } });
    fireEvent.click(startButton);

    expect(screen.queryByText(/start frequency must be less than end frequency/i)).not.toBeInTheDocument();
  });

  it("should show progress bar when scanning", () => {
    render(<ScanControl {...defaultProps} isScanning={true} progress={50} />);

    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it("should show stop button when scanning", () => {
    render(<ScanControl {...defaultProps} isScanning={true} />);

    expect(screen.getByRole("button", { name: /stop scan/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start scan/i })).not.toBeInTheDocument();
  });

  it("should call onStopScan when stop button clicked", () => {
    const onStopScan = jest.fn();
    
    render(<ScanControl {...defaultProps} isScanning={true} onStopScan={onStopScan} />);

    const stopButton = screen.getByRole("button", { name: /stop scan/i });
    fireEvent.click(stopButton);

    expect(onStopScan).toHaveBeenCalled();
  });

  it("should disable inputs when scanning", () => {
    render(<ScanControl {...defaultProps} isScanning={true} />);

    const startFreqInput = screen.getByLabelText(/start frequency/i);
    const endFreqInput = screen.getByLabelText(/end frequency/i);
    const stepInput = screen.getByLabelText(/step size/i);
    const strategySelect = screen.getByLabelText(/scan strategy/i);

    expect(startFreqInput).toBeDisabled();
    expect(endFreqInput).toBeDisabled();
    expect(stepInput).toBeDisabled();
    expect(strategySelect).toBeDisabled();
  });

  it("should display all scan strategies", () => {
    render(<ScanControl {...defaultProps} />);

    const strategySelect = screen.getByLabelText(/scan strategy/i);
    
    expect(strategySelect).toContainHTML("Linear");
    expect(strategySelect).toContainHTML("Adaptive");
    expect(strategySelect).toContainHTML("Priority");
  });
});
