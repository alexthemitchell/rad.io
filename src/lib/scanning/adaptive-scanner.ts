/**
 * Adaptive Scanner
 * Implements ADR-0014: Automatic Frequency Scanning
 *
 * Intelligent scanning that adapts based on detected signals
 */

import { fftWorkerPool } from "../dsp/fft-worker-pool";
import { getSampleRate, type ISDRDevice } from "../utils/device-utils";
import type { IScanner, ScanConfig, ScanResult } from "./types";

/**
 * Delay utility
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Adaptive scanner that learns from scan results
 */
export class AdaptiveScanner implements IScanner {
  private interestingFrequencies = new Map<number, number>();
  private readonly baseSettlingTime = 50;
  private readonly maxSettlingTime = 250;

  /**
   * Scan with adaptive dwell times based on signal activity
   * @param device SDR device
   * @param config Scan configuration
   * @param onProgress Progress callback
   * @param signal Abort signal
   * @returns Array of scan results
   */
  async scan(
    device: ISDRDevice,
    config: ScanConfig,
    onProgress: (result: ScanResult) => void,
    signal: AbortSignal,
  ): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    const sampleCount = config.sampleCount ?? 2048;
    const threshold = config.detectionThreshold ?? -60;

    // Generate base frequency list
    const baseFrequencies = this.generateFrequencies(config);

    // Generate adaptive steps (includes finer resolution around interesting frequencies)
    const frequencies = this.generateAdaptiveSteps(
      baseFrequencies,
      config.step,
    );

    console.info(
      `Adaptive scan: ${frequencies.length} frequencies (${baseFrequencies.length} base + refinement)`,
    );

    for (const freq of frequencies) {
      if (signal.aborted) {
        console.info("Scan aborted");
        break;
      }

      try {
        // Calculate adaptive dwell time
        const dwellTime = this.calculateDwellTime(freq);

        // Tune to frequency
        await device.setFrequency(freq);

        // Allow adaptive settling time
        await delay(dwellTime);

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

        // Update interest level based on detected power
        this.updateInterest(freq, peakPower, threshold);

        results.push(result);
        onProgress(result);
      } catch (error) {
        console.error(`Failed to scan frequency ${freq}:`, error);
      }
    }

    return results;
  }

  /**
   * Generate base frequency list
   */
  private generateFrequencies(config: ScanConfig): number[] {
    const frequencies: number[] = [];
    for (
      let freq = config.startFreq;
      freq <= config.endFreq;
      freq += config.step
    ) {
      frequencies.push(freq);
    }
    return frequencies;
  }

  /**
   * Generate adaptive steps including fine resolution around interesting frequencies
   */
  private generateAdaptiveSteps(
    baseFrequencies: number[],
    baseStep: number,
  ): number[] {
    const frequencies: number[] = [];

    for (const freq of baseFrequencies) {
      frequencies.push(freq);

      // Add finer steps around interesting frequencies
      if (this.interestingFrequencies.has(freq)) {
        const fineStep = baseStep / 4;
        for (let offset = fineStep; offset < baseStep; offset += fineStep) {
          frequencies.push(freq + offset);
        }
      }
    }

    return frequencies;
  }

  /**
   * Calculate dwell time based on frequency interest
   */
  private calculateDwellTime(freq: number): number {
    const interest = this.interestingFrequencies.get(freq) ?? 0;
    return Math.min(
      this.baseSettlingTime + interest * 200,
      this.maxSettlingTime,
    );
  }

  /**
   * Update interest level for a frequency
   */
  private updateInterest(
    freq: number,
    power: number,
    threshold: number,
  ): void {
    if (power > threshold) {
      // Normalize power above threshold to [0, 1]
      const normalized = Math.min((power - threshold) / 30, 1);
      this.interestingFrequencies.set(freq, normalized);
    }
  }

  /**
   * Reset learned interest data
   */
  reset(): void {
    this.interestingFrequencies.clear();
  }
}
