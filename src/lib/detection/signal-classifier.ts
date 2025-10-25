/**
 * Signal Classifier
 * Implements ADR-0013: Automatic Signal Detection System
 *
 * Classifies detected signals based on bandwidth and spectral characteristics
 */

import type { Peak } from "./peak-detector";

/**
 * Signal type classifications
 */
export type SignalType =
  | "narrowband-fm" // 8-30 kHz bandwidth
  | "wideband-fm" // 150-250 kHz bandwidth
  | "am" // 4-12 kHz bandwidth
  | "digital" // 1-5 kHz with sharp edges
  | "pulsed" // Intermittent signal
  | "unknown"; // Cannot classify

/**
 * Classified signal with type and confidence
 */
export interface ClassifiedSignal extends Peak {
  /** Signal type classification */
  type: SignalType;
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * Classifies signals based on characteristics
 */
export class SignalClassifier {
  /**
   * Classify a detected peak
   * @param peak Detected peak to classify
   * @param spectrum Full power spectrum
   * @returns Classified signal with type and confidence
   */
  classify(peak: Peak, spectrum: Float32Array): ClassifiedSignal {
    let type: SignalType = "unknown";
    let confidence = 0;

    // Digital: Often narrowband with sharp edges (check first for priority)
    if (peak.bandwidth >= 1_000 && peak.bandwidth <= 5_000) {
      const sharpness = this.measureEdgeSharpness(peak, spectrum);
      if (sharpness > 0.5) {
        type = "digital";
        confidence = 0.6;
      }
    }
    
    // AM: bandwidth 4-11 kHz (but not if already classified as digital)
    if (type === "unknown" && peak.bandwidth >= 4_000 && peak.bandwidth < 12_000) {
      type = "am";
      confidence = 0.7;
    }
    
    // FM: bandwidth ~12-30 kHz (narrowband) or ~150-250 kHz (wideband)
    if (type === "unknown" && peak.bandwidth >= 12_000 && peak.bandwidth <= 30_000) {
      type = "narrowband-fm";
      confidence = 0.8;
    } else if (type === "unknown" && peak.bandwidth >= 150_000 && peak.bandwidth <= 250_000) {
      type = "wideband-fm";
      confidence = 0.9;
    }

    return {
      ...peak,
      type,
      confidence,
    };
  }

  /**
   * Measure how sharply power drops at peak edges
   * @param peak Detected peak
   * @param spectrum Full power spectrum
   * @returns Sharpness score 0-1 (higher = sharper edges)
   */
  private measureEdgeSharpness(peak: Peak, spectrum: Float32Array): number {
    const binIndex = peak.binIndex;
    const power = spectrum[binIndex];
    const halfPower = power * 0.5;

    // Find left edge (where power drops below half)
    let leftEdge = binIndex;
    while (leftEdge > 0 && spectrum[leftEdge] > halfPower) {
      leftEdge--;
    }

    // Find right edge (where power drops below half)
    let rightEdge = binIndex;
    while (rightEdge < spectrum.length - 1 && spectrum[rightEdge] > halfPower) {
      rightEdge++;
    }

    // Calculate edge width and rolloff rate
    const edgeWidth = rightEdge - leftEdge;
    if (edgeWidth === 0) return 1; // Zero width = infinitely sharp edges

    const rolloff = Math.abs(power) / edgeWidth;

    // Normalize to [0, 1] - higher rolloff = sharper edges
    // Adjusted scaling for better detection
    return Math.min(rolloff / 5, 1);
  }
}
