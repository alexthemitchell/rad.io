/**
 * Automatic signal detection hook for live spectrum monitoring
 * Continuously analyzes FFT data to detect and track active signals
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { SignalClassifier } from "../lib/detection/signal-classifier";
import {
  detectSpectralPeaks,
  estimateNoiseFloor,
  type SpectralPeak,
} from "../utils/dsp";
import type { ClassifiedSignal } from "../lib/detection/signal-classifier";

/**
 * Detected signal with visualization metadata
 */
export interface DetectedSignal extends ClassifiedSignal {
  /** Timestamp when last detected */
  lastSeen: number;
  /** Whether signal is currently active */
  isActive: boolean;
  /** Signal label (optional) */
  label?: string;
}

/**
 * Configuration for automatic signal detection
 */
export interface SignalDetectionConfig {
  /** Whether automatic detection is enabled */
  enabled: boolean;
  /** Threshold in dB above noise floor */
  thresholdDb: number;
  /** Minimum spacing between detected peaks in Hz */
  minPeakSpacing: number;
  /** Update interval in ms (how often to check for signals) */
  updateInterval: number;
  /** Timeout in ms - signals not seen within this time are marked inactive */
  signalTimeout: number;
}

/**
 * Return value from useSignalDetection hook
 */
export interface UseSignalDetectionResult {
  /** Currently detected signals */
  signals: DetectedSignal[];
  /** Configuration */
  config: SignalDetectionConfig;
  /** Update configuration */
  updateConfig: (updates: Partial<SignalDetectionConfig>) => void;
  /** Clear all detected signals */
  clearSignals: () => void;
  /** Manually trigger detection (useful for testing) */
  detectNow: () => void;
}

/**
 * Hook for automatic signal detection during live spectrum monitoring
 *
 * @param fftData Current FFT magnitude data (dB)
 * @param sampleRate Sample rate in Hz
 * @param centerFrequency Center frequency in Hz
 * @param enabled Whether detection is enabled
 * @returns Signal detection state and controls
 */
export function useSignalDetection(
  fftData: Float32Array | null,
  sampleRate: number,
  centerFrequency: number,
  enabled = true,
): UseSignalDetectionResult {
  const [config, setConfig] = useState<SignalDetectionConfig>({
    enabled,
    thresholdDb: 10, // 10 dB above noise floor
    minPeakSpacing: 100e3, // 100 kHz minimum between peaks
    updateInterval: 500, // Check every 500ms
    signalTimeout: 2000, // Mark inactive after 2 seconds
  });

  const [signals, setSignals] = useState<DetectedSignal[]>([]);
  const signalClassifierRef = useRef<SignalClassifier | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Initialize signal classifier once
  useEffect(() => {
    signalClassifierRef.current = new SignalClassifier();
  }, []);

  /**
   * Detect signals in current FFT data
   */
  const detectSignals = useCallback((): void => {
    if (
      !config.enabled ||
      !fftData ||
      fftData.length === 0 ||
      !signalClassifierRef.current
    ) {
      return;
    }

    const now = Date.now();

    // Estimate noise floor
    const noiseFloor = estimateNoiseFloor(fftData);
    const threshold = noiseFloor + config.thresholdDb;

    // Detect peaks above threshold
    const peaks: SpectralPeak[] = detectSpectralPeaks(
      fftData,
      sampleRate,
      centerFrequency,
      threshold,
      config.minPeakSpacing,
    );

    // Classify each peak and create/update signal records
    const detectedSignals = new Map<number, DetectedSignal>();

    for (const peak of peaks) {
      // Calculate bandwidth (estimate from -3dB width)
      const binIndex = peak.binIndex;
      const peakPower = fftData[binIndex];
      if (peakPower === undefined) {
        continue;
      }

      const halfPower = peakPower - 3; // -3 dB width
      let left = binIndex;
      while (left > 0 && (fftData[left] ?? -Infinity) > halfPower) {
        left--;
      }
      let right = binIndex;
      while (
        right < fftData.length - 1 &&
        (fftData[right] ?? -Infinity) > halfPower
      ) {
        right++;
      }

      // Calculate bins width - for single-bin signals, use 1 bin minimum for bandwidth estimate
      const binsWidth = right === left ? 1 : right - left;
      const freqRes = sampleRate / fftData.length;
      const bandwidth = binsWidth * freqRes;

      // Classify signal
      const classified = signalClassifierRef.current.classify(
        {
          binIndex: peak.binIndex,
          frequency: peak.frequency,
          power: peak.powerDb,
          bandwidth,
          snr: peak.powerDb - noiseFloor,
        },
        fftData,
      );

      // Create or update signal record
      detectedSignals.set(peak.frequency, {
        ...classified,
        lastSeen: now,
        isActive: true,
      });
    }

    // Update signals state
    setSignals((prevSignals) => {
      // Merge with existing signals
      const updatedSignals = new Map<number, DetectedSignal>();

      // Keep existing signals, update if still detected
      for (const signal of prevSignals) {
        const detected = detectedSignals.get(signal.frequency);
        if (detected) {
          // Signal still active, update it
          updatedSignals.set(signal.frequency, detected);
        } else {
          // Signal not detected this time
          const timeSinceLastSeen = now - signal.lastSeen;
          if (timeSinceLastSeen < config.signalTimeout) {
            // Keep it but mark as potentially inactive
            updatedSignals.set(signal.frequency, {
              ...signal,
              isActive: false,
            });
          }
          // Otherwise, signal has timed out and will be removed
        }
      }

      // Add newly detected signals
      for (const [freq, signal] of detectedSignals) {
        if (!updatedSignals.has(freq)) {
          updatedSignals.set(freq, signal);
        }
      }

      return Array.from(updatedSignals.values()).sort(
        (a, b) => b.power - a.power, // Sort by power (strongest first)
      );
    });

    lastUpdateRef.current = now;
  }, [
    config.enabled,
    config.thresholdDb,
    config.minPeakSpacing,
    config.signalTimeout,
    fftData,
    sampleRate,
    centerFrequency,
  ]);

  /**
   * Start automatic detection
   */
  useEffect(() => {
    if (!config.enabled) {
      // Clear interval if detection is disabled
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      return;
    }

    // Set up periodic detection
    detectionIntervalRef.current = setInterval(() => {
      detectSignals();
    }, config.updateInterval);

    // Run initial detection
    detectSignals();

    return (): void => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [config.enabled, config.updateInterval, detectSignals]);

  /**
   * Update configuration
   */
  const updateConfig = useCallback(
    (updates: Partial<SignalDetectionConfig>): void => {
      setConfig((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  /**
   * Clear all detected signals
   */
  const clearSignals = useCallback((): void => {
    setSignals([]);
  }, []);

  /**
   * Manually trigger detection (useful for testing)
   */
  const detectNow = useCallback((): void => {
    detectSignals();
  }, [detectSignals]);

  return useMemo(
    () => ({
      signals,
      config,
      updateConfig,
      clearSignals,
      detectNow,
    }),
    [signals, config, updateConfig, clearSignals, detectNow],
  );
}
