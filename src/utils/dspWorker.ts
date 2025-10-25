/**
 * Worker-based DSP Functions
 * Provides worker pool alternatives to synchronous DSP operations
 * Integrates ADR-0002 and ADR-0012 implementations
 */

import { fftWorkerPool } from "../lib/dsp/fft-worker-pool";
import { dspWorkerPool } from "../lib/workers/dsp-worker-pool";
import type { Sample } from "./dsp";

let idCounter = 0;

function generateId(): string {
  return `dsp-${Date.now()}-${idCounter++}`;
}

/**
 * Convert Sample[] to interleaved Float32Array (I,Q,I,Q,...)
 * @param samples Array of IQ samples
 * @returns Interleaved Float32Array
 */
function samplesToFloat32Array(samples: Sample[]): Float32Array {
  const result = new Float32Array(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    result[i * 2] = samples[i]?.I ?? 0;
    result[i * 2 + 1] = samples[i]?.Q ?? 0;
  }
  return result;
}

/**
 * Calculate FFT using worker pool (non-blocking)
 * Preferred over calculateFFTSync for large datasets or when UI responsiveness is critical
 * 
 * @param samples Array of IQ samples
 * @param fftSize FFT size (power of 2)
 * @param priority Optional priority (higher = more urgent)
 * @returns Promise resolving to power spectrum in dB
 */
export async function calculateFFTWorker(
  samples: Sample[],
  _fftSize: number,
  priority = 0,
): Promise<Float32Array> {
  const float32Samples = samplesToFloat32Array(samples);
  
  const result = await fftWorkerPool.computeFFT(
    float32Samples,
    48000, // Sample rate (not used in computation, but required by interface)
    priority,
  );
  
  return result.magnitude;
}

/**
 * Calculate FFT using DSP worker pool (general purpose)
 * Alternative to calculateFFTWorker with different worker pool
 * 
 * @param samples Array of IQ samples
 * @param fftSize FFT size (power of 2)
 * @returns Promise resolving to power spectrum in dB
 */
export async function calculateFFTWorkerDSP(
  samples: Sample[],
  fftSize: number,
): Promise<Float32Array> {
  const float32Samples = samplesToFloat32Array(samples);
  
  const response = await dspWorkerPool.process({
    id: generateId(),
    type: "fft",
    samples: float32Samples,
    sampleRate: 48000,
    params: { fftSize },
  });
  
  return response.result as Float32Array;
}

/**
 * Demodulate signal using worker pool (non-blocking)
 * 
 * @param samples Array of IQ samples
 * @param mode Demodulation mode
 * @param sampleRate Sample rate in Hz
 * @returns Promise resolving to demodulated audio samples
 */
export async function demodulateWorker(
  samples: Sample[],
  mode: "am" | "fm" | "usb" | "lsb",
  sampleRate: number,
): Promise<Float32Array> {
  const float32Samples = samplesToFloat32Array(samples);
  
  const response = await dspWorkerPool.process({
    id: generateId(),
    type: "demod",
    samples: float32Samples,
    sampleRate,
    params: { mode },
  });
  
  return response.result as Float32Array;
}

/**
 * Apply filter using worker pool (non-blocking)
 * 
 * @param samples Array of IQ samples
 * @param filterType Filter type
 * @param cutoff Cutoff frequency in Hz
 * @param sampleRate Sample rate in Hz
 * @returns Promise resolving to filtered samples
 */
export async function applyFilterWorker(
  samples: Sample[],
  filterType: string,
  cutoff: number,
  sampleRate: number,
): Promise<Float32Array> {
  const float32Samples = samplesToFloat32Array(samples);
  
  const response = await dspWorkerPool.process({
    id: generateId(),
    type: "filter",
    samples: float32Samples,
    sampleRate,
    params: { filterType, cutoff },
  });
  
  return response.result as Float32Array;
}

/**
 * Detect signals using worker pool (non-blocking)
 * 
 * @param samples Array of IQ samples
 * @param threshold Detection threshold in dB
 * @returns Promise resolving to detected peaks
 */
export async function detectSignalsWorker(
  samples: Sample[],
  threshold: number,
): Promise<{ peaks: Array<{ index: number; value: number }>; count: number }> {
  const float32Samples = samplesToFloat32Array(samples);
  
  const response = await dspWorkerPool.process({
    id: generateId(),
    type: "detect",
    samples: float32Samples,
    sampleRate: 48000,
    params: { threshold },
  });
  
  return response.result as { peaks: Array<{ index: number; value: number }>; count: number };
}

/**
 * Calculate spectrogram using worker pool (non-blocking)
 * Processes multiple FFT frames in parallel
 * 
 * @param samples Array of IQ samples
 * @param fftSize FFT size
 * @param hopSize Hop size between frames
 * @returns Promise resolving to 2D array of power spectra
 */
export async function calculateSpectrogramWorker(
  samples: Sample[],
  fftSize: number,
  hopSize: number,
): Promise<Float32Array[]> {
  const numFrames = Math.floor((samples.length - fftSize) / hopSize) + 1;
  const frames: Array<Promise<Float32Array>> = [];
  
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    const end = start + fftSize;
    const frameSamples = samples.slice(start, end);
    
    // Process frames with priority based on position (earlier frames first)
    frames.push(calculateFFTWorker(frameSamples, fftSize, numFrames - i));
  }
  
  return Promise.all(frames);
}

/**
 * Get performance metrics from DSP worker pool
 * @returns Current DSP metrics
 */
export { dspMetrics } from "../lib/monitoring/dsp-metrics";

/**
 * Export worker pools for advanced usage
 */
export { dspWorkerPool } from "../lib/workers/dsp-worker-pool";
export { fftWorkerPool } from "../lib/dsp/fft-worker-pool";

/**
 * Export band scanning utilities
 */
export { scanBand, findActiveSignals, batchScanRanges } from "../lib/dsp/band-scanner";
