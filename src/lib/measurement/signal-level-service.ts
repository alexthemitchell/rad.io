/**
 * Signal Level Service
 * Phase 2 - Measurement Service & Conversion Utilities
 *
 * Periodically samples power metrics from the DSP pipeline and publishes
 * SignalLevel updates to the store.
 *
 * This service bridges the gap between low-level power measurements (dBFS)
 * and user-friendly signal strength representations (dBm, S-units).
 */

import { calculateSignalStrength } from "../dsp/analysis";
import { convertDbfsToDbm, dbmToSUnit } from "./signalMeasurement";
import type { SMeterBand, SignalLevel, SMeterCalibration } from "./types";
import type { Sample } from "../dsp/types";

/**
 * Configuration for SignalLevelService
 */
export interface SignalLevelServiceConfig {
  /** Update interval in milliseconds (default: 100ms = 10 updates/sec) */
  updateIntervalMs?: number;

  /** Calibration data for current device/settings */
  calibration: SMeterCalibration;

  /** Current operating frequency in Hz (to determine HF vs VHF band) */
  frequencyHz: number;
}

/**
 * Callback function to publish signal level updates
 */
export type SignalLevelCallback = (level: SignalLevel) => void;

/**
 * Signal Level Service
 *
 * Manages periodic sampling of signal strength and conversion to
 * multiple representations (dBFS, dBm, S-units).
 *
 * @example
 * ```typescript
 * import { SignalLevelService } from '@/lib/measurement';
 *
 * const service = new SignalLevelService({
 *   calibration: {
 *     kCal: -70,
 *     frequencyRange: { min: 88e6, max: 108e6 },
 *     method: 'default',
 *     accuracyDb: 10,
 *   },
 *   frequencyHz: 100e6,
 *   updateIntervalMs: 100,
 * });
 *
 * // Subscribe to updates
 * service.subscribe((level) => {
 *   console.log(`Signal: S${level.sUnit}+${level.overS9} dB`);
 * });
 *
 * // Start sampling
 * service.start((samples) => {
 *   // Your sample acquisition logic here
 *   return getCurrentIQSamples();
 * });
 *
 * // Later: stop sampling
 * service.stop();
 * ```
 */
export class SignalLevelService {
  private config: Required<SignalLevelServiceConfig>;
  private intervalId: null | ReturnType<typeof setInterval> = null;
  private subscribers = new Set<SignalLevelCallback>();
  private running = false;

  constructor(config: SignalLevelServiceConfig) {
    this.config = {
      updateIntervalMs: config.updateIntervalMs ?? 100,
      calibration: config.calibration,
      frequencyHz: config.frequencyHz,
    };
  }

  /**
   * Subscribe to signal level updates
   *
   * @param callback - Function to call with each update
   * @returns Unsubscribe function
   */
  subscribe(callback: SignalLevelCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Update service configuration
   *
   * Useful when frequency or calibration changes during runtime.
   *
   * @param updates - Partial configuration to update
   */
  updateConfig(updates: Partial<SignalLevelServiceConfig>): void {
    if (updates.updateIntervalMs !== undefined) {
      this.config.updateIntervalMs = updates.updateIntervalMs;

      // Restart if currently running to apply new interval
      if (this.running && this.intervalId !== null) {
        const currentProvider = this.currentSampleProvider;
        if (currentProvider) {
          this.stop();
          this.start(currentProvider);
        }
      }
    }

    if (updates.calibration !== undefined) {
      this.config.calibration = updates.calibration;
    }

    if (updates.frequencyHz !== undefined) {
      this.config.frequencyHz = updates.frequencyHz;
    }
  }

  /**
   * Determine band (HF or VHF) from frequency
   */
  private getBand(frequencyHz: number): SMeterBand {
    const BAND_THRESHOLD_HZ = 30e6; // 30 MHz
    return frequencyHz < BAND_THRESHOLD_HZ ? "HF" : "VHF";
  }

  /**
   * Calculate signal level from IQ samples
   */
  private calculateSignalLevel(samples: Sample[]): SignalLevel {
    // Step 1: Calculate dBFS from IQ samples
    // Note: calculateSignalStrength returns values in dBFS range (-100 to 0)
    // even though it's documented as "dBm" - it's actually relative to full scale
    const dBfs = calculateSignalStrength(samples);

    // Step 2: Convert dBFS to dBm using calibration constant
    const dBmApprox = convertDbfsToDbm(dBfs, this.config.calibration.kCal);

    // Step 3: Convert dBm to S-units
    const band = this.getBand(this.config.frequencyHz);
    const { sUnit, overS9 } = dbmToSUnit(dBmApprox, band);

    // Step 4: Determine calibration status
    const calibrationStatus =
      this.config.calibration.method === "signal-generator"
        ? "user"
        : this.config.calibration.method === "reference-station"
          ? "factory"
          : "uncalibrated";

    // Step 5: Return complete SignalLevel
    return {
      dBfs,
      dBmApprox,
      sUnit,
      overS9,
      band,
      calibrationStatus,
      uncertaintyDb: this.config.calibration.accuracyDb,
      timestamp: Date.now(),
    };
  }

  /**
   * Publish signal level to all subscribers
   */
  private publish(level: SignalLevel): void {
    for (const callback of this.subscribers) {
      try {
        callback(level);
      } catch (error) {
        console.error("Error in SignalLevel subscriber callback:", error);
      }
    }
  }

  // Store sample provider to allow restart with same provider
  private currentSampleProvider: (() => Sample[]) | null = null;

  /**
   * Start periodic signal level sampling
   *
   * @param sampleProvider - Function that returns current IQ samples
   */
  start(sampleProvider: () => Sample[]): void {
    if (this.running) {
      console.warn("SignalLevelService is already running");
      return;
    }

    this.currentSampleProvider = sampleProvider;
    this.running = true;

    const doSample = (): void => {
      try {
        const samples = sampleProvider();

        // Only calculate if we have samples
        if (samples.length > 0) {
          const level = this.calculateSignalLevel(samples);
          this.publish(level);
        }
      } catch (error) {
        console.error("Error sampling signal level:", error);
      }
    };

    // Do initial sample immediately
    doSample();

    // Then schedule periodic updates
    this.intervalId = setInterval(doSample, this.config.updateIntervalMs);
  }

  /**
   * Stop periodic sampling
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    if (this.intervalId !== null) {
      clearInterval(this.intervalId as number);
      this.intervalId = null;
    }

    this.running = false;
    this.currentSampleProvider = null;
  }

  /**
   * Check if service is currently running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<SignalLevelServiceConfig>> {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.subscribers.clear();
  }
}
