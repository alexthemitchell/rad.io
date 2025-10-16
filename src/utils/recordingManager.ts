/**
 * Recording Manager
 *
 * Manages recording of IQ samples from SDR devices with metadata tracking.
 * Supports exporting recordings in a portable JSON format for later playback.
 *
 * Recording Format:
 * {
 *   metadata: {
 *     version: string,
 *     timestamp: string,
 *     frequency: number,
 *     sampleRate: number,
 *     duration: number,
 *     sampleCount: number
 *   },
 *   samples: Array<{I: number, Q: number}>
 * }
 *
 * @module recordingManager
 */

import type { IQSample } from "../models/SDRDevice";

/**
 * Recording metadata
 */
export type RecordingMetadata = {
  /** Recording format version */
  version: string;
  /** ISO timestamp when recording started */
  timestamp: string;
  /** Center frequency in Hz */
  frequency: number;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Recording duration in seconds */
  duration: number;
  /** Total number of samples recorded */
  sampleCount: number;
  /** Optional description/notes */
  description?: string;
};

/**
 * Complete recording structure for export/import
 */
export type Recording = {
  metadata: RecordingMetadata;
  samples: IQSample[];
};

/**
 * Recording state
 */
export enum RecordingState {
  IDLE = "IDLE",
  RECORDING = "RECORDING",
  PAUSED = "PAUSED",
  STOPPED = "STOPPED",
}

/**
 * RecordingManager class for handling IQ sample recording
 */
export class RecordingManager {
  private samples: IQSample[] = [];
  private state: RecordingState = RecordingState.IDLE;
  private startTime: number | null = null;
  private frequency: number = 0;
  private sampleRate: number = 0;
  private description?: string;

  /**
   * Start a new recording
   */
  startRecording(frequency: number, sampleRate: number, description?: string): void {
    if (this.state === RecordingState.RECORDING) {
      throw new Error("Recording already in progress");
    }

    this.samples = [];
    this.state = RecordingState.RECORDING;
    this.startTime = Date.now();
    this.frequency = frequency;
    this.sampleRate = sampleRate;
    this.description = description;
  }

  /**
   * Stop the current recording
   */
  stopRecording(): void {
    if (this.state !== RecordingState.RECORDING) {
      throw new Error("No recording in progress");
    }

    this.state = RecordingState.STOPPED;
  }

  /**
   * Add IQ samples to the current recording
   */
  addSamples(samples: IQSample[]): void {
    if (this.state !== RecordingState.RECORDING) {
      return; // Silently ignore if not recording
    }

    this.samples.push(...samples);
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Get current recording duration in seconds
   */
  getDuration(): number {
    if (!this.startTime) {
      return 0;
    }

    if (this.state === RecordingState.RECORDING) {
      return (Date.now() - this.startTime) / 1000;
    }

    // For stopped recordings, calculate from sample count
    return this.samples.length / this.sampleRate;
  }

  /**
   * Get current sample count
   */
  getSampleCount(): number {
    return this.samples.length;
  }

  /**
   * Export recording as JSON
   */
  exportRecording(): Recording {
    if (this.state === RecordingState.IDLE) {
      throw new Error("No recording to export");
    }

    const metadata: RecordingMetadata = {
      version: "1.0",
      timestamp: new Date(this.startTime || Date.now()).toISOString(),
      frequency: this.frequency,
      sampleRate: this.sampleRate,
      duration: this.getDuration(),
      sampleCount: this.samples.length,
      description: this.description,
    };

    return {
      metadata,
      samples: this.samples,
    };
  }

  /**
   * Export recording as JSON string for download
   */
  exportAsJSON(): string {
    const recording = this.exportRecording();
    return JSON.stringify(recording, null, 2);
  }

  /**
   * Export recording as a downloadable blob
   */
  exportAsBlob(): Blob {
    const json = this.exportAsJSON();
    return new Blob([json], { type: "application/json" });
  }

  /**
   * Reset the recording manager
   */
  reset(): void {
    this.samples = [];
    this.state = RecordingState.IDLE;
    this.startTime = null;
    this.frequency = 0;
    this.sampleRate = 0;
    this.description = undefined;
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.state === RecordingState.RECORDING;
  }
}
