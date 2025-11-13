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

// Re-export primitives
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

// TODO: Future exports (Phase 2)
// export * from "./fft";
// export * from "./filters";
// export * from "./analysis";
// export * from "./conversions";
