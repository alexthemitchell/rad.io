/**
 * Unified DSP Primitives Layer
 *
 * Public API for core digital signal processing operations.
 * Consolidates DSP primitives from across the codebase into a single,
 * well-tested, performance-optimized module.
 *
 * Features:
 * - Window functions (Hann, Hamming, Blackman, Kaiser)
 * - DC offset correction (Static, IIR, Combined)
 * - Automatic Gain Control (AGC)
 * - FFT operations with WASM acceleration
 * - Signal analysis (RMS, peak, SNR, spectral peaks)
 * - Digital filters (FIR, IIR)
 * - Sample format conversions
 * - TypeScript and WASM implementations with automatic fallback
 *
 * @module dsp
 * @see docs/decisions/0026-unified-dsp-primitives-architecture.md
 */

// Re-export types
export type {
  Sample,
  WindowFunction,
  DCCorrectionMode,
  DCBlockerState,
  ScalingMode,
  FFTParameters,
  FilterType,
  FilterParameters,
  AGCParameters,
  SignalMetrics,
} from "./types";

// Re-export primitives (windowing, DC correction, AGC)
export {
  applyHannWindow,
  applyHammingWindow,
  applyBlackmanWindow,
  applyKaiserWindow,
  applyWindow,
  removeDCOffsetStatic,
  removeDCOffsetIIR,
  removeDCOffsetCombined,
  removeDCOffset,
  applyAGC,
  createDCBlockerState,
} from "./primitives";

// Re-export FFT operations
export { calculateFFT, calculateSpectrogram, clearFFTCache } from "./fft";

// Re-export signal analysis functions
export {
  calculateSignalStrength,
  calculateMetrics,
  calculateRMS,
  calculatePeak,
  binToFrequency,
  detectSpectralPeaks,
  estimateSNR,
} from "./analysis";
export type {
  SignalMetrics as SignalMetricsType,
  SpectralPeak,
} from "./analysis";

// Re-export conversion utilities
export {
  convertToSamples,
  convertFromSamples,
  convertInterleavedToSamples,
  convertSamplesToInterleaved,
  convertSeparateToSamples,
  convertSamplesToSeparate,
  calculateMagnitude,
  calculatePhase,
  calculateWaveform,
  normalizeSamples,
} from "./conversions";

// Re-export filter functions
export {
  createFIRFilter,
  applyFIRFilter,
  designLowpassFIR,
  createIIRFilter,
  applyIIRFilter,
  designLowpassIIR,
  movingAverage,
} from "./filters";
export type { FIRFilterState, IIRFilterState } from "./filters";

// Re-export multi-VFO processor
export { MultiVfoProcessor } from "./MultiVfoProcessor";
export type {
  MultiVfoProcessorConfig,
  VfoAudioBuffer,
} from "./MultiVfoProcessor";

// Re-export channelizers
export { pfbChannelize } from "./pfbChannelizer";
export type { PFBChannelizerOptions } from "./pfbChannelizer";
export { windowedDFTChannelize } from "./wdfdftChannelizer";
