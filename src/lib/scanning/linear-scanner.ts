/**
 * Linear Scanner
 * Implements ADR-0014: Automatic Frequency Scanning
 *
 * Sequential scanning through a frequency range
 */

import { fftWorkerPool } from "../dsp/fft-worker-pool";
import { getSampleRate } from "../utils/device-utils";
import type { IScanner, ScanConfig, ScanResult } from "./types";

/**
 * Delay utility for settling time
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Linear (sequential) frequency scanner
 */
export class LinearScanner implements IScanner {
  /**
   * Scan a frequency range sequentially
   * @param device SDR device
   * @param config Scan configuration
   * @param onProgress Progress callback
   * @param signal Abort signal
   * @returns Array of scan results
   */
  async scan(
    device: any,
    config: ScanConfig,
    onProgress: (result: ScanResult) => void,
    signal: AbortSignal,
  ): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    const settlingTime = config.settlingTime ?? 50;
    const sampleCount = config.sampleCount ?? 2048;

    // Generate frequency list
    const frequencies: number[] = [];
    for (let freq = config.startFreq; freq <= config.endFreq; freq += config.step) {
      frequencies.push(freq);
    }

    console.info(
      `Linear scan: ${frequencies.length} frequencies from ${config.startFreq} to ${config.endFreq} Hz`,
    );

    // Scan each frequency sequentially
    for (const freq of frequencies) {
      if (signal.aborted) {
        console.info("Scan aborted");
        break;
      }

      try {
        // Tune to frequency
        await device.setFrequency(freq);

        // Allow settling time
        await delay(settlingTime);

        // Capture samples
        const samples = await device.captureSamples(sampleCount);

        // Compute FFT
        const fft = await fftWorkerPool.computeFFT(
          samples,
          getSampleRate(device),
        );

        // Calculate statistics
        const peakPower = Math.max(...Array.from(fft.magnitude));
        const avgPower =
          Array.from(fft.magnitude).reduce((sum, val) => sum + val, 0) /
          fft.magnitude.length;

        const result: ScanResult = {
          frequency: freq,
          timestamp: Date.now(),
          powerSpectrum: fft.magnitude,
          peakPower,
          avgPower,
        };

        results.push(result);
        onProgress(result);
      } catch (error) {
        console.error(`Failed to scan frequency ${freq}:`, error);
      }
    }

    return results;
  }
}
