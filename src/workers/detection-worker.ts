/**
 * Signal Detection Worker
 * Implements ADR-0013: Automatic Signal Detection System
 *
 * Performs signal detection in a Web Worker for non-blocking operation
 */

import { NoiseFloorEstimator } from "../lib/detection/noise-floor";
import { PeakDetector } from "../lib/detection/peak-detector";
import { SignalClassifier } from "../lib/detection/signal-classifier";
import type { DetectionConfig } from "../lib/detection/detection-manager";

// Initialize detection components
const noiseFloorEstimator = new NoiseFloorEstimator();
const signalClassifier = new SignalClassifier();

/**
 * Message handler for detection requests
 */
self.onmessage = async (event) => {
  const startTime = performance.now();
  const { id, spectrum, sampleRate, centerFreq, config } = event.data;

  // Apply default configuration
  const detectionConfig: Required<DetectionConfig> = {
    thresholdDB: config?.thresholdDB ?? 10,
    minBandwidth: config?.minBandwidth ?? 1000,
    maxBandwidth: config?.maxBandwidth ?? 1_000_000,
    enableClassification: config?.enableClassification ?? true,
  };

  try {
    // Estimate noise floor
    const noiseFloor = noiseFloorEstimator.estimate(spectrum);

    // Create peak detector with config
    const peakDetector = new PeakDetector(
      detectionConfig.thresholdDB,
      detectionConfig.minBandwidth,
      detectionConfig.maxBandwidth,
    );

    // Detect peaks
    const peaks = peakDetector.detect(
      spectrum,
      noiseFloor,
      sampleRate,
      centerFreq,
    );

    // Classify signals if enabled
    const signals = detectionConfig.enableClassification
      ? peaks.map((peak) => signalClassifier.classify(peak, spectrum))
      : peaks.map((peak) => ({
          ...peak,
          type: "unknown" as const,
          confidence: 0,
        }));

    const processingTime = performance.now() - startTime;

    // Send results back to main thread
    self.postMessage({
      id,
      signals,
      noiseFloor,
      processingTime,
    });
  } catch (error) {
    console.error("Detection worker error:", error);
    self.postMessage({
      id,
      signals: [],
      noiseFloor: -Infinity,
      processingTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
