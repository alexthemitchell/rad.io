import { calculateSignalStrength, calculateFFTSync } from "./dsp";
import type { Sample } from "./dsp";
import type { ISDRDevice } from "../models/SDRDevice";

// Import from unified DSP layer for re-export
import {
  applyHannWindow as unifiedApplyHannWindow,
  applyHammingWindow as unifiedApplyHammingWindow,
  applyBlackmanWindow as unifiedApplyBlackmanWindow,
  applyKaiserWindow as unifiedApplyKaiserWindow,
  applyWindow as unifiedApplyWindow,
  removeDCOffsetStatic as unifiedRemoveDCOffsetStatic,
  removeDCOffsetIIR as unifiedRemoveDCOffsetIIR,
  removeDCOffsetCombined as unifiedRemoveDCOffsetCombined,
  applyAGC as unifiedApplyAGC,
} from "../lib/dsp";

// Threshold constants (maintained for backward compatibility in processIQSampling)
const MIN_RMS_THRESHOLD = 1e-10; // Avoid divide-by-zero/instability
const GAIN_ERROR_THRESHOLD = 1e-2; // Minimum gain error to warrant correction
const PHASE_ERROR_THRESHOLD = 1e-2; // Minimum phase error (radians) to warrant correction

/**
 * DC Correction Algorithm Selection
 * Determines which DC offset removal algorithm to use
 *
 * @deprecated Use DCCorrectionMode from @/lib/dsp instead
 */
export type DCCorrectionMode = "none" | "static" | "iir" | "combined";

/**
 * IIR DC Blocker State
 * Maintains state for recursive DC removal filter
 */
export interface DCBlockerState {
  prevInputI: number;
  prevInputQ: number;
  prevOutputI: number;
  prevOutputQ: number;
}

/**
 * Windowing Functions for DSP
 * Used to reduce spectral leakage in FFT analysis
 */

/**
 * Window function type
 */
export type WindowFunction =
  | "rectangular"
  | "hann"
  | "hamming"
  | "blackman"
  | "kaiser";

/**
 * Apply Hann window (cosine-based, smooth roll-off)
 * Hann window: w(n) = 0.5 * (1 - cos(2π*n/(N-1)))
 *
 * @deprecated Use applyWindow(samples, "hann") from @/lib/dsp instead
 * @see {@link unifiedApplyWindow}
 */
export function applyHannWindow(samples: Sample[]): Sample[] {
  return unifiedApplyHannWindow(samples);
}

/**
 * Apply Hamming window (cosine-based, slightly narrower main lobe)
 * Hamming window: w(n) = 0.54 - 0.46 * cos(2π*n/(N-1))
 *
 * @deprecated Use applyWindow(samples, "hamming") from @/lib/dsp instead
 * @see {@link unifiedApplyWindow}
 */
export function applyHammingWindow(samples: Sample[]): Sample[] {
  return unifiedApplyHammingWindow(samples);
}

/**
 * Apply Blackman window (three-term cosine, better sidelobe suppression)
 * Blackman window: w(n) = 0.42 - 0.5 * cos(2π*n/(N-1)) + 0.08 * cos(4π*n/(N-1))
 *
 * @deprecated Use applyWindow(samples, "blackman") from @/lib/dsp instead
 * @see {@link unifiedApplyWindow}
 */
export function applyBlackmanWindow(samples: Sample[]): Sample[] {
  return unifiedApplyBlackmanWindow(samples);
}

/**
 * Apply Kaiser window (adjustable sidelobe level)
 * Simplified Kaiser window with beta=5 for general purpose use
 *
 * @deprecated Use applyWindow(samples, "kaiser", false) from @/lib/dsp instead
 * @see {@link unifiedApplyWindow}
 */
export function applyKaiserWindow(samples: Sample[], beta = 5): Sample[] {
  return unifiedApplyKaiserWindow(samples, beta);
}

/**
 * Apply specified window function to samples
 * Uses WASM acceleration when available for better performance
 *
 * @deprecated Use applyWindow from @/lib/dsp instead
 * @see {@link unifiedApplyWindow}
 */
export function applyWindow(
  samples: Sample[],
  windowType: WindowFunction,
  useWasm = true,
): Sample[] {
  return unifiedApplyWindow(samples, windowType, useWasm);
}

/**
 * Automatic Gain Control (AGC)
 * Adjusts signal amplitude to maintain consistent output level
 *
 * @deprecated Use applyAGC from @/lib/dsp instead
 * @see {@link unifiedApplyAGC}
 */
export function applyAGC(
  samples: Sample[],
  targetLevel = 0.7,
  attackRate = 0.01,
  releaseRate = 0.001,
): Sample[] {
  return unifiedApplyAGC(samples, {
    targetLevel,
    attackRate,
    releaseRate,
  });
}

/**
 * Decimation with anti-aliasing low-pass filter
 * Reduces sample rate by factor M with proper filtering
 */
export function decimate(samples: Sample[], factor: number): Sample[] {
  if (factor <= 1 || samples.length === 0) {
    return samples;
  }

  // Step 1: Anti-aliasing low-pass filter using moving average
  const filterSize = Math.max(1, Math.ceil(factor / 2));
  const filtered: Sample[] = [];

  for (let i = 0; i < samples.length; i++) {
    let sumI = 0;
    let sumQ = 0;
    let count = 0;

    const startIdx = Math.max(0, i - filterSize);
    const endIdx = Math.min(samples.length - 1, i + filterSize);

    for (let j = startIdx; j <= endIdx; j++) {
      const sample = samples[j];
      if (
        sample &&
        typeof sample.I === "number" &&
        typeof sample.Q === "number"
      ) {
        sumI += sample.I;
        sumQ += sample.Q;
        count++;
      }
    }

    filtered.push({ I: sumI / count, Q: sumQ / count });
  }

  // Step 2: Downsample by taking every Mth sample
  const decimated: Sample[] = [];
  for (let i = 0; i < filtered.length; i += factor) {
    const sample = filtered[i];
    if (sample) {
      decimated.push(sample);
    }
  }

  return decimated;
}

/**
 * Scaling modes for signal normalization
 */
export type ScalingMode = "none" | "normalize" | "linear" | "dB";

/**
 * Apply scaling to signal
 */
export function applyScaling(
  samples: Sample[],
  mode: ScalingMode,
  scaleFactor = 1.0,
): Sample[] {
  if (mode === "none") {
    return samples;
  }

  if (mode === "normalize") {
    // Find maximum magnitude
    let maxMag = 0;
    for (const sample of samples) {
      const mag = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
      maxMag = Math.max(maxMag, mag);
    }

    if (maxMag === 0) {
      return samples;
    }

    const scale = scaleFactor / maxMag;
    return samples.map((s) => ({ I: s.I * scale, Q: s.Q * scale }));
  }

  if (mode === "linear") {
    return samples.map((s) => ({ I: s.I * scaleFactor, Q: s.Q * scaleFactor }));
  }

  // mode === "dB"
  // Convert dB to linear scale (dB = 20 * log10(linear))
  const linearScale = Math.pow(10, scaleFactor / 20);
  return samples.map((s) => ({ I: s.I * linearScale, Q: s.Q * linearScale }));
}

/**
 * Apply Static DC Offset Removal
 * Removes constant DC offset by subtracting the mean of I and Q components.
 * This is the simplest method and works well for static DC offsets.
 *
 * Industry Practice: Used as a first-pass correction in most SDR software
 * including GNU Radio, SDR#, and HDSDR.
 *
 * @param samples - Input IQ samples
 * @param useWasm - Enable WASM acceleration (default true)
 * @returns Corrected samples with DC offset removed
 *
 * @remarks
 * - Computes mean over entire sample block
 * - Best for large blocks with stable DC offset
 * - Low computational cost: O(n)
 * - Does not track time-varying DC offset
 * - WASM acceleration provides 2-4x speedup on large blocks
 *
 * @deprecated Use removeDCOffset(samples, "static") from @/lib/dsp instead
 * @see {@link unifiedRemoveDCOffsetStatic}
 */
export function removeDCOffsetStatic(
  samples: Sample[],
  useWasm = true,
): Sample[] {
  return unifiedRemoveDCOffsetStatic(samples, useWasm);
}

/**
 * Apply IIR DC Blocker
 * High-pass filter that removes DC component using a first-order IIR filter.
 * Tracks time-varying DC offset, making it superior to static mean subtraction.
 *
 * Industry Standard: Based on Julius O. Smith III's DC blocker design,
 * used in GNU Radio (gr::blocks::dc_blocker_cc) and many commercial SDRs.
 *
 * Transfer Function: H(z) = (1 - z^-1) / (1 - α*z^-1)
 * Where α controls the cutoff frequency: α = 1 - (2π * fc / fs)
 *
 * @param samples - Input IQ samples
 * @param state - Persistent filter state (maintains history between calls)
 * @param alpha - Filter coefficient (default 0.99 for fc ≈ 160 Hz @ 100 kHz sample rate)
 * @param useWasm - Enable WASM acceleration (default true)
 * @returns Corrected samples with DC component removed
 *
 * @remarks
 * - Typical α values: 0.95-0.999 (higher = lower cutoff frequency)
 * - α = 0.99 gives cutoff ≈ 160 Hz @ 100kHz, ≈ 8 Hz @ 5kHz
 * - Cutoff frequency: fc ≈ fs * (1 - α) / (2π)
 * - State must be preserved between calls for continuous operation
 * - Introduces minimal group delay (~1/fc)
 * - WASM acceleration provides significant speedup for large blocks
 *
 * @deprecated Use removeDCOffset(samples, "iir", state) from @/lib/dsp instead
 * @see {@link unifiedRemoveDCOffsetIIR}
 *
 * @example
 * ```typescript
 * const state = { prevInputI: 0, prevInputQ: 0, prevOutputI: 0, prevOutputQ: 0 };
 * const corrected1 = removeDCOffsetIIR(samples1, state); // First block
 * const corrected2 = removeDCOffsetIIR(samples2, state); // Second block (state preserved)
 * ```
 */
export function removeDCOffsetIIR(
  samples: Sample[],
  state: DCBlockerState,
  alpha = 0.99,
  useWasm = true,
): Sample[] {
  return unifiedRemoveDCOffsetIIR(samples, state, alpha, useWasm);
}

/**
 * Combined DC Correction
 * Applies both static DC offset removal followed by IIR DC blocker.
 * Provides best results: removes large static offset first, then tracks drift.
 *
 * Industry Practice: This two-stage approach is used in high-quality SDR
 * applications to handle both constant and time-varying DC offsets.
 *
 * @param samples - Input IQ samples
 * @param state - Persistent IIR filter state
 * @param alpha - IIR filter coefficient
 * @param useWasm - Enable WASM acceleration (default true)
 * @returns Samples with comprehensive DC correction
 *
 * @remarks
 * - Stage 1 (static): Removes bulk DC offset efficiently
 * - Stage 2 (IIR): Handles residual and time-varying DC
 * - Provides best performance for real-world SDR signals
 * - WASM acceleration provides 2-4x overall speedup
 *
 * @deprecated Use removeDCOffset(samples, "combined", state) from @/lib/dsp instead
 * @see {@link unifiedRemoveDCOffsetCombined}
 */
export function removeDCOffsetCombined(
  samples: Sample[],
  state: DCBlockerState,
  alpha = 0.99,
  useWasm = true,
): Sample[] {
  return unifiedRemoveDCOffsetCombined(samples, state, alpha, useWasm);
}

export function processRFInput(
  _device: ISDRDevice | undefined,
  samples: Sample[],
): { output: Sample[]; metrics: { signalStrength: number } } {
  // Limit buffer size and compute signal strength
  const MAX_SAMPLES = 16384;
  const limited =
    samples.length <= MAX_SAMPLES
      ? samples
      : samples.filter(
          (_, i) => i % Math.ceil(samples.length / MAX_SAMPLES) === 0,
        );
  const signalStrength = calculateSignalStrength(limited);
  return {
    output: limited,
    metrics: { signalStrength },
  };
}

export function processTuner(
  samples: Sample[],
  params: {
    frequency: number;
    bandwidth: number;
    loOffset: number;
    sampleRate: number;
  },
): { output: Sample[]; metrics: { actualFreq: number } } {
  // Apply frequency shift if LO offset is specified
  // Frequency shifting is done by multiplying samples with complex exponential: e^(j*2π*f*t)
  // This shifts the spectrum by the LO offset frequency
  if (params.loOffset !== 0 && samples.length > 0) {
    const shifted: Sample[] = [];
    // For frequency shifting, the offset must be normalized by the sample rate (not bandwidth)
    // This converts the frequency offset to the correct angular increment per sample
    const normalizedOffset = params.loOffset / params.sampleRate;

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) {
        continue;
      }

      // Complex exponential: e^(j*θ) = cos(θ) + j*sin(θ)
      const theta = 2 * Math.PI * normalizedOffset * i;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      // Complex multiplication: (I + jQ) * (cos + j*sin)
      // Real part: I*cos - Q*sin
      // Imag part: I*sin + Q*cos
      shifted.push({
        I: sample.I * cosTheta - sample.Q * sinTheta,
        Q: sample.I * sinTheta + sample.Q * cosTheta,
      });
    }

    return {
      output: shifted,
      metrics: { actualFreq: params.frequency + params.loOffset },
    };
  }

  // Pass through if no offset
  return {
    output: samples,
    metrics: { actualFreq: params.frequency },
  };
}

/**
 * Enhanced IQ Sampling Processor with Multiple DC Correction Modes
 * Processes IQ samples with optional DC offset removal and IQ balance correction
 *
 * @param samples - Input IQ samples
 * @param params - Processing parameters
 * @param params.sampleRate - Sample rate in Hz
 * @param params.dcCorrection - Enable/disable DC correction (boolean for backward compat)
 * @param params.dcCorrectionMode - DC correction algorithm selection
 * @param params.dcBlockerState - Persistent state for IIR DC blocker
 * @param params.iqBalance - Enable/disable IQ balance correction
 * @returns Processed samples and metrics
 */
export function processIQSampling(
  samples: Sample[],
  params: {
    sampleRate: number;
    dcCorrection: boolean;
    dcCorrectionMode?: DCCorrectionMode;
    dcBlockerState?: DCBlockerState;
    iqBalance: boolean;
  },
): { output: Sample[]; metrics: { sampleRate: number } } {
  // Apply DC offset removal and IQ balance correction if requested
  let output = samples;

  if (params.dcCorrection && samples.length > 0) {
    // Determine which DC correction mode to use
    // Default to 'static' mode (simplest, no state management required)
    const mode = params.dcCorrectionMode ?? "static";

    switch (mode) {
      case "static":
        output = removeDCOffsetStatic(output);
        break;

      case "iir":
        if (params.dcBlockerState) {
          output = removeDCOffsetIIR(output, params.dcBlockerState);
        } else {
          // Fallback to static if no state provided
          output = removeDCOffsetStatic(output);
        }
        break;

      case "combined":
        if (params.dcBlockerState) {
          output = removeDCOffsetCombined(output, params.dcBlockerState);
        } else {
          // Fallback to static if no state provided
          output = removeDCOffsetStatic(output);
        }
        break;

      case "none":
      default:
        // No DC correction
        break;
    }
  }

  if (params.iqBalance && output.length > 0) {
    // Calculate IQ imbalance
    // Gain imbalance: ratio of Q amplitude to I amplitude
    // Phase imbalance: correlation between I and Q
    let sumI2 = 0; // Sum of I^2
    let sumQ2 = 0; // Sum of Q^2
    let sumIQ = 0; // Sum of I*Q

    for (const sample of output) {
      sumI2 += sample.I * sample.I;
      sumQ2 += sample.Q * sample.Q;
      sumIQ += sample.I * sample.Q;
    }

    const rmsI = Math.sqrt(sumI2 / output.length);
    const rmsQ = Math.sqrt(sumQ2 / output.length);

    // Avoid division by zero
    if (rmsI > MIN_RMS_THRESHOLD && rmsQ > MIN_RMS_THRESHOLD) {
      // Gain imbalance correction factor
      const gainImbalance = rmsI / rmsQ;

      // Phase imbalance estimation (simplified)
      // Correlation coefficient normalized by RMS values
      const correlation = sumIQ / (output.length * rmsI * rmsQ);
      const phaseImbalance = Math.asin(Math.max(-1, Math.min(1, correlation)));

      // Only apply correction if imbalance is significant
      // Gain ratio should be close to 1.0, phase should be close to 0
      const gainError = Math.abs(gainImbalance - 1.0);
      const phaseError = Math.abs(phaseImbalance);

      if (
        gainError > GAIN_ERROR_THRESHOLD ||
        phaseError > PHASE_ERROR_THRESHOLD
      ) {
        // Apply corrections
        output = output.map((sample) => {
          // Correct gain imbalance
          const Q = sample.Q * gainImbalance;

          // Correct phase imbalance (rotate Q component)
          const QCorrected =
            Q * Math.cos(phaseImbalance) - sample.I * Math.sin(phaseImbalance);

          return {
            I: sample.I,
            Q: QCorrected,
          };
        });
      }
    }
  }

  return {
    output,
    metrics: { sampleRate: params.sampleRate },
  };
}

export function processFFT(
  samples: Sample[],
  params: {
    fftSize: number;
    window: WindowFunction;
    overlap: number;
    wasm: boolean;
  },
): {
  output: Float32Array | null;
  metrics: {
    bins: number;
    windowType: string;
    processingTime: number;
  };
} {
  const startTime = performance.now();

  if (samples.length < params.fftSize) {
    return {
      output: null,
      metrics: {
        bins: params.fftSize,
        windowType: params.window,
        processingTime: 0,
      },
    };
  }

  // Take first fftSize samples
  const chunk = samples.slice(0, params.fftSize);

  // Apply windowing
  const windowed = applyWindow(chunk, params.window);

  // Calculate FFT
  const fftResult = calculateFFTSync(windowed, params.fftSize);

  const processingTime = performance.now() - startTime;

  return {
    output: fftResult,
    metrics: {
      bins: params.fftSize,
      windowType: params.window,
      processingTime,
    },
  };
}

export function processDemodulation(
  samples: Sample[],
  params: {
    demod: string;
    fmDeviation: number;
    amDepth: number;
    audioBandwidth: number;
  },
): { output: null; metrics: object } {
  // Placeholder implementation - demodulation is currently handled in dsp-worker
  // This function exists for future migration of demodulation logic
  void samples;
  void params;
  return {
    output: null,
    metrics: {},
  };
}

export function processAudioOutput(
  samples: Sample[] | null,
  params: {
    volume: number;
    mute: boolean;
    audioFilter: string;
    cutoff: number;
  },
): { output: null; metrics: object } {
  // Placeholder implementation - audio processing is currently handled elsewhere
  // This function exists for future audio output pipeline
  void samples;
  void params;
  return {
    output: null,
    metrics: {},
  };
}

/**
 * Pipeline Transform Interface
 * Allows composable processing stages
 */
export interface PipelineTransform<
  TIn,
  TOut,
  TParams = Record<string, unknown>,
> {
  name: string;
  transform: (input: TIn, params: TParams) => TOut;
  params: TParams;
}

/**
 * Pipeline Stage Result
 */
export interface PipelineStageResult<T> {
  data: T;
  metrics: Record<string, unknown>;
  stageName: string;
  processingTime: number;
}

/**
 * Compose multiple transforms into a processing pipeline
 * Each stage processes the output of the previous stage
 */
export function composePipeline<TOut>(
  input: unknown,
  transforms: Array<{
    name: string;
    fn: (data: unknown, params?: unknown) => unknown;
    params?: unknown;
  }>,
): PipelineStageResult<TOut> {
  // Validate pipeline before processing
  if (transforms.length === 0) {
    throw new Error("Pipeline must have at least one transform");
  }

  let current: unknown = input;
  const results: Array<PipelineStageResult<unknown>> = [];

  for (const transform of transforms) {
    const startTime = performance.now();
    const output = transform.fn(current, transform.params);
    const processingTime = performance.now() - startTime;

    results.push({
      data: output,
      metrics: {},
      stageName: transform.name,
      processingTime,
    });

    current = output;
  }

  // Safe to access last element since we validated length > 0 at start
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const finalResult = results[results.length - 1]!;
  return finalResult as PipelineStageResult<TOut>;
}

/**
 * Pre-built visualization pipeline
 * Applies common transformations: windowing -> FFT -> scaling
 */
export function createVisualizationPipeline(config: {
  fftSize: number;
  windowType: WindowFunction;
  agcEnabled?: boolean;
  decimationFactor?: number;
  scalingMode?: ScalingMode;
  scaleFactor?: number;
}): Array<{
  name: string;
  fn: (data: unknown, params?: unknown) => unknown;
  params?: unknown;
}> {
  const pipeline: Array<{
    name: string;
    fn: (data: unknown, params?: unknown) => unknown;
    params?: unknown;
  }> = [];

  // Optional decimation
  if (config.decimationFactor && config.decimationFactor > 1) {
    const factor = config.decimationFactor;
    pipeline.push({
      name: "decimation",
      fn: (data) => decimate(data as Sample[], factor),
    });
  }

  // Optional AGC
  if (config.agcEnabled) {
    pipeline.push({
      name: "agc",
      fn: (data) => applyAGC(data as Sample[]),
    });
  }

  // Windowing
  pipeline.push({
    name: "windowing",
    fn: (data) => applyWindow(data as Sample[], config.windowType),
  });

  // FFT
  pipeline.push({
    name: "fft",
    fn: (data) => calculateFFTSync(data as Sample[], config.fftSize),
  });

  // Optional scaling
  if (config.scalingMode && config.scalingMode !== "none") {
    pipeline.push({
      name: "scaling",
      fn: (data) => {
        // For FFT output (Float32Array), apply dB scaling if needed
        if (config.scalingMode === "dB" && data instanceof Float32Array) {
          const scaled = new Float32Array(data.length);
          const offset = config.scaleFactor ?? 0;
          for (let i = 0; i < data.length; i++) {
            const val = data[i] ?? 0;
            if (!isNaN(val)) {
              scaled[i] = val + offset;
            }
          }
          return scaled;
        }
        return data;
      },
    });
  }

  return pipeline;
}
