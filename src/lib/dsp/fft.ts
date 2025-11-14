/**
 * FFT (Fast Fourier Transform) Operations
 *
 * Provides FFT functionality with automatic WASM acceleration and JavaScript fallback.
 * Includes optimizations for real-time SDR signal processing.
 *
 * @module dsp/fft
 */

import {
  calculateFFTWasm,
  isWasmAvailable,
  isWasmRuntimeEnabled,
  isWasmValidationEnabled,
} from "../../utils/dspWasm";
import { performanceMonitor } from "../../utils/performanceMonitor";
import type { Sample } from "./types";

/**
 * Minimum magnitude to prevent underflow in dB calculations
 * Corresponds to approximately -200 dB noise floor
 */
const MIN_MAGNITUDE = 1e-10;

/**
 * Cache for pre-computed sine and cosine tables for common FFT sizes
 * Improves performance by avoiding repeated trig calculations
 */
const trigCache = new Map<number, { cos: Float32Array; sin: Float32Array }>();

/**
 * Get or compute trig tables for a given FFT size
 */
function getTrigTables(fftSize: number): {
  cos: Float32Array;
  sin: Float32Array;
} {
  const cached = trigCache.get(fftSize);
  if (cached) {
    return cached;
  }

  const cos = new Float32Array(fftSize);
  const sin = new Float32Array(fftSize);

  for (let k = 0; k < fftSize; k++) {
    const angle = (-2 * Math.PI * k) / fftSize;
    cos[k] = Math.cos(angle);
    sin[k] = Math.sin(angle);
  }

  const tables = { cos, sin };
  trigCache.set(fftSize, tables);
  return tables;
}

/**
 * Calculate FFT synchronously using manual DFT with WASM acceleration
 *
 * Optimized for real-time visualization with proper frequency shifting.
 * Automatically uses WASM when available for 4-8x performance improvement.
 *
 * @param samples - Input IQ samples
 * @param fftSize - FFT size (should be power of 2 for best performance)
 * @returns Power spectrum in dB with DC centered
 *
 * @example
 * ```typescript
 * import { calculateFFT } from "@/lib/dsp";
 * import type { Sample } from "@/utils/dsp";
 *
 * const samples: Sample[] = [...];
 * const spectrum = calculateFFT(samples, 2048);
 * // spectrum is Float32Array of length 1024 with power in dB
 * ```
 */
export function calculateFFT(samples: Sample[], fftSize: number): Float32Array {
  const markStart = `fft-${fftSize}-start`;
  performanceMonitor.mark(markStart);

  try {
    // Try WASM first if available
    if (isWasmAvailable() && isWasmRuntimeEnabled()) {
      const wasmResult = calculateFFTWasm(samples, fftSize);
      if (wasmResult) {
        // Optionally validate WASM output to detect degenerate results
        if (isWasmValidationEnabled()) {
          const range = validateFFTOutput(wasmResult);
          if (range > 1e-3) {
            performanceMonitor.measure(`fft-wasm-${fftSize}`, markStart);
            return wasmResult;
          }
          console.warn(
            "📡 DSP: calculateFFT: Degenerate WASM FFT output detected; falling back to JS",
            { fftSize, range },
          );
        } else {
          performanceMonitor.measure(`fft-wasm-${fftSize}`, markStart);
          return wasmResult;
        }
      }
    }

    // Fallback to JavaScript implementation
    const result = calculateFFTJS(samples, fftSize);
    performanceMonitor.measure(`fft-js-${fftSize}`, markStart);
    return result;
  } catch (error) {
    console.error("📡 DSP: FFT calculation error:", error);
    performanceMonitor.measure(`fft-error-${fftSize}`, markStart);
    // Return empty spectrum on error
    return new Float32Array(fftSize / 2);
  }
}

/**
 * JavaScript implementation of FFT using DFT
 * Used as fallback when WASM is unavailable
 */
function calculateFFTJS(samples: Sample[], fftSize: number): Float32Array {
  const numSamples = Math.min(samples.length, fftSize);
  const halfSize = fftSize / 2;
  const magnitude = new Float32Array(halfSize);

  // Get cached trig tables
  const { cos, sin } = getTrigTables(fftSize);

  // Calculate DFT for positive frequencies only (0 to Nyquist)
  for (let k = 0; k < halfSize; k++) {
    let realSum = 0;
    let imagSum = 0;

    for (let n = 0; n < numSamples; n++) {
      const sample = samples[n];
      if (!sample) continue;

      const tableIndex = (k * n) % fftSize;
      const cosVal = cos[tableIndex];
      const sinVal = sin[tableIndex];

      if (cosVal === undefined || sinVal === undefined) continue;

      // Complex multiplication: (I + jQ) * (cos - j*sin)
      realSum += sample.I * cosVal + sample.Q * sinVal;
      imagSum += sample.Q * cosVal - sample.I * sinVal;
    }

    // Calculate magnitude and convert to dB
    const mag = Math.sqrt(realSum * realSum + imagSum * imagSum);
    const normalizedMag = Math.max(mag / numSamples, MIN_MAGNITUDE);
    magnitude[k] = 20 * Math.log10(normalizedMag);
  }

  // Shift FFT to center zero frequency
  return shiftFFT(magnitude);
}

/**
 * Shift FFT output to center DC (zero frequency)
 * Converts [0, f_nyquist] to [-f_nyquist/2, f_nyquist/2]
 */
function shiftFFT(spectrum: Float32Array): Float32Array {
  const half = Math.floor(spectrum.length / 2);
  const shifted = new Float32Array(spectrum.length);

  shifted.set(spectrum.slice(half), 0);
  shifted.set(spectrum.slice(0, half), half);

  return shifted;
}

/**
 * Validate FFT output to detect degenerate results
 * Returns the dynamic range in dB
 */
function validateFFTOutput(fft: Float32Array): number {
  if (fft.length === 0) return 0;

  let min = Infinity;
  let max = -Infinity;

  for (const val of fft) {
    if (Number.isFinite(val)) {
      min = Math.min(min, val);
      max = Math.max(max, val);
    }
  }

  return max - min;
}

/**
 * Calculate spectrogram (series of FFTs over time)
 *
 * @param samples - Input IQ samples
 * @param fftSize - FFT size for each time slice
 * @param hopSize - Number of samples to advance between FFTs
 * @returns Array of FFT results (one per time slice)
 */
export function calculateSpectrogram(
  samples: Sample[],
  fftSize: number,
  hopSize: number,
): Float32Array[] {
  const numFrames = Math.floor((samples.length - fftSize) / hopSize) + 1;
  const result: Float32Array[] = [];

  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    const end = start + fftSize;
    const frame = samples.slice(start, end);

    if (frame.length === fftSize) {
      result.push(calculateFFT(frame, fftSize));
    }
  }

  return result;
}

/**
 * Clear the trig table cache
 * Useful for memory management in long-running applications
 */
export function clearFFTCache(): void {
  trigCache.clear();
}
