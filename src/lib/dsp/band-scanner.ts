/**
 * Band Scanning Utilities
 * Implements ADR-0012: Parallel FFT Worker Pool
 * 
 * Provides batch processing capabilities for frequency band scanning
 */

import { fftWorkerPool } from "./fft-worker-pool";
import type { ScanResult } from "../workers/types";

// Type definitions for SDR device interface
type FrequencyHz = number;

interface SDRDevice {
  setFrequency(freq: FrequencyHz): Promise<void>;
  captureSamples(count: number): Promise<Float32Array>;
  config: {
    sampleRate: number;
  };
}

/**
 * Delay utility for settling time
 * @param ms Milliseconds to delay
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Scan a frequency band using parallel FFT processing
 * @param device SDR device instance
 * @param startFreq Starting frequency in Hz
 * @param endFreq Ending frequency in Hz
 * @param step Frequency step size in Hz
 * @returns Array of scan results with power spectrum data
 */
export async function scanBand(
  device: SDRDevice,
  startFreq: FrequencyHz,
  endFreq: FrequencyHz,
  step: number,
): Promise<ScanResult[]> {
  const frequencies: FrequencyHz[] = [];

  // Generate frequency list
  for (let freq = startFreq; freq <= endFreq; freq += step) {
    frequencies.push(freq);
  }

  console.info(`Scanning ${frequencies.length} frequencies from ${startFreq} to ${endFreq} Hz`);

  // Process all frequencies in parallel
  const results = await Promise.all(
    frequencies.map(async (freq, index) => {
      try {
        // Tune to frequency
        await device.setFrequency(freq);

        // Allow settling time
        await delay(10);

        // Capture samples
        const samples = await device.captureSamples(2048);

        // Compute FFT with priority based on scan order
        const fft = await fftWorkerPool.computeFFT(
          samples,
          device.config.sampleRate,
          index, // Priority = order in scan
        );

        // Calculate peak power
        const peakPower = Math.max(...Array.from(fft.magnitude));

        return {
          frequency: freq,
          powerSpectrum: fft.magnitude,
          peakPower,
        };
      } catch (error) {
        console.error(`Failed to scan frequency ${freq}:`, error);
        return {
          frequency: freq,
          powerSpectrum: new Float32Array(0),
          peakPower: -Infinity,
        };
      }
    }),
  );

  return results;
}

/**
 * Find active signals in scan results
 * @param results Scan results from scanBand
 * @param threshold Power threshold in dB
 * @returns Array of frequencies with signals above threshold
 */
export function findActiveSignals(
  results: ScanResult[],
  threshold = -60,
): Array<{ frequency: number; power: number }> {
  return results
    .filter((result) => result.peakPower > threshold)
    .map((result) => ({
      frequency: result.frequency,
      power: result.peakPower,
    }))
    .sort((a, b) => b.power - a.power); // Sort by power descending
}

/**
 * Batch process multiple frequency ranges
 * @param device SDR device instance
 * @param ranges Array of frequency ranges to scan
 * @param step Frequency step size in Hz
 * @returns Combined scan results for all ranges
 */
export async function batchScanRanges(
  device: SDRDevice,
  ranges: Array<{ start: FrequencyHz; end: FrequencyHz }>,
  step: number,
): Promise<ScanResult[]> {
  const allResults: ScanResult[] = [];

  for (const range of ranges) {
    const results = await scanBand(device, range.start, range.end, step);
    allResults.push(...results);
  }

  return allResults;
}
