/**
 * Unified DSP Type Definitions
 *
 * Core types used across the DSP primitives layer for signal processing operations.
 * Provides type safety and documentation for DSP function interfaces.
 *
 * @module dsp/types
 */

/**
 * IQ Sample representation (complex-valued signal sample)
 * Used throughout the application for baseband SDR signals
 *
 * Re-exported from the canonical source in @/utils/dsp for backward compatibility.
 * The Sample type is defined in utils/dsp.ts where it's used extensively by
 * FFT and signal processing functions.
 */
export type { Sample } from "../../utils/dsp";

/**
 * Window function types for spectral analysis
 *
 * Window functions reduce spectral leakage in FFT analysis by
 * tapering signal edges to zero.
 *
 * Trade-offs:
 * - Rectangular: No windowing, maximum spectral leakage, narrowest main lobe
 * - Hann: Good general-purpose, -31 dB sidelobes, moderate main lobe width
 * - Hamming: Better sidelobe suppression (-43 dB), slightly wider main lobe
 * - Blackman: Excellent sidelobe suppression (-58 dB), widest main lobe
 * - Kaiser: Adjustable trade-off via beta parameter
 */
export type WindowFunction =
  | "rectangular"
  | "hann"
  | "hamming"
  | "blackman"
  | "kaiser";

/**
 * DC correction algorithm selection
 *
 * DC offset is a constant (zero-frequency) component in IQ signals
 * caused by hardware imperfections in SDR receivers.
 *
 * Modes:
 * - none: No correction applied
 * - static: Single-pass mean subtraction (fast, works for constant DC)
 * - iir: High-pass IIR filter (tracks time-varying DC)
 * - combined: Static + IIR (best quality, removes both constant and varying DC)
 */
export type DCCorrectionMode = "none" | "static" | "iir" | "combined";

/**
 * IIR DC Blocker State
 *
 * Maintains filter history for recursive DC offset removal.
 * State must be preserved between calls for continuous operation.
 *
 * Transfer function: H(z) = (1 - z^-1) / (1 - α*z^-1)
 * where α controls cutoff frequency (typically 0.99)
 */
export interface DCBlockerState {
  /** Previous input I value (x[n-1]) */
  prevInputI: number;
  /** Previous input Q value (x[n-1]) */
  prevInputQ: number;
  /** Previous output I value (y[n-1]) */
  prevOutputI: number;
  /** Previous output Q value (y[n-1]) */
  prevOutputQ: number;
}

/**
 * Scaling modes for signal normalization
 *
 * Used to adjust signal amplitude for visualization or processing
 */
export type ScalingMode = "none" | "normalize" | "linear" | "dB";

/**
 * FFT Parameters
 */
export interface FFTParameters {
  /** FFT size (must be power of 2) */
  fftSize: number;
  /** Window function to apply before FFT */
  window: WindowFunction;
  /** Overlap factor (0-1) for sliding window analysis */
  overlap?: number;
  /** Whether to use WASM acceleration */
  useWasm?: boolean;
}

/**
 * Filter types
 */
export type FilterType = "lowpass" | "highpass" | "bandpass" | "bandstop";

/**
 * Digital filter parameters
 *
 * Specifies the characteristics of a digital filter including type,
 * cutoff frequencies, and filter order.
 *
 * @example
 * ```typescript
 * const params: FilterParameters = {
 *   type: "lowpass",
 *   cutoff: 1000,      // 1 kHz cutoff
 *   sampleRate: 48000, // 48 kHz sample rate
 *   order: 51          // 51-tap FIR filter
 * };
 * ```
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
 * AGC (Automatic Gain Control) parameters
 */
export interface AGCParameters {
  /** Target output level (0-1) */
  targetLevel?: number;
  /** Attack rate (0-1) - how quickly gain decreases */
  attackRate?: number;
  /** Release rate (0-1) - how quickly gain increases */
  releaseRate?: number;
  /** Minimum gain (prevents excessive amplification) */
  minGain?: number;
  /** Maximum gain (prevents clipping) */
  maxGain?: number;
}

/**
 * Signal analysis metrics
 */
export interface SignalMetrics {
  /** Root mean square (RMS) amplitude */
  rms: number;
  /** Peak amplitude */
  peak: number;
  /** DC offset (mean value) */
  dcOffset: { I: number; Q: number };
  /** Signal-to-noise ratio (dB) */
  snr?: number;
}
