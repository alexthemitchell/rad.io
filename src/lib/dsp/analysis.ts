/**
 * Signal Analysis Functions
 *
 * Provides signal analysis and measurement utilities for SDR applications.
 * Includes RMS, peak detection, SNR calculation, and spectral analysis.
 *
 * @module dsp/analysis
 */

import type { Sample } from "./types";

/**
 * Signal metrics computed from IQ samples
 */
export interface SignalMetrics {
  /** Root mean square amplitude */
  rms: number;
  /** Peak amplitude */
  peak: number;
  /** DC offset (mean value) */
  dcOffset: { I: number; Q: number };
  /** Signal-to-noise ratio in dB (if computable) */
  snr?: number;
}

/**
 * Detected peak in power spectrum
 */
export interface SpectralPeak {
  /** Frequency in Hz */
  frequency: number;
  /** Power in dB */
  powerDb: number;
  /** FFT bin index */
  binIndex: number;
}

/**
 * Calculate signal strength from IQ samples
 *
 * Returns signal strength in dBm (relative to maximum possible signal).
 * Range is typically -100 dBm (very weak) to 0 dBm (maximum).
 *
 * @param samples - Input IQ samples
 * @returns Signal strength in dBm
 *
 * @example
 * ```typescript
 * import { calculateSignalStrength } from "@/lib/dsp";
 * import type { Sample } from "@/utils/dsp";
 *
 * const samples: Sample[] = [...];
 * const strength = calculateSignalStrength(samples);
 * console.log(`Signal: ${strength.toFixed(1)} dBm`);
 * ```
 */
export function calculateSignalStrength(samples: Sample[]): number {
  if (samples.length === 0) {
    return -100; // Minimum signal strength
  }

  // Calculate RMS (Root Mean Square) power
  let sumSquares = 0;
  for (const sample of samples) {
    // Power is magnitude squared: I^2 + Q^2
    sumSquares += sample.I * sample.I + sample.Q * sample.Q;
  }

  const rms = Math.sqrt(sumSquares / samples.length);

  // Convert to dBm (assuming normalized range where max amplitude is 1.0)
  // dBm = 20 * log10(rms)
  // Clamp to reasonable range: -100 to 0 dBm
  const dBm = rms > 0 ? 20 * Math.log10(rms) : -100;
  return Math.max(-100, Math.min(0, dBm));
}

/**
 * Calculate comprehensive signal metrics
 *
 * @param samples - Input IQ samples
 * @returns Signal metrics including RMS, peak, DC offset
 */
export function calculateMetrics(samples: Sample[]): SignalMetrics {
  if (samples.length === 0) {
    return {
      rms: 0,
      peak: 0,
      dcOffset: { I: 0, Q: 0 },
    };
  }

  let sumI = 0;
  let sumQ = 0;
  let sumSquares = 0;
  let peak = 0;

  for (const sample of samples) {
    sumI += sample.I;
    sumQ += sample.Q;

    const magnitude = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
    sumSquares += magnitude * magnitude;
    peak = Math.max(peak, magnitude);
  }

  const n = samples.length;
  const rms = Math.sqrt(sumSquares / n);

  return {
    rms,
    peak,
    dcOffset: {
      I: sumI / n,
      Q: sumQ / n,
    },
  };
}

/**
 * Calculate RMS (Root Mean Square) amplitude
 *
 * @param samples - Input IQ samples
 * @returns RMS amplitude
 */
export function calculateRMS(samples: Sample[]): number {
  if (samples.length === 0) return 0;

  let sumSquares = 0;
  for (const sample of samples) {
    const magnitude = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
    sumSquares += magnitude * magnitude;
  }

  return Math.sqrt(sumSquares / samples.length);
}

/**
 * Calculate peak amplitude
 *
 * @param samples - Input IQ samples
 * @returns Peak amplitude
 */
export function calculatePeak(samples: Sample[]): number {
  if (samples.length === 0) return 0;

  let peak = 0;
  for (const sample of samples) {
    const magnitude = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
    peak = Math.max(peak, magnitude);
  }

  return peak;
}

/**
 * Convert FFT bin index to frequency in Hz
 *
 * @param binIndex - FFT bin index (0 to fftSize-1)
 * @param fftSize - Size of FFT
 * @param sampleRate - Sample rate in Hz
 * @param centerFrequency - Center frequency of the captured spectrum in Hz
 * @returns Frequency in Hz
 */
export function binToFrequency(
  binIndex: number,
  fftSize: number,
  sampleRate: number,
  centerFrequency: number,
): number {
  // FFT output is shifted with DC at center
  // Bin 0 corresponds to -sampleRate/2 offset from center
  // Bin fftSize/2 corresponds to +0 Hz offset from center
  // Bin fftSize-1 corresponds to +sampleRate/2 offset from center

  const frequencyResolution = sampleRate / fftSize;
  const offset = (binIndex - fftSize / 2) * frequencyResolution;
  return centerFrequency + offset;
}

/**
 * Detect peaks in power spectrum above threshold
 *
 * Uses simple local maximum detection with configurable parameters.
 *
 * @param powerSpectrum - Power spectrum in dB (output from calculateFFT)
 * @param sampleRate - Sample rate in Hz
 * @param centerFrequency - Center frequency of the captured spectrum in Hz
 * @param thresholdDb - Minimum power threshold in dB
 * @param minPeakSpacing - Minimum spacing between peaks in Hz (prevents duplicates)
 * @param edgeMargin - Number of bins to ignore at spectrum edges
 * @returns Array of detected peaks sorted by power (strongest first)
 *
 * @example
 * ```typescript
 * import { calculateFFT } from "@/lib/dsp/fft";
 * import { detectSpectralPeaks } from "@/lib/dsp/analysis";
 *
 * const spectrum = calculateFFT(samples, 2048);
 * const peaks = detectSpectralPeaks(
 *   spectrum,
 *   2048000,  // 2.048 MHz sample rate
 *   100e6,    // 100 MHz center frequency
 *   -60,      // -60 dB threshold
 *   200e3,    // 200 kHz min spacing
 * );
 * ```
 */
export function detectSpectralPeaks(
  powerSpectrum: Float32Array,
  sampleRate: number,
  centerFrequency: number,
  thresholdDb: number,
  minPeakSpacing = 200e3, // 200 kHz default for wideband FM signals
  edgeMargin = 10, // Ignore edge bins
): SpectralPeak[] {
  const fftSize = powerSpectrum.length;
  const peaks: SpectralPeak[] = [];

  // Find local maxima above threshold
  for (let i = edgeMargin; i < fftSize - edgeMargin; i++) {
    const power = powerSpectrum[i];
    if (power === undefined) continue;

    // Check if above threshold
    if (power < thresholdDb) continue;

    // Check if local maximum (higher than neighbors)
    const leftPower = i > 0 ? (powerSpectrum[i - 1] ?? -Infinity) : -Infinity;
    const rightPower =
      i < fftSize - 1 ? (powerSpectrum[i + 1] ?? -Infinity) : -Infinity;

    if (power > leftPower && power > rightPower) {
      const frequency = binToFrequency(i, fftSize, sampleRate, centerFrequency);
      peaks.push({
        frequency,
        powerDb: power,
        binIndex: i,
      });
    }
  }

  // Sort by power (strongest first)
  peaks.sort((a, b) => b.powerDb - a.powerDb);

  // Filter out peaks that are too close together
  if (minPeakSpacing > 0) {
    const filtered: SpectralPeak[] = [];

    for (const peak of peaks) {
      let tooClose = false;

      for (const existing of filtered) {
        if (Math.abs(peak.frequency - existing.frequency) < minPeakSpacing) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        filtered.push(peak);
      }
    }

    return filtered;
  }

  return peaks;
}

/**
 * Estimate SNR (Signal-to-Noise Ratio) from power spectrum
 *
 * Uses a simple approach: assumes strongest peak is signal,
 * and median of remaining bins is noise floor.
 *
 * @param powerSpectrum - Power spectrum in dB
 * @returns Estimated SNR in dB, or undefined if not computable
 */
export function estimateSNR(powerSpectrum: Float32Array): number | undefined {
  if (powerSpectrum.length < 10) return undefined;

  // Find peak (signal)
  let maxPower = -Infinity;
  for (const power of powerSpectrum) {
    maxPower = Math.max(maxPower, power);
  }

  // Calculate median for noise floor estimate
  const sorted = Array.from(powerSpectrum).sort((a, b) => a - b);
  const medianIdx = Math.floor(sorted.length / 2);
  const noiseFloor = sorted[medianIdx];

  if (noiseFloor === undefined) return undefined;

  return maxPower - noiseFloor;
}
