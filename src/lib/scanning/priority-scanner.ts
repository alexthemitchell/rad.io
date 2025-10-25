/**
 * Priority Scanner
 * Implements ADR-0014: Automatic Frequency Scanning
 *
 * Scans priority frequencies first, then fills in the range
 */

import type { IScanner, ScanConfig, ScanResult } from "./types";
import { LinearScanner } from "./linear-scanner";
import { fftWorkerPool } from "../dsp/fft-worker-pool";
import { getSampleRate } from "../utils/device-utils";

/**
 * Delay utility
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Priority scanner that scans bookmarked frequencies first
 */
export class PriorityScanner implements IScanner {
  private linearScanner = new LinearScanner();

  /**
   * Scan with priority frequencies first
   * @param device SDR device
   * @param config Scan configuration (must include priorityFrequencies)
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
    const priorityFreqs = config.priorityFrequencies ?? [];

    console.info(
      `Priority scan: ${priorityFreqs.length} priority frequencies, then full range`,
    );

    // Scan priority frequencies first
    for (const freq of priorityFreqs) {
      if (signal.aborted) {
        console.info("Scan aborted");
        return results;
      }

      // Skip if outside scan range
      if (freq < config.startFreq || freq > config.endFreq) {
        continue;
      }

      try {
        const result = await this.scanFrequency(
          device,
          freq,
          settlingTime,
          sampleCount,
        );
        results.push(result);
        onProgress(result);
      } catch (error) {
        console.error(`Failed to scan priority frequency ${freq}:`, error);
      }
    }

    // Then scan the full range using linear scanner
    // Skip frequencies already scanned
    const scannedFreqs = new Set(results.map((r) => r.frequency));
    const linearResults = await this.linearScanner.scan(
      device,
      config,
      (result) => {
        // Only report if not already scanned
        if (!scannedFreqs.has(result.frequency)) {
          onProgress(result);
        }
      },
      signal,
    );

    // Add results that weren't already scanned
    for (const result of linearResults) {
      if (!scannedFreqs.has(result.frequency)) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Scan a single frequency
   */
  private async scanFrequency(
    device: any,
    freq: number,
    settlingTime: number,
    sampleCount: number,
  ): Promise<ScanResult> {
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

    return {
      frequency: freq,
      timestamp: Date.now(),
      powerSpectrum: fft.magnitude,
      peakPower,
      avgPower,
    };
  }
}
