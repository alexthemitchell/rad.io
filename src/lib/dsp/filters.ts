/**
 * Digital Filter Implementations
 *
 * Provides basic digital filter implementations for signal processing.
 * Includes FIR, IIR, and common filter types.
 *
 * @module dsp/filters
 */

import type { Sample } from "./types";

/**
 * Filter type enumeration
 */
export type FilterType = "lowpass" | "highpass" | "bandpass" | "bandstop";

/**
 * Filter parameters
 */
export interface FilterParameters {
  /** Filter type */
  type: FilterType;
  /** Cutoff frequency (or lower cutoff for bandpass/bandstop) in Hz */
  cutoff: number;
  /** Upper cutoff frequency for bandpass/bandstop in Hz */
  cutoff2?: number;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Filter order (number of taps for FIR, poles for IIR) */
  order?: number;
}

/**
 * FIR filter state
 */
export interface FIRFilterState {
  /** Filter coefficients */
  coefficients: Float32Array;
  /** Delay line for I component */
  delayLineI: Float32Array;
  /** Delay line for Q component */
  delayLineQ: Float32Array;
  /** Current position in delay line */
  position: number;
}

/**
 * Create FIR filter state
 *
 * @param coefficients - Filter coefficients
 * @returns FIR filter state
 */
export function createFIRFilter(coefficients: Float32Array): FIRFilterState {
  return {
    coefficients,
    delayLineI: new Float32Array(coefficients.length),
    delayLineQ: new Float32Array(coefficients.length),
    position: 0,
  };
}

/**
 * Apply FIR filter to samples
 *
 * @param samples - Input IQ samples
 * @param state - FIR filter state
 * @returns Filtered samples
 *
 * @example
 * ```typescript
 * import { createFIRFilter, applyFIRFilter } from "@/lib/dsp";
 *
 * // Create simple moving average filter
 * const coeffs = new Float32Array([0.2, 0.2, 0.2, 0.2, 0.2]);
 * const filter = createFIRFilter(coeffs);
 *
 * const filtered = applyFIRFilter(samples, filter);
 * ```
 */
export function applyFIRFilter(
  samples: Sample[],
  state: FIRFilterState,
): Sample[] {
  const result: Sample[] = [];
  const { coefficients, delayLineI, delayLineQ } = state;
  const numTaps = coefficients.length;

  for (const sample of samples) {
    // Add new sample to delay line
    delayLineI[state.position] = sample.I;
    delayLineQ[state.position] = sample.Q;

    // Calculate filtered output
    let outI = 0;
    let outQ = 0;

    for (let i = 0; i < numTaps; i++) {
      const delayIndex = (state.position - i + numTaps) % numTaps;
      const coeff = coefficients[i];
      const delayI = delayLineI[delayIndex];
      const delayQ = delayLineQ[delayIndex];

      if (coeff !== undefined && delayI !== undefined && delayQ !== undefined) {
        outI += coeff * delayI;
        outQ += coeff * delayQ;
      }
    }

    result.push({ I: outI, Q: outQ });

    // Update position
    state.position = (state.position + 1) % numTaps;
  }

  return result;
}

/**
 * Design simple lowpass FIR filter using windowed-sinc method
 *
 * @param cutoff - Cutoff frequency in Hz
 * @param sampleRate - Sample rate in Hz
 * @param numTaps - Number of filter taps (must be odd)
 * @returns Filter coefficients
 */
export function designLowpassFIR(
  cutoff: number,
  sampleRate: number,
  numTaps = 51,
): Float32Array {
  // Ensure odd number of taps
  let taps = numTaps;
  if (taps % 2 === 0) {
    taps++;
  }

  const coeffs = new Float32Array(taps);
  const center = Math.floor(taps / 2);
  const fc = cutoff / sampleRate; // Normalized cutoff frequency

  for (let i = 0; i < taps; i++) {
    const n = i - center;

    if (n === 0) {
      coeffs[i] = 2 * fc;
    } else {
      // Sinc function
      const sinc = Math.sin(2 * Math.PI * fc * n) / (Math.PI * n);

      // Hamming window
      const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1));

      coeffs[i] = sinc * window;
    }
  }

  // Normalize
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const coeff = coeffs[i];
    if (coeff !== undefined) {
      sum += coeff;
    }
  }
  for (let i = 0; i < taps; i++) {
    const coeff = coeffs[i];
    if (coeff !== undefined) {
      coeffs[i] = coeff / sum;
    }
  }

  return coeffs;
}

/**
 * IIR filter state (single biquad section)
 */
export interface IIRFilterState {
  /** Forward coefficients (b0, b1, b2) */
  b: Float32Array;
  /** Feedback coefficients (a1, a2) - a0 is normalized to 1 */
  a: Float32Array;
  /** State variables for I component */
  stateI: Float32Array;
  /** State variables for Q component */
  stateQ: Float32Array;
}

/**
 * Create IIR biquad filter state
 *
 * @param b - Forward coefficients [b0, b1, b2]
 * @param a - Feedback coefficients [a0, a1, a2] (a0 will be normalized to 1)
 * @returns IIR filter state
 */
export function createIIRFilter(
  b: Float32Array,
  a: Float32Array,
): IIRFilterState {
  // Normalize by a[0]
  const a0 = a[0];
  if (a0 === undefined || a0 === 0) {
    throw new Error("Invalid filter coefficients: a[0] must be non-zero");
  }

  const b0 = b[0] ?? 0;
  const b1 = b[1] ?? 0;
  const b2 = b[2] ?? 0;
  const a1 = a[1] ?? 0;
  const a2 = a[2] ?? 0;

  const bNorm = new Float32Array([b0 / a0, b1 / a0, b2 / a0]);
  const aNorm = new Float32Array([a1 / a0, a2 / a0]);

  return {
    b: bNorm,
    a: aNorm,
    stateI: new Float32Array(2), // [x1, x2] for I
    stateQ: new Float32Array(2), // [x1, x2] for Q
  };
}

/**
 * Apply IIR biquad filter to samples
 *
 * Uses Direct Form II transposed structure for numerical stability.
 *
 * @param samples - Input IQ samples
 * @param state - IIR filter state
 * @returns Filtered samples
 */
export function applyIIRFilter(
  samples: Sample[],
  state: IIRFilterState,
): Sample[] {
  const result: Sample[] = [];
  const { b, a, stateI, stateQ } = state;

  for (const sample of samples) {
    // Direct Form II Transposed for I component
    const b0 = b[0] ?? 0;
    const b1 = b[1] ?? 0;
    const b2 = b[2] ?? 0;
    const a0 = a[0] ?? 0;
    const a1 = a[1] ?? 0;
    const s0I = stateI[0] ?? 0;
    const s1I = stateI[1] ?? 0;

    const outI = b0 * sample.I + s0I;
    stateI[0] = b1 * sample.I - a0 * outI + s1I;
    stateI[1] = b2 * sample.I - a1 * outI;

    // Direct Form II Transposed for Q component
    const s0Q = stateQ[0] ?? 0;
    const s1Q = stateQ[1] ?? 0;

    const outQ = b0 * sample.Q + s0Q;
    stateQ[0] = b1 * sample.Q - a0 * outQ + s1Q;
    stateQ[1] = b2 * sample.Q - a1 * outQ;

    result.push({ I: outI, Q: outQ });
  }

  return result;
}

/**
 * Design simple lowpass IIR filter (1st order)
 *
 * @param cutoff - Cutoff frequency in Hz
 * @param sampleRate - Sample rate in Hz
 * @returns IIR filter state
 *
 * @example
 * ```typescript
 * import { designLowpassIIR, applyIIRFilter } from "@/lib/dsp";
 *
 * const filter = designLowpassIIR(1000, 48000); // 1kHz cutoff at 48kHz sample rate
 * const filtered = applyIIRFilter(samples, filter);
 * ```
 */
export function designLowpassIIR(
  cutoff: number,
  sampleRate: number,
): IIRFilterState {
  // Simple 1st order lowpass: H(z) = (1-a) / (1 - a*z^-1)
  // where a = exp(-2*pi*fc)
  const fc = cutoff / sampleRate;
  const a = Math.exp(-2 * Math.PI * fc);

  // Convert to biquad form
  const b = new Float32Array([1 - a, 0, 0]);
  const aCoeffs = new Float32Array([1, -a, 0]);

  return createIIRFilter(b, aCoeffs);
}

/**
 * Moving average filter (simple smoothing)
 *
 * Equivalent to FIR filter with equal coefficients.
 *
 * @param samples - Input IQ samples
 * @param windowSize - Size of averaging window
 * @returns Smoothed samples
 */
export function movingAverage(samples: Sample[], windowSize: number): Sample[] {
  if (windowSize <= 1) return samples;

  const coeffs = new Float32Array(windowSize).fill(1 / windowSize);
  const filter = createFIRFilter(coeffs);
  return applyFIRFilter(samples, filter);
}
