/**
 * Tests for useSignalDetection hook
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useSignalDetection } from "../useSignalDetection";

// Mock the DSP utilities
jest.mock("../../utils/dsp", () => ({
  detectSpectralPeaks: jest.fn(() => [
    {
      frequency: 99_300_000, // 99.3 MHz
      powerDb: -40,
      binIndex: 666, // ~99.3 MHz with center=99 MHz, SR=2 MHz
    },
    {
      frequency: 99_700_000, // 99.7 MHz (400 kHz spacing for FM grid)
      powerDb: -50,
      binIndex: 870, // ~99.7 MHz with center=99 MHz, SR=2 MHz
    },
  ]),
  estimateNoiseFloor: jest.fn(() => -80),
}));

// Mock SignalClassifier
jest.mock("../../lib/detection/signal-classifier", () => ({
  SignalClassifier: jest.fn().mockImplementation(() => ({
    classify: jest.fn((peak) => ({
      ...peak,
      type: "wideband-fm",
      confidence: 0.9,
    })),
  })),
}));

describe("useSignalDetection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with no signals", async () => {
    const fftData = new Float32Array(1024).fill(-80);
    const { result } = renderHook(() =>
      useSignalDetection(fftData, 2e6, 100e6, false),
    );

    // Initially no signals
    expect(result.current.signals).toHaveLength(0);
    expect(result.current.config.enabled).toBe(false);
  });

  it("should detect signals when enabled", async () => {
    const fftData = new Float32Array(1024).fill(-80);
    // Add some peaks to the FFT data - space them so they don't snap to same FM grid
    fftData[666] = -40; // ~99.3 MHz (will snap to 99.3 FM grid)
    fftData[870] = -50; // ~99.7 MHz (will snap to 99.7 FM grid, 400 kHz apart)

    // Center frequency is 99 MHz to avoid DC spike filtering (which excludes ±100 kHz from center)
    const { result } = renderHook(() =>
      useSignalDetection(fftData, 2e6, 99e6, true),
    );

    // Manually trigger detection
    result.current.detectNow();

    // Wait for signals to be detected
    await waitFor(
      () => {
        expect(result.current.signals.length).toBeGreaterThan(0);
      },
      { timeout: 1000 },
    );

    expect(result.current.signals).toHaveLength(2);
    expect(result.current.signals[0]?.type).toBe("wideband-fm");
    expect(result.current.signals[0]?.isActive).toBe(true);
  });

  it("should not detect signals when disabled", () => {
    const fftData = new Float32Array(1024).fill(-80);
    fftData[512] = -40; // Strong signal

    const { result } = renderHook(() =>
      useSignalDetection(fftData, 2e6, 100e6, false),
    );

    result.current.detectNow();

    expect(result.current.signals).toHaveLength(0);
  });

  it("should update configuration", async () => {
    const fftData = new Float32Array(1024).fill(-80);
    const { result } = renderHook(() =>
      useSignalDetection(fftData, 2e6, 100e6, true),
    );

    result.current.updateConfig({ thresholdDb: 15 });

    // Wait for config update
    await waitFor(() => {
      expect(result.current.config.thresholdDb).toBe(15);
    });
  });

  it("should clear signals", async () => {
    const fftData = new Float32Array(1024).fill(-80);
    fftData[512] = -40;

    const { result } = renderHook(() =>
      useSignalDetection(fftData, 2e6, 100e6, true),
    );

    result.current.detectNow();

    await waitFor(() => {
      expect(result.current.signals.length).toBeGreaterThan(0);
    });

    result.current.clearSignals();

    // Wait for state update
    await waitFor(() => {
      expect(result.current.signals).toHaveLength(0);
    });
  });

  it("should mark signals as inactive after timeout", async () => {
    const fftData = new Float32Array(1024).fill(-80);
    fftData[512] = -40;

    const { result, rerender } = renderHook(() =>
      useSignalDetection(fftData, 2e6, 100e6, true),
    );

    // Update config to have short timeout
    result.current.updateConfig({ signalTimeout: 100 });

    result.current.detectNow();

    await waitFor(() => {
      expect(result.current.signals.length).toBeGreaterThan(0);
    });

    expect(result.current.signals[0]?.isActive).toBe(true);

    // Remove the signal from FFT data and wait for timeout
    fftData[512] = -80;
    rerender();

    // Wait for timeout + detection interval
    await waitFor(
      () => {
        result.current.detectNow();
        return result.current.signals[0]?.isActive === false;
      },
      { timeout: 1000 },
    );
  });

  it("should handle null FFT data gracefully", () => {
    const { result } = renderHook(() =>
      useSignalDetection(null, 2e6, 100e6, true),
    );

    result.current.detectNow();

    expect(result.current.signals).toHaveLength(0);
  });
});
