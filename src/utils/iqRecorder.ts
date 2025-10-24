/**
 * IQ Data Recorder and Playback Utilities
 *
 * Provides functionality to record, save, load, and playback IQ sample data
 * from SDR receivers. Supports both binary (.iq) and JSON (.json) formats.
 */

import { type IQSample } from "../models/SDRDevice";

/**
 * Metadata for recorded IQ data
 */
export type IQRecordingMetadata = {
  /** Recording timestamp (ISO 8601) */
  timestamp: string;
  /** Center frequency in Hz */
  frequency: number;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Signal type (FM, AM, etc.) */
  signalType?: string;
  /** Device name/model */
  deviceName?: string;
  /** Total number of IQ samples */
  sampleCount: number;
  /** Recording duration in seconds */
  duration: number;
};

/**
 * Container for IQ recording with metadata
 */
export type IQRecording = {
  metadata: IQRecordingMetadata;
  samples: IQSample[];
};

/**
 * IQ Recorder class for capturing and managing IQ sample data
 */
export class IQRecorder {
  private samples: IQSample[] = [];
  private isRecording = false;
  private startTime: number | null = null;
  private sampleRate: number;
  private frequency: number;
  private signalType?: string;
  private deviceName?: string;
  private maxSamples: number;

  /**
   * Creates a new IQ recorder
   * @param sampleRate - Sample rate in Hz
   * @param frequency - Center frequency in Hz
   * @param maxSamples - Maximum samples to buffer (default: 10 million = ~5s at 2 MSPS)
   * @param signalType - Optional signal type (FM, AM, etc.)
   * @param deviceName - Optional device name
   */
  constructor(
    sampleRate: number,
    frequency: number,
    maxSamples = 10_000_000,
    signalType?: string,
    deviceName?: string,
  ) {
    this.sampleRate = sampleRate;
    this.frequency = frequency;
    this.maxSamples = maxSamples;
    this.signalType = signalType;
    this.deviceName = deviceName;
  }

  /**
   * Start recording IQ samples
   */
  start(): void {
    this.samples = [];
    this.isRecording = true;
    this.startTime = Date.now();
  }

  /**
   * Stop recording IQ samples
   */
  stop(): void {
    this.isRecording = false;
  }

  /**
   * Add IQ samples to the recording buffer
   * @param newSamples - Array of IQ samples to add
   * @returns true if samples were added, false if recording stopped due to buffer limit
   */
  addSamples(newSamples: IQSample[]): boolean {
    if (!this.isRecording) {
      return false;
    }

    // Check if adding these samples would exceed the limit
    if (this.samples.length + newSamples.length > this.maxSamples) {
      // Add only up to the limit
      const remainingSpace = this.maxSamples - this.samples.length;
      if (remainingSpace > 0) {
        this.samples.push(...newSamples.slice(0, remainingSpace));
      }
      this.stop();
      return false;
    }

    this.samples.push(...newSamples);
    return true;
  }

  /**
   * Get recording status
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current sample count
   */
  getSampleCount(): number {
    return this.samples.length;
  }

  /**
   * Get recording duration in seconds
   */
  getDuration(): number {
    if (this.samples.length === 0 || this.sampleRate === 0) {
      return 0;
    }
    return this.samples.length / this.sampleRate;
  }

  /**
   * Clear recorded samples
   */
  clear(): void {
    this.samples = [];
    this.isRecording = false;
    this.startTime = null;
  }

  /**
   * Get the complete recording with metadata
   */
  getRecording(): IQRecording {
    const metadata: IQRecordingMetadata = {
      timestamp: this.startTime
        ? new Date(this.startTime).toISOString()
        : new Date().toISOString(),
      frequency: this.frequency,
      sampleRate: this.sampleRate,
      signalType: this.signalType,
      deviceName: this.deviceName,
      sampleCount: this.samples.length,
      duration: this.getDuration(),
    };

    return {
      metadata,
      samples: [...this.samples], // Return copy to prevent external modification
    };
  }

  /**
   * Update recording parameters (frequency, sample rate, etc.)
   */
  updateParameters(params: {
    frequency?: number;
    sampleRate?: number;
    signalType?: string;
    deviceName?: string;
  }): void {
    if (params.frequency !== undefined) {
      this.frequency = params.frequency;
    }
    if (params.sampleRate !== undefined) {
      this.sampleRate = params.sampleRate;
    }
    if (params.signalType !== undefined) {
      this.signalType = params.signalType;
    }
    if (params.deviceName !== undefined) {
      this.deviceName = params.deviceName;
    }
  }
}

/**
 * Export IQ recording to JSON format (human-readable, larger file size)
 */
export function exportToJSON(recording: IQRecording): string {
  return JSON.stringify(recording, null, 2);
}

/**
 * Export IQ recording to binary format (.iq file)
 * Format: metadata JSON length (4 bytes) + metadata JSON + I/Q float32 pairs
 */
export function exportToBinary(recording: IQRecording): ArrayBuffer {
  // Serialize metadata to JSON
  const metadataJSON = JSON.stringify(recording.metadata);
  const metadataBytes = new TextEncoder().encode(metadataJSON);
  const metadataLength = metadataBytes.length;

  // Calculate total size: 4 bytes (length) + metadata + samples
  const sampleDataSize = recording.samples.length * 2 * 4; // 2 floats per sample, 4 bytes each
  const totalSize = 4 + metadataLength + sampleDataSize;

  // Create buffer
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);

  // Write metadata length (4 bytes, little-endian)
  view.setUint32(0, metadataLength, true);

  // Write metadata JSON
  uint8View.set(metadataBytes, 4);

  // Write IQ samples as Float32 pairs
  const sampleOffset = 4 + metadataLength;
  for (let i = 0; i < recording.samples.length; i++) {
    const sample = recording.samples[i];
    if (!sample) {
      continue;
    }
    const offset = sampleOffset + i * 8; // 8 bytes per sample (2 floats)
    view.setFloat32(offset, sample.I, true);
    view.setFloat32(offset + 4, sample.Q, true);
  }

  return buffer;
}

/**
 * Import IQ recording from JSON string
 */
export function importFromJSON(jsonString: string): IQRecording {
  const parsed = JSON.parse(jsonString) as unknown;

  // Validate structure
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("metadata" in parsed) ||
    !("samples" in parsed) ||
    !Array.isArray(parsed.samples)
  ) {
    throw new Error("Invalid IQ recording JSON format");
  }

  // Validate metadata
  const metadata = parsed.metadata as IQRecordingMetadata;
  if (
    typeof metadata.frequency !== "number" ||
    typeof metadata.sampleRate !== "number" ||
    typeof metadata.sampleCount !== "number"
  ) {
    throw new Error("Invalid metadata in IQ recording");
  }

  // Validate samples
  const samples = parsed.samples as IQSample[];
  if (samples.length !== metadata.sampleCount) {
    console.warn(
      `Sample count mismatch: expected ${metadata.sampleCount}, got ${samples.length}`,
    );
  }

  return { metadata, samples };
}

/**
 * Import IQ recording from binary format (.iq file)
 */
export function importFromBinary(buffer: ArrayBuffer): IQRecording {
  const view = new DataView(buffer);

  // Read metadata length
  const metadataLength = view.getUint32(0, true);

  // Read metadata JSON
  const metadataBytes = new Uint8Array(buffer, 4, metadataLength);
  const metadataJSON = new TextDecoder().decode(metadataBytes);
  const metadata = JSON.parse(metadataJSON) as IQRecordingMetadata;

  // Read IQ samples
  const sampleOffset = 4 + metadataLength;
  const sampleDataSize = buffer.byteLength - sampleOffset;
  const sampleCount = sampleDataSize / 8; // 8 bytes per sample (2 float32s)

  const samples: IQSample[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const offset = sampleOffset + i * 8;
    samples.push({
      I: view.getFloat32(offset, true),
      Q: view.getFloat32(offset + 4, true),
    });
  }

  // Validate sample count
  if (samples.length !== metadata.sampleCount) {
    console.warn(
      `Sample count mismatch: expected ${metadata.sampleCount}, got ${samples.length}`,
    );
  }

  return { metadata, samples };
}

/**
 * Download recording as a file
 */
export function downloadRecording(
  recording: IQRecording,
  filename: string,
  format: "json" | "binary" = "binary",
): void {
  let blob: Blob;
  let downloadFilename = filename;

  if (format === "json") {
    const jsonData = exportToJSON(recording);
    blob = new Blob([jsonData], { type: "application/json" });
    if (!downloadFilename.endsWith(".json")) {
      downloadFilename += ".json";
    }
  } else {
    const binaryData = exportToBinary(recording);
    blob = new Blob([binaryData], { type: "application/octet-stream" });
    if (!downloadFilename.endsWith(".iq")) {
      downloadFilename += ".iq";
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Load recording from a File object
 */
export async function loadRecordingFromFile(file: File): Promise<IQRecording> {
  const buffer = await file.arrayBuffer();

  // Detect format by file extension or content
  if (file.name.endsWith(".json")) {
    const text = new TextDecoder().decode(buffer);
    return importFromJSON(text);
  } else if (file.name.endsWith(".iq")) {
    return importFromBinary(buffer);
  } else {
    // Try to detect format by checking if it starts with '{'
    const firstByte = new Uint8Array(buffer)[0];
    if (firstByte === 0x7b) {
      // '{' character
      const text = new TextDecoder().decode(buffer);
      return importFromJSON(text);
    } else {
      return importFromBinary(buffer);
    }
  }
}

/**
 * Playback controller for recorded IQ data
 */
export class IQPlayback {
  private recording: IQRecording;
  private isPlaying = false;
  private currentIndex = 0;
  private intervalId: number | null = null;
  private samplesPerChunk: number;
  private chunkIntervalMs: number;
  private onChunk: (samples: IQSample[]) => void;

  /**
   * Creates a playback controller
   * @param recording - The IQ recording to play back
   * @param onChunk - Callback for each chunk of samples
   * @param samplesPerChunk - Number of samples per chunk (default: 32768)
   */
  constructor(
    recording: IQRecording,
    onChunk: (samples: IQSample[]) => void,
    samplesPerChunk = 32768,
  ) {
    this.recording = recording;
    this.onChunk = onChunk;
    this.samplesPerChunk = samplesPerChunk;

    // Calculate chunk interval based on sample rate
    // Time per chunk = samples / sample_rate
    this.chunkIntervalMs =
      (samplesPerChunk / recording.metadata.sampleRate) * 1000;
  }

  /**
   * Start playback
   */
  start(): void {
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    this.currentIndex = 0;

    // Use setInterval for consistent timing
    this.intervalId = window.setInterval(() => {
      if (!this.isPlaying) {
        return;
      }

      const chunk = this.recording.samples.slice(
        this.currentIndex,
        this.currentIndex + this.samplesPerChunk,
      );

      if (chunk.length === 0) {
        // End of recording
        this.stop();
        return;
      }

      this.currentIndex += chunk.length;
      this.onChunk(chunk);
    }, this.chunkIntervalMs);
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this.pause();
    this.currentIndex = 0;
  }

  /**
   * Get playback status
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get current playback position (0-1)
   */
  getProgress(): number {
    if (this.recording.samples.length === 0) {
      return 0;
    }
    return this.currentIndex / this.recording.samples.length;
  }

  /**
   * Get current playback time in seconds
   */
  getCurrentTime(): number {
    return this.currentIndex / this.recording.metadata.sampleRate;
  }

  /**
   * Seek to a specific position (0-1)
   */
  seek(position: number): void {
    const clampedPosition = Math.max(0, Math.min(1, position));
    this.currentIndex = Math.floor(
      clampedPosition * this.recording.samples.length,
    );
  }

  /**
   * Get recording metadata
   */
  getMetadata(): IQRecordingMetadata {
    return this.recording.metadata;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stop();
  }
}
