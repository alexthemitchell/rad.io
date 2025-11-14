/**
 * Sample Format Conversion Utilities
 *
 * Provides utilities for converting between different sample formats
 * used in SDR applications (IQ samples, raw buffers, etc.).
 *
 * @module dsp/conversions
 */

import type { Sample } from "../../utils/dsp";

/**
 * Convert raw IQ sample pairs to Sample objects
 *
 * @param rawSamples - Array of [I, Q] tuples
 * @returns Array of Sample objects
 * @throws Error if samples contain non-finite values
 *
 * @example
 * ```typescript
 * import { convertToSamples } from "@/lib/dsp";
 *
 * const raw: [number, number][] = [[0.5, 0.3], [0.7, -0.2]];
 * const samples = convertToSamples(raw);
 * ```
 */
export function convertToSamples(
  rawSamples: Array<[number, number]>,
): Sample[] {
  const result: Sample[] = [];
  for (const pair of rawSamples) {
    const [i, q] = pair;
    if (!Number.isFinite(i) || !Number.isFinite(q)) {
      throw new Error("invalid sample: non-finite value");
    }
    result.push({ I: i, Q: q });
  }
  return result;
}

/**
 * Convert Sample objects to raw IQ pairs
 *
 * @param samples - Array of Sample objects
 * @returns Array of [I, Q] tuples
 */
export function convertFromSamples(samples: Sample[]): Array<[number, number]> {
  return samples.map((s) => [s.I, s.Q] as [number, number]);
}

/**
 * Convert interleaved IQ buffer to Sample objects
 *
 * The buffer format is [I0, Q0, I1, Q1, I2, Q2, ...]
 *
 * @param buffer - Interleaved IQ buffer
 * @returns Array of Sample objects
 *
 * @example
 * ```typescript
 * import { convertInterleavedToSamples } from "@/lib/dsp";
 *
 * const buffer = new Float32Array([0.5, 0.3, 0.7, -0.2]);
 * const samples = convertInterleavedToSamples(buffer);
 * // samples = [{I: 0.5, Q: 0.3}, {I: 0.7, Q: -0.2}]
 * ```
 */
export function convertInterleavedToSamples(
  buffer: Float32Array | number[],
): Sample[] {
  const numSamples = Math.floor(buffer.length / 2);
  const result: Sample[] = [];

  for (let i = 0; i < numSamples; i++) {
    const I = buffer[i * 2];
    const Q = buffer[i * 2 + 1];
    if (I !== undefined && Q !== undefined) {
      result.push({ I, Q });
    }
  }

  return result;
}

/**
 * Convert Sample objects to interleaved IQ buffer
 *
 * The output format is [I0, Q0, I1, Q1, I2, Q2, ...]
 *
 * @param samples - Array of Sample objects
 * @returns Interleaved IQ buffer
 */
export function convertSamplesToInterleaved(samples: Sample[]): Float32Array {
  const buffer = new Float32Array(samples.length * 2);

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample) {
      buffer[i * 2] = sample.I;
      buffer[i * 2 + 1] = sample.Q;
    }
  }

  return buffer;
}

/**
 * Convert separate I and Q buffers to Sample objects
 *
 * @param iBuffer - In-phase component buffer
 * @param qBuffer - Quadrature component buffer
 * @returns Array of Sample objects
 * @throws Error if buffers have different lengths
 */
export function convertSeparateToSamples(
  iBuffer: Float32Array | number[],
  qBuffer: Float32Array | number[],
): Sample[] {
  if (iBuffer.length !== qBuffer.length) {
    throw new Error("I and Q buffers must have the same length");
  }

  const result: Sample[] = [];
  for (let i = 0; i < iBuffer.length; i++) {
    const I = iBuffer[i];
    const Q = qBuffer[i];
    if (I !== undefined && Q !== undefined) {
      result.push({ I, Q });
    }
  }

  return result;
}

/**
 * Convert Sample objects to separate I and Q buffers
 *
 * @param samples - Array of Sample objects
 * @returns Object containing separate I and Q buffers
 */
export function convertSamplesToSeparate(samples: Sample[]): {
  I: Float32Array;
  Q: Float32Array;
} {
  const I = new Float32Array(samples.length);
  const Q = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample) {
      I[i] = sample.I;
      Q[i] = sample.Q;
    }
  }

  return { I, Q };
}

/**
 * Calculate magnitude (amplitude) from IQ samples
 *
 * @param samples - Input IQ samples
 * @returns Array of magnitude values
 *
 * @example
 * ```typescript
 * import { calculateMagnitude } from "@/lib/dsp";
 *
 * const samples: Sample[] = [{I: 3, Q: 4}, {I: 1, Q: 0}];
 * const magnitude = calculateMagnitude(samples);
 * // magnitude = [5.0, 1.0]
 * ```
 */
export function calculateMagnitude(samples: Sample[]): Float32Array {
  const result = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample) {
      const { I, Q } = sample;
      result[i] = Math.sqrt(I * I + Q * Q);
    }
  }

  return result;
}

/**
 * Calculate phase from IQ samples
 *
 * @param samples - Input IQ samples
 * @returns Array of phase values in radians [-π, π]
 */
export function calculatePhase(samples: Sample[]): Float32Array {
  const result = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample) {
      const { I, Q } = sample;
      result[i] = Math.atan2(Q, I);
    }
  }

  return result;
}

/**
 * Calculate waveform data (magnitude and phase) for time-domain visualization
 *
 * @param samples - Input IQ samples
 * @returns Object containing amplitude and phase arrays
 *
 * @example
 * ```typescript
 * import { calculateWaveform } from "@/lib/dsp";
 *
 * const samples: Sample[] = [...];
 * const { amplitude, phase } = calculateWaveform(samples);
 * ```
 */
export function calculateWaveform(samples: Sample[]): {
  amplitude: Float32Array;
  phase: Float32Array;
} {
  return {
    amplitude: calculateMagnitude(samples),
    phase: calculatePhase(samples),
  };
}

/**
 * Normalize samples to a target RMS level
 *
 * @param samples - Input IQ samples
 * @param targetRMS - Target RMS level (default: 0.7)
 * @returns Normalized samples
 */
export function normalizeSamples(samples: Sample[], targetRMS = 0.7): Sample[] {
  if (samples.length === 0) return [];

  // Calculate current RMS
  let sumSquares = 0;
  for (const sample of samples) {
    sumSquares += sample.I * sample.I + sample.Q * sample.Q;
  }
  const currentRMS = Math.sqrt(sumSquares / samples.length);

  if (currentRMS === 0) return samples;

  // Calculate scaling factor
  const scale = targetRMS / currentRMS;

  // Apply scaling
  return samples.map((s) => ({
    I: s.I * scale,
    Q: s.Q * scale,
  }));
}
