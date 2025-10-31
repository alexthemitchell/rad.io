import { calculateSignalStrength, calculateFFTSync } from "./dsp";
import {
  isWasmAvailable,
  applyHannWindowWasm,
  applyHammingWindowWasm,
  applyBlackmanWindowWasm,
} from "./dspWasm";
import type { Sample } from "./dsp";
import type { ISDRDevice } from "../models/SDRDevice";

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
 * Apply Hamming window (cosine-based, slightly narrower main lobe)
 * Hamming window: w(n) = 0.54 - 0.46 * cos(2π*n/(N-1))
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
 * Apply Blackman window (three-term cosine, better sidelobe suppression)
 * Blackman window: w(n) = 0.42 - 0.5 * cos(2π*n/(N-1)) + 0.08 * cos(4π*n/(N-1))
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
 * Apply Kaiser window (adjustable sidelobe level)
 * Simplified Kaiser window with beta=5 for general purpose use
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
 * Apply specified window function to samples
 * Uses WASM acceleration when available for better performance
 */
export function applyWindow(
  samples: Sample[],
  windowType: WindowFunction,
  useWasm = true,
): Sample[] {
  // Try WASM first if requested and available
  if (useWasm && isWasmAvailable()) {
    // Make a copy to avoid modifying original
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
        // Not available in WASM, will use JS fallback
        break;
    }

    if (success) {
      return copy;
    }
    // Fall through to JavaScript implementation if WASM fails
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
 * Automatic Gain Control (AGC)
 * Adjusts signal amplitude to maintain consistent output level
 */
export function applyAGC(
  samples: Sample[],
  targetLevel = 0.7,
  attackRate = 0.01,
  releaseRate = 0.001,
): Sample[] {
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
    const minGain = 0.01;
    const maxGain = 10.0;
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
  params: { frequency: number; bandwidth: number; loOffset: number },
): { output: Sample[]; metrics: { actualFreq: number } } {
  // Apply frequency shift if LO offset is specified
  // Frequency shifting is done by multiplying samples with complex exponential: e^(j*2π*f*t)
  // This shifts the spectrum by the LO offset frequency
  if (params.loOffset !== 0 && samples.length > 0) {
    const shifted: Sample[] = [];
    const normalizedOffset = params.loOffset / params.bandwidth; // Normalize to sample rate

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

export function processIQSampling(
  samples: Sample[],
  params: { sampleRate: number; dcCorrection: boolean; iqBalance: boolean },
): { output: Sample[]; metrics: { sampleRate: number } } {
  // Apply DC offset removal and IQ balance correction if requested
  let output = samples;

  if (params.dcCorrection && samples.length > 0) {
    // Calculate DC offset (mean of I and Q)
    let sumI = 0;
    let sumQ = 0;
    for (const sample of samples) {
      sumI += sample.I;
      sumQ += sample.Q;
    }
    const dcOffsetI = sumI / samples.length;
    const dcOffsetQ = sumQ / samples.length;

    // Only apply correction if DC offset is significant (> 0.001)
    if (Math.abs(dcOffsetI) > 0.001 || Math.abs(dcOffsetQ) > 0.001) {
      // Remove DC offset
      output = output.map((sample) => ({
        I: sample.I - dcOffsetI,
        Q: sample.Q - dcOffsetQ,
      }));
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
    if (rmsI > 1e-10 && rmsQ > 1e-10) {
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

      if (gainError > 0.01 || phaseError > 0.01) {
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
