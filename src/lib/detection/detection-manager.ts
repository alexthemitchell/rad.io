/**
 * Detection Manager
 * Implements ADR-0013: Automatic Signal Detection System
 *
 * Coordinates signal detection using worker-based processing
 */

import type { ClassifiedSignal } from "./signal-classifier";

/**
 * Detection configuration options
 */
export interface DetectionConfig {
  /** Threshold above noise floor in dB */
  thresholdDB?: number;
  /** Minimum signal bandwidth in Hz */
  minBandwidth?: number;
  /** Maximum signal bandwidth in Hz */
  maxBandwidth?: number;
  /** Enable signal classification */
  enableClassification?: boolean;
}

/**
 * Detection result from worker
 */
export interface DetectionResult {
  /** Request ID */
  id: string;
  /** Detected and classified signals */
  signals: ClassifiedSignal[];
  /** Estimated noise floor in dB */
  noiseFloor: number;
  /** Processing time in ms */
  processingTime: number;
}

/**
 * Manages signal detection operations
 */
export class DetectionManager {
  private worker: Worker | null = null;
  private onSignalsDetected?: (signals: ClassifiedSignal[]) => void;
  private onNoiseFloorUpdated?: (noiseFloor: number) => void;
  private requestId = 0;

  /**
   * Initialize the detection worker
   */
  async initialize(): Promise<void> {
    if (this.worker) {
      return;
    }

    // Create worker for detection processing
    this.worker = new Worker(
      new URL("../../workers/detection-worker.ts", import.meta.url),
      { type: "module" },
    );

    this.worker.onmessage = (event) => {
      const result: DetectionResult = event.data;

      if (this.onSignalsDetected) {
        this.onSignalsDetected(result.signals);
      }

      if (this.onNoiseFloorUpdated) {
        this.onNoiseFloorUpdated(result.noiseFloor);
      }
    };

    this.worker.onerror = (error) => {
      console.error("Detection worker error:", error);
    };
  }

  /**
   * Detect signals in a spectrum
   * @param spectrum Power spectrum in dB
   * @param sampleRate Sample rate in Hz
   * @param centerFreq Center frequency in Hz
   * @param config Detection configuration
   */
  detectSignals(
    spectrum: Float32Array,
    sampleRate: number,
    centerFreq: number,
    config: DetectionConfig = {},
  ): void {
    if (!this.worker) {
      console.warn("Detection worker not initialized");
      return;
    }

    this.requestId++;

    // Transfer spectrum to worker (zero-copy)
    this.worker.postMessage(
      {
        id: `detect-${this.requestId}`,
        spectrum,
        sampleRate,
        centerFreq,
        config,
      },
      [spectrum.buffer],
    );
  }

  /**
   * Register callback for detected signals
   * @param callback Function to call when signals are detected
   */
  onDetection(callback: (signals: ClassifiedSignal[]) => void): void {
    this.onSignalsDetected = callback;
  }

  /**
   * Register callback for noise floor updates
   * @param callback Function to call when noise floor is updated
   */
  onNoiseFloor(callback: (noiseFloor: number) => void): void {
    this.onNoiseFloorUpdated = callback;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
