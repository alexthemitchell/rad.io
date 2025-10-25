/**
 * Scanning Types and Interfaces
 * Implements ADR-0014: Automatic Frequency Scanning
 *
 * Common types used across scanning implementations
 */

import type { ClassifiedSignal } from "../detection/signal-classifier";

/**
 * Scan strategy types
 */
export type ScanStrategy = "linear" | "adaptive" | "priority";

/**
 * Scan configuration
 */
export interface ScanConfig {
  /** Starting frequency in Hz */
  startFreq: number;
  /** Ending frequency in Hz */
  endFreq: number;
  /** Frequency step size in Hz */
  step: number;
  /** Scan strategy to use */
  strategy: ScanStrategy;
  /** Device settling time in ms */
  settlingTime?: number;
  /** Sample count per frequency */
  sampleCount?: number;
  /** Priority frequencies to scan first */
  priorityFrequencies?: number[];
  /** Signal detection threshold in dB */
  detectionThreshold?: number;
}

/**
 * Scan result for a single frequency
 */
export interface ScanResult {
  /** Frequency in Hz */
  frequency: number;
  /** Timestamp of scan */
  timestamp: number;
  /** Power spectrum */
  powerSpectrum: Float32Array;
  /** Peak power in dB */
  peakPower: number;
  /** Average power in dB */
  avgPower: number;
  /** Detected signals at this frequency */
  signals?: ClassifiedSignal[];
}

/**
 * Scan progress event
 */
export interface ScanProgress {
  /** Scan ID */
  scanId: string;
  /** Current frequency being scanned */
  currentFreq: number;
  /** Total frequencies to scan */
  totalFreqs: number;
  /** Frequencies scanned so far */
  scannedFreqs: number;
  /** Progress percentage 0-100 */
  progress: number;
  /** Latest scan result */
  result?: ScanResult;
}

/**
 * Scan completion event
 */
export interface ScanComplete {
  /** Scan ID */
  scanId: string;
  /** All scan results */
  results: ScanResult[];
  /** Total time in ms */
  totalTime: number;
  /** Frequencies with detected signals */
  activeFrequencies: number[];
}

/**
 * Scanner interface that all strategies must implement
 */
export interface IScanner {
  /**
   * Scan a frequency range
   * @param device SDR device to use
   * @param config Scan configuration
   * @param onProgress Progress callback
   * @param signal Abort signal for cancellation
   */
  scan(
    device: any, // SDRDevice type from models
    config: ScanConfig,
    onProgress: (result: ScanResult) => void,
    signal: AbortSignal,
  ): Promise<ScanResult[]>;
}
