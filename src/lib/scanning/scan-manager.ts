/**
 * Scan Manager
 * Implements ADR-0014: Automatic Frequency Scanning
 *
 * Coordinates scanning operations with multiple strategies
 */

import { DetectionManager } from "../detection/detection-manager";
import { getSampleRate, type ISDRDevice } from "../utils/device-utils";
import { AdaptiveScanner } from "./adaptive-scanner";
import { LinearScanner } from "./linear-scanner";
import { PriorityScanner } from "./priority-scanner";
import type {
  ScanConfig,
  ScanResult,
  ScanProgress,
  ScanComplete,
  IScanner,
} from "./types";

/**
 * Active scan state
 */
interface ActiveScan {
  id: string;
  config: ScanConfig;
  controller: AbortController;
  results: ScanResult[];
  startTime: number;
  totalFreqs: number;
  scannedFreqs: number;
}

/**
 * Manages frequency scanning operations
 */
export class ScanManager {
  private activeScans = new Map<string, ActiveScan>();
  private detectionManager?: DetectionManager;
  private scanIdCounter = 0;

  /**
   * Initialize with optional detection integration
   * @param enableDetection Enable signal detection during scans
   */
  initialize(enableDetection = false): void {
    if (enableDetection) {
      this.detectionManager = new DetectionManager();
      this.detectionManager.initialize();
    }
  }

  /**
   * Start a new scan
   * @param config Scan configuration
   * @param device SDR device
   * @returns Scan ID for tracking
   */
  startScan(config: ScanConfig, device: ISDRDevice): string {
    const scanId = `scan-${++this.scanIdCounter}`;
    const controller = new AbortController();

    // Calculate total frequencies
    const totalFreqs = Math.ceil(
      (config.endFreq - config.startFreq) / config.step,
    );

    const scan: ActiveScan = {
      id: scanId,
      config,
      controller,
      results: [],
      startTime: Date.now(),
      totalFreqs,
      scannedFreqs: 0,
    };

    this.activeScans.set(scanId, scan);

    // Run scan in background
    this.runScan(scanId, config, device, controller.signal).catch(
      (error: unknown) => {
        if (!controller.signal.aborted) {
          console.error("Scan error:", error);
          this.emitError(scanId, error);
        }
      },
    );

    return scanId;
  }

  /**
   * Stop an active scan
   * @param scanId Scan ID to stop
   */
  stopScan(scanId: string): void {
    const scan = this.activeScans.get(scanId);
    if (scan) {
      scan.controller.abort();
      this.activeScans.delete(scanId);
      console.info(`Scan ${scanId} stopped`);
    }
  }

  /**
   * Get results for a scan
   * @param scanId Scan ID
   * @returns Scan results or empty array
   */
  getResults(scanId: string): ScanResult[] {
    return this.activeScans.get(scanId)?.results ?? [];
  }

  /**
   * Get active scan IDs
   */
  getActiveScans(): string[] {
    return Array.from(this.activeScans.keys());
  }

  /**
   * Check if a scan is active
   */
  isScanning(scanId: string): boolean {
    return this.activeScans.has(scanId);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Stop all active scans
    for (const scanId of this.activeScans.keys()) {
      this.stopScan(scanId);
    }

    // Clean up detection manager
    if (this.detectionManager) {
      this.detectionManager.destroy();
    }
  }

  /**
   * Run a scan with the configured strategy
   */
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  private async runScan(
    scanId: string,
    config: ScanConfig,
    device: ISDRDevice,
    signal: AbortSignal,
  ): Promise<void> {
    const scan = this.activeScans.get(scanId);
    if (!scan) {
      return;
    }

    // Create scanner based on strategy
    const scanner = this.createScanner(config.strategy);

    // Capture device sample rate for use in callback
    const deviceSampleRate = getSampleRate(device);

    try {
      // Run scan with progress tracking
      const results = await scanner.scan(
        device,
        config,
        (result) => {
          if (signal.aborted) {
            return;
          }

          // Store result
          scan.results.push(result);
          scan.scannedFreqs++;

          // Detect signals if enabled
          if (this.detectionManager) {
            if (result.powerSpectrum) {
              this.detectionManager.detectSignals(
                result.powerSpectrum,
                deviceSampleRate,
                result.frequency,
                {
                  thresholdDB: config.detectionThreshold,
                },
              );
            }
          }

          // Emit progress
          this.emitProgress(scanId, result);
        },
        signal,
      );

      // Scan complete
      if (!signal.aborted) {
        this.emitComplete(scanId, results);
        this.activeScans.delete(scanId);
      }
    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }
    }
  }
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  /**
   * Create scanner based on strategy
   */
  private createScanner(strategy: string): IScanner {
    switch (strategy) {
      case "linear":
        return new LinearScanner();
      case "adaptive":
        return new AdaptiveScanner();
      case "priority":
        return new PriorityScanner();
      default:
        console.warn(`Unknown strategy: ${strategy}, using linear`);
        return new LinearScanner();
    }
  }

  /**
   * Emit progress event
   */
  private emitProgress(scanId: string, result: ScanResult): void {
    const scan = this.activeScans.get(scanId);
    if (!scan) {
      return;
    }

    const progress: ScanProgress = {
      scanId,
      currentFreq: result.frequency,
      totalFreqs: scan.totalFreqs,
      scannedFreqs: scan.scannedFreqs,
      progress: (scan.scannedFreqs / scan.totalFreqs) * 100,
      result,
    };

    window.dispatchEvent(
      new CustomEvent("scan:progress", { detail: progress }),
    );
  }

  /**
   * Emit completion event
   */
  private emitComplete(scanId: string, results: ScanResult[]): void {
    const scan = this.activeScans.get(scanId);
    if (!scan) {
      return;
    }

    const totalTime = Date.now() - scan.startTime;

    // Find active frequencies (above threshold)
    const threshold = scan.config.detectionThreshold ?? -60;
    const activeFrequencies = results
      .filter((r) => r.peakPower > threshold)
      .map((r) => r.frequency);

    const complete: ScanComplete = {
      scanId,
      results,
      totalTime,
      activeFrequencies,
    };

    window.dispatchEvent(
      new CustomEvent("scan:complete", { detail: complete }),
    );
  }

  /**
   * Emit error event
   */
  private emitError(scanId: string, error: unknown): void {
    window.dispatchEvent(
      new CustomEvent("scan:error", {
        detail: {
          scanId,
          error: error instanceof Error ? error.message : String(error),
        },
      }),
    );
  }
}

// Export singleton instance
export const scanManager = new ScanManager();
