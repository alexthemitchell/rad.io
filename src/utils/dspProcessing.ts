/**
 * DSP Processing Pipeline
 *
 * Pipeline-specific DSP processing functions for the SDR application.
 * Core DSP primitives (windowing, DC correction, FFT, filters) are in @/lib/dsp.
 *
 * @module utils/dspProcessing
 */

import {
  removeDCOffsetStatic,
  removeDCOffsetIIR,
  removeDCOffsetCombined,
  applyWindow,
  type Sample,
  type DCCorrectionMode,
  type DCBlockerState,
  type WindowFunction,
} from "../lib/dsp";
import { calculateSignalStrength, calculateFFTSync } from "./dsp";
import type { ISDRDevice } from "../models/SDRDevice";

// Threshold constants for IQ sampling processor
const MIN_RMS_THRESHOLD = 1e-10; // Avoid divide-by-zero/instability
const GAIN_ERROR_THRESHOLD = 1e-2; // Minimum gain error to warrant correction
const PHASE_ERROR_THRESHOLD = 1e-2; // Minimum phase error (radians) to warrant correction

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

// DC offset removal utilities are imported from ../lib/dsp
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
): {
  output: Sample[];
  metrics: { gainError: number; phaseError: number };
} {
  let processed = samples;

  // DC Correction - supports multiple modes
  if (params.dcCorrection) {
    const mode = params.dcCorrectionMode ?? "static";
    if (mode === "static") {
      processed = removeDCOffsetStatic(processed);
    } else if (mode === "iir") {
      if (params.dcBlockerState) {
        processed = removeDCOffsetIIR(processed, params.dcBlockerState);
      } else {
        // Fallback to static if no state provided
        processed = removeDCOffsetStatic(processed);
      }
    } else if (mode === "combined") {
      if (params.dcBlockerState) {
        processed = removeDCOffsetCombined(processed, params.dcBlockerState);
      } else {
        // Fallback to static if no state provided
        processed = removeDCOffsetStatic(processed);
      }
    }
  }

  // IQ Balance Correction
  let gainError = 0;
  let phaseError = 0;

  if (params.iqBalance && processed.length > 0) {
    // Calculate RMS for I and Q channels
    let sumI2 = 0;
    let sumQ2 = 0;
    let sumIQ = 0;

    for (const sample of processed) {
      sumI2 += sample.I * sample.I;
      sumQ2 += sample.Q * sample.Q;
      sumIQ += sample.I * sample.Q;
    }

    const rmsI = Math.sqrt(sumI2 / processed.length);
    const rmsQ = Math.sqrt(sumQ2 / processed.length);

    // Guard against divide-by-zero and ensure numerical stability
    if (rmsI > MIN_RMS_THRESHOLD && rmsQ > MIN_RMS_THRESHOLD) {
      // Gain imbalance correction
      const gainRatio = rmsQ / rmsI;
      gainError = Math.abs(gainRatio - 1.0);

      // Only apply correction if error is significant
      if (gainError > GAIN_ERROR_THRESHOLD) {
        processed = processed.map((s) => ({
          I: s.I * gainRatio,
          Q: s.Q,
        }));
      }

      // Phase imbalance correction (orthogonality)
      // Phase error is estimated from the correlation between I and Q
      const correlation = sumIQ / Math.sqrt(sumI2 * sumQ2);
      phaseError = Math.abs(correlation); // Ideally should be ~0 for orthogonal signals

      // Only apply phase correction if error is significant
      if (phaseError > PHASE_ERROR_THRESHOLD) {
        // Simple orthogonalization: Q' = Q - (Q·I/|I|²)*I
        const dotProduct = sumIQ;
        const i2Norm = sumI2;

        if (i2Norm > MIN_RMS_THRESHOLD) {
          const correctionFactor = dotProduct / i2Norm;
          processed = processed.map((s) => ({
            I: s.I,
            Q: s.Q - correctionFactor * s.I,
          }));
        }
      }
    }
  }

  return {
    output: processed,
    metrics: { gainError, phaseError },
  };
}

export function processFFT(
  samples: Sample[],
  params: { fftSize: number; windowType: WindowFunction },
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
        windowType: params.windowType,
        processingTime: 0,
      },
    };
  }

  // Apply windowing first
  const windowed = applyWindow(
    samples.slice(0, params.fftSize),
    params.windowType,
  );

  // Calculate FFT
  const fft = calculateFFTSync(windowed, params.fftSize);
  const processingTime = performance.now() - startTime;

  return {
    output: fft,
    metrics: {
      bins: fft.length,
      windowType: params.windowType,
      processingTime,
    },
  };
}

export function processDemodulation(
  samples: Sample[],
  _params: { mode: string },
): { output: Float32Array; metrics: Record<string, never> } {
  // For now, simple AM demodulation (magnitude)
  const demodulated = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample) {
      demodulated[i] = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
    }
  }
  return {
    output: demodulated,
    metrics: {},
  };
}

export function processAudioOutput(
  samples: Float32Array,
  params: { sampleRate: number; volume: number },
): { output: Float32Array; metrics: { sampleRate: number } } {
  // Apply volume scaling
  const scaled = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    scaled[i] = samples[i]! * params.volume;
  }
  return {
    output: scaled,
    metrics: { sampleRate: params.sampleRate },
  };
}

/**
 * Type definition for pipeline transform function
 */
export type PipelineTransform<TIn, TOut, TMetrics = Record<string, never>> = (
  input: TIn,
) => { output: TOut; metrics: TMetrics };

/**
 * Result of a pipeline stage execution
 */
export interface PipelineStageResult<T> {
  output: T;
  metrics: Record<string, number | string | boolean>;
}

/**
 * Compose multiple pipeline stages into a single transform
 * Allows chaining transformations with metric collection
 */
export function composePipeline<TOut>(
  ...stages: Array<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (input: any) => { output: any; metrics: Record<string, any> }
  >
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (input: any) => PipelineStageResult<TOut> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (input: any): PipelineStageResult<TOut> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let current = input;
    const allMetrics: Record<string, number | string | boolean> = {};

    for (const stage of stages) {
      const result = stage(current);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      current = result.output;
      Object.assign(allMetrics, result.metrics);
    }

    return {
      output: current as TOut,
      metrics: allMetrics,
    };
  };
}

/**
 * Create a visualization pipeline with configurable stages
 */
export function createVisualizationPipeline(config: {
  fftSize: number;
  windowType: WindowFunction;
  dcCorrection: boolean;
}): (samples: Sample[]) => PipelineStageResult<Float32Array> {
  return composePipeline<Float32Array>(
    // Stage 1: DC correction (optional)
    (samples: Sample[]) => {
      if (config.dcCorrection) {
        return {
          output: removeDCOffsetStatic(samples),
          metrics: { dcCorrected: true },
        };
      }
      return { output: samples, metrics: { dcCorrected: false } };
    },
    // Stage 2: FFT
    (samples: Sample[]) =>
      processFFT(samples, {
        fftSize: config.fftSize,
        windowType: config.windowType,
      }),
  );
}
