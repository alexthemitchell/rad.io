/**
 * Unified DSP Primitives
 *
 * Core signal processing operations consolidated from various parts of the codebase.
 * Provides both TypeScript and WASM-accelerated implementations with automatic fallback.
 *
 * This module eliminates duplication by providing a single source of truth for:
 * - Window functions (Hann, Hamming, Blackman, Kaiser)
 * - DC offset correction (Static, IIR, Combined)
 * - Automatic Gain Control (AGC)
 * - Sample format conversions
 *
 * @module dsp/primitives
 */

import {
  isWasmAvailable,
  applyHannWindowWasm,
  applyHammingWindowWasm,
  applyBlackmanWindowWasm,
  removeDCOffsetStaticWasm,
  removeDCOffsetIIRWasm,
} from "../../utils/dspWasm";
import type {
  Sample,
  WindowFunction,
  DCCorrectionMode,
  DCBlockerState,
  AGCParameters,
} from "./types";

// Threshold constants for numerical stability
const DC_OFFSET_THRESHOLD = 1e-3; // Minimum absolute DC component to correct

/**
 * Apply Hann window to IQ samples
 *
 * Hann window formula: w(n) = 0.5 * (1 - cos(2π*n/(N-1)))
 *
 * Characteristics:
 * - Good general-purpose window
 * - First sidelobe: -31 dB
 * - Main lobe width: 8π/N (4 bins)
 * - Recommended for most spectrum analysis
 *
 * @param samples - Input IQ samples
 * @returns Windowed samples (new array)
 */
export function applyHannWindow(samples: Sample[]): Sample[] {
  const N = samples.length;
  const windowed: Sample[] = [];
  for (let n = 0; n < N; n++) {
    const sample = samples[n];
    if (sample) {
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
      windowed.push({ I: sample.I * w, Q: sample.Q * w });
    }
  }
  return windowed;
}

/**
 * Apply Hamming window to IQ samples
 *
 * Hamming window formula: w(n) = 0.54 - 0.46 * cos(2π*n/(N-1))
 *
 * Characteristics:
 * - Better sidelobe suppression than Hann
 * - First sidelobe: -43 dB
 * - Main lobe width: 8π/N (4 bins)
 * - Slight discontinuity at endpoints
 *
 * @param samples - Input IQ samples
 * @returns Windowed samples (new array)
 */
export function applyHammingWindow(samples: Sample[]): Sample[] {
  const N = samples.length;
  const windowed: Sample[] = [];
  for (let n = 0; n < N; n++) {
    const sample = samples[n];
    if (sample) {
      const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1));
      windowed.push({ I: sample.I * w, Q: sample.Q * w });
    }
  }
  return windowed;
}

/**
 * Apply Blackman window to IQ samples
 *
 * Blackman window formula: w(n) = 0.42 - 0.5*cos(2π*n/(N-1)) + 0.08*cos(4π*n/(N-1))
 *
 * Characteristics:
 * - Excellent sidelobe suppression
 * - First sidelobe: -58 dB
 * - Main lobe width: 12π/N (6 bins)
 * - Best for weak signal detection
 *
 * @param samples - Input IQ samples
 * @returns Windowed samples (new array)
 */
export function applyBlackmanWindow(samples: Sample[]): Sample[] {
  const N = samples.length;
  const windowed: Sample[] = [];
  for (let n = 0; n < N; n++) {
    const sample = samples[n];
    if (sample) {
      const w =
        0.42 -
        0.5 * Math.cos((2 * Math.PI * n) / (N - 1)) +
        0.08 * Math.cos((4 * Math.PI * n) / (N - 1));
      windowed.push({ I: sample.I * w, Q: sample.Q * w });
    }
  }
  return windowed;
}

/**
 * Apply Kaiser window to IQ samples
 *
 * Kaiser window provides adjustable trade-off between main lobe width
 * and sidelobe level via the beta parameter.
 *
 * Characteristics:
 * - beta = 0: Rectangular window
 * - beta = 5: Similar to Hamming (default)
 * - beta = 8.6: Similar to Blackman
 * - beta > 10: Very wide main lobe, excellent sidelobe suppression
 *
 * @param samples - Input IQ samples
 * @param beta - Shape parameter (default 5)
 * @returns Windowed samples (new array)
 */
export function applyKaiserWindow(samples: Sample[], beta = 5): Sample[] {
  const N = samples.length;
  const windowed: Sample[] = [];

  // Modified Bessel function of the first kind (I0)
  const besselI0 = (x: number): number => {
    let sum = 1;
    let term = 1;
    for (let k = 1; k < 50; k++) {
      term *= (x * x) / (4 * k * k);
      sum += term;
      if (term < 1e-10) {
        break;
      }
    }
    return sum;
  };

  const denominator = besselI0(beta);

  for (let n = 0; n < N; n++) {
    const alpha = (N - 1) / 2;
    const sample = samples[n];
    if (sample) {
      const arg = beta * Math.sqrt(1 - Math.pow((n - alpha) / alpha, 2));
      const w = besselI0(arg) / denominator;
      windowed.push({ I: sample.I * w, Q: sample.Q * w });
    }
  }
  return windowed;
}

/**
 * Apply window function to IQ samples
 *
 * Unified interface for all window types with automatic WASM acceleration.
 * Falls back to JavaScript implementation if WASM unavailable.
 *
 * @param samples - Input IQ samples
 * @param windowType - Window function to apply
 * @param useWasm - Enable WASM acceleration (default true)
 * @returns Windowed samples (new array)
 */
export function applyWindow(
  samples: Sample[],
  windowType: WindowFunction,
  useWasm = true,
): Sample[] {
  // Try WASM acceleration first
  if (useWasm && isWasmAvailable()) {
    const copy = samples.map((s) => ({ I: s.I, Q: s.Q }));
    let success = false;

    switch (windowType) {
      case "hann":
        success = applyHannWindowWasm(copy);
        break;
      case "hamming":
        success = applyHammingWindowWasm(copy);
        break;
      case "blackman":
        success = applyBlackmanWindowWasm(copy);
        break;
      case "rectangular":
      case "kaiser":
        // Not available in WASM, use JS fallback
        break;
    }

    if (success) {
      return copy;
    }
  }

  // JavaScript fallback
  switch (windowType) {
    case "hann":
      return applyHannWindow(samples);
    case "hamming":
      return applyHammingWindow(samples);
    case "blackman":
      return applyBlackmanWindow(samples);
    case "kaiser":
      return applyKaiserWindow(samples);
    case "rectangular":
    default:
      return samples; // No windowing
  }
}

/**
 * Remove static DC offset from IQ samples
 *
 * Calculates and subtracts the mean of I and Q components.
 * Best for signals with constant DC offset.
 *
 * Algorithm:
 * 1. Calculate mean_I = sum(I) / N
 * 2. Calculate mean_Q = sum(Q) / N
 * 3. I' = I - mean_I
 * 4. Q' = Q - mean_Q
 *
 * Complexity: O(n)
 * Use case: Large blocks with stable DC offset
 *
 * @param samples - Input IQ samples
 * @param useWasm - Enable WASM acceleration (default true)
 * @returns DC-corrected samples (new array)
 */
export function removeDCOffsetStatic(
  samples: Sample[],
  useWasm = true,
): Sample[] {
  if (samples.length === 0) {
    return samples;
  }

  // Try WASM acceleration
  if (useWasm && isWasmAvailable()) {
    const copy = samples.map((s) => ({ I: s.I, Q: s.Q }));
    if (removeDCOffsetStaticWasm(copy)) {
      return copy;
    }
  }

  // JavaScript implementation
  let sumI = 0;
  let sumQ = 0;
  for (const sample of samples) {
    sumI += sample.I;
    sumQ += sample.Q;
  }
  const dcOffsetI = sumI / samples.length;
  const dcOffsetQ = sumQ / samples.length;

  // Only apply correction if DC offset is significant
  if (
    Math.abs(dcOffsetI) < DC_OFFSET_THRESHOLD &&
    Math.abs(dcOffsetQ) < DC_OFFSET_THRESHOLD
  ) {
    return samples.map((s) => ({ I: s.I, Q: s.Q }));
  }

  // Remove DC offset
  return samples.map((sample) => ({
    I: sample.I - dcOffsetI,
    Q: sample.Q - dcOffsetQ,
  }));
}

/**
 * Remove DC offset using IIR high-pass filter
 *
 * Tracks time-varying DC offset using first-order IIR filter.
 * Based on Julius O. Smith III's DC blocker design.
 *
 * Transfer function: H(z) = (1 - z^-1) / (1 - α*z^-1)
 *
 * Difference equation: y[n] = x[n] - x[n-1] + α*y[n-1]
 *
 * Cutoff frequency: fc ≈ fs * (1 - α) / (2π)
 * - α = 0.99 → fc ≈ 160 Hz @ 100kHz sample rate
 * - α = 0.95 → fc ≈ 800 Hz @ 100kHz sample rate
 * - α = 0.999 → fc ≈ 16 Hz @ 100kHz sample rate
 *
 * @param samples - Input IQ samples
 * @param state - Filter state (preserves history between calls)
 * @param alpha - Filter coefficient (default 0.99)
 * @param useWasm - Enable WASM acceleration (default true)
 * @returns DC-corrected samples (new array)
 *
 * @example
 * ```typescript
 * const state = { prevInputI: 0, prevInputQ: 0, prevOutputI: 0, prevOutputQ: 0 };
 * const corrected1 = removeDCOffsetIIR(samples1, state);
 * const corrected2 = removeDCOffsetIIR(samples2, state); // State preserved
 * ```
 */
export function removeDCOffsetIIR(
  samples: Sample[],
  state: DCBlockerState,
  alpha = 0.99,
  useWasm = true,
): Sample[] {
  if (samples.length === 0) {
    return samples;
  }

  // Try WASM acceleration
  if (useWasm && isWasmAvailable()) {
    const copy = samples.map((s) => ({ I: s.I, Q: s.Q }));
    if (removeDCOffsetIIRWasm(copy, state, alpha)) {
      return copy;
    }
  }

  // JavaScript implementation
  const output: Sample[] = [];
  let { prevInputI, prevInputQ, prevOutputI, prevOutputQ } = state;

  for (const sample of samples) {
    const outputI = sample.I - prevInputI + alpha * prevOutputI;
    const outputQ = sample.Q - prevInputQ + alpha * prevOutputQ;

    output.push({ I: outputI, Q: outputQ });

    prevInputI = sample.I;
    prevInputQ = sample.Q;
    prevOutputI = outputI;
    prevOutputQ = outputQ;
  }

  // Update state for next call
  state.prevInputI = prevInputI;
  state.prevInputQ = prevInputQ;
  state.prevOutputI = prevOutputI;
  state.prevOutputQ = prevOutputQ;

  return output;
}

/**
 * Remove DC offset using combined static and IIR approach
 *
 * Two-stage correction provides best results:
 * 1. Static correction removes large constant offset efficiently
 * 2. IIR filter tracks residual and time-varying DC
 *
 * Recommended for best quality in real-world SDR signals.
 *
 * @param samples - Input IQ samples
 * @param state - IIR filter state
 * @param alpha - IIR filter coefficient (default 0.99)
 * @param useWasm - Enable WASM acceleration (default true)
 * @returns DC-corrected samples (new array)
 */
export function removeDCOffsetCombined(
  samples: Sample[],
  state: DCBlockerState,
  alpha = 0.99,
  useWasm = true,
): Sample[] {
  // First pass: remove static DC offset
  const staticCorrected = removeDCOffsetStatic(samples, useWasm);

  // Second pass: apply IIR DC blocker
  return removeDCOffsetIIR(staticCorrected, state, alpha, useWasm);
}

/**
 * Remove DC offset with mode selection
 *
 * Unified interface for all DC correction modes.
 *
 * @param samples - Input IQ samples
 * @param mode - DC correction algorithm
 * @param state - IIR state (required for "iir" and "combined" modes)
 * @param alpha - IIR filter coefficient (default 0.99)
 * @param useWasm - Enable WASM acceleration (default true)
 * @returns DC-corrected samples (new array)
 */
export function removeDCOffset(
  samples: Sample[],
  mode: DCCorrectionMode,
  state?: DCBlockerState,
  alpha = 0.99,
  useWasm = true,
): Sample[] {
  switch (mode) {
    case "static":
      return removeDCOffsetStatic(samples, useWasm);

    case "iir":
      if (!state) {
        // Fallback to static if no state provided
        return removeDCOffsetStatic(samples, useWasm);
      }
      return removeDCOffsetIIR(samples, state, alpha, useWasm);

    case "combined":
      if (!state) {
        // Fallback to static if no state provided
        return removeDCOffsetStatic(samples, useWasm);
      }
      return removeDCOffsetCombined(samples, state, alpha, useWasm);

    case "none":
    default:
      return samples;
  }
}

/**
 * Apply Automatic Gain Control (AGC)
 *
 * Adjusts signal amplitude dynamically to maintain consistent output level.
 * Uses attack/release rates for smooth gain transitions.
 *
 * Algorithm:
 * 1. Calculate sample magnitude
 * 2. Compare to target level
 * 3. Adjust gain using attack (decrease) or release (increase) rate
 * 4. Clamp gain to prevent extremes
 *
 * @param samples - Input IQ samples
 * @param params - AGC parameters
 * @returns Gain-adjusted samples (new array)
 */
export function applyAGC(samples: Sample[], params?: AGCParameters): Sample[] {
  const targetLevel = params?.targetLevel ?? 0.7;
  const attackRate = params?.attackRate ?? 0.01;
  const releaseRate = params?.releaseRate ?? 0.001;
  const minGain = params?.minGain ?? 0.01;
  const maxGain = params?.maxGain ?? 10.0;

  if (samples.length === 0) {
    return samples;
  }

  const output: Sample[] = [];
  let gain = 1.0;

  for (const sample of samples) {
    // Calculate sample magnitude
    const sampleMagnitude = Math.sqrt(
      sample.I * sample.I + sample.Q * sample.Q,
    );

    // Adjust gain based on difference from target
    const error = targetLevel - sampleMagnitude * gain;
    const rate = error > 0 ? releaseRate : attackRate;
    gain += error * rate;

    // Clamp gain to reasonable limits
    gain = Math.max(minGain, Math.min(maxGain, gain));

    // Apply gain
    output.push({
      I: sample.I * gain,
      Q: sample.Q * gain,
    });
  }

  return output;
}

/**
 * Create initial DC blocker state
 *
 * Convenience function for creating a zeroed IIR filter state.
 *
 * @returns Initial DC blocker state
 */
export function createDCBlockerState(): DCBlockerState {
  return {
    prevInputI: 0,
    prevInputQ: 0,
    prevOutputI: 0,
    prevOutputQ: 0,
  };
}
