/**
 * Recording Manager - High-level API for IQ Recording Storage
 *
 * Provides a user-friendly API for saving, loading, and managing
 * IQ recordings with automatic chunking and quota management.
 */

import { recordingStorage } from "./recording-storage";
import {
  DB_CONFIG,
  type IQRecording,
  type RecordingEntry,
  type RecordingMeta,
  type RecordingMetadata,
  type StorageUsage,
} from "./types";
import type { IQSample } from "../../models/SDRDevice";
import type { IQRecording as UtilsIQRecording } from "../../utils/iqRecorder";

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Convert IQ samples to chunked Blobs
 */
function chunkSamples(samples: IQSample[]): Blob[] {
  const chunks: Blob[] = [];
  const bytesPerSample = 8; // 2 float32s (I and Q)
  const samplesPerChunk = Math.floor(DB_CONFIG.chunkSize / bytesPerSample);

  for (let i = 0; i < samples.length; i += samplesPerChunk) {
    const chunkSamples = samples.slice(i, i + samplesPerChunk);
    const buffer = new ArrayBuffer(chunkSamples.length * bytesPerSample);
    const view = new DataView(buffer);

    for (let j = 0; j < chunkSamples.length; j++) {
      const sample = chunkSamples[j];
      if (!sample) continue;
      const offset = j * bytesPerSample;
      view.setFloat32(offset, sample.I, true);
      view.setFloat32(offset + 4, sample.Q, true);
    }

    chunks.push(new Blob([buffer], { type: "application/octet-stream" }));
  }

  return chunks;
}

/**
 * Convert chunked Blobs back to IQ samples
 */
async function unchunkSamples(chunks: Blob[]): Promise<IQSample[]> {
  const samples: IQSample[] = [];

  for (const chunk of chunks) {
    const buffer = await chunk.arrayBuffer();
    const view = new DataView(buffer);
    const sampleCount = buffer.byteLength / 8; // 8 bytes per sample

    for (let i = 0; i < sampleCount; i++) {
      const offset = i * 8;
      samples.push({
        I: view.getFloat32(offset, true),
        Q: view.getFloat32(offset + 4, true),
      });
    }
  }

  return samples;
}

/**
 * Recording Manager class
 */
export class RecordingManager {
  /**
   * Initialize the recording storage
   */
  async init(): Promise<void> {
    await recordingStorage.init();
  }

  /**
   * Save a recording to IndexedDB
   * @param recording - Recording from IQRecorder
   * @returns Recording ID
   */
  async saveRecording(recording: UtilsIQRecording): Promise<string> {
    // Generate unique ID
    const id = generateUUID();

    // Check available storage
    const estimatedSize = recording.samples.length * 8; // 8 bytes per sample
    const hasSpace = await recordingStorage.hasAvailableSpace(estimatedSize);

    if (!hasSpace) {
      const usage = await recordingStorage.getStorageUsage();
      throw new Error(
        `Insufficient storage: need ${(estimatedSize / 1024 / 1024).toFixed(1)} MB, ` +
          `have ${((usage.quota - usage.used) / 1024 / 1024).toFixed(1)} MB available`,
      );
    }

    // Convert to chunked format
    const chunks = chunkSamples(recording.samples);

    // Create entry
    const entry: RecordingEntry = {
      id,
      metadata: {
        frequency: recording.metadata.frequency,
        sampleRate: recording.metadata.sampleRate,
        timestamp: new Date(recording.metadata.timestamp),
        duration: recording.metadata.duration,
        deviceName: recording.metadata.deviceName,
        tags: [],
        label: recording.metadata.signalType,
      },
      chunks,
    };

    // Save to IndexedDB
    await recordingStorage.saveRecording(entry);

    return id;
  }

  /**
   * Load a recording by ID
   * @param id - Recording ID
   * @returns Recording with samples
   */
  async loadRecording(id: string): Promise<IQRecording> {
    const entry = await recordingStorage.loadRecording(id);

    if (!entry) {
      throw new Error(`Recording not found: ${id}`);
    }

    // Convert chunks back to samples
    const samples = await unchunkSamples(entry.chunks);

    return {
      id: entry.id,
      metadata: entry.metadata,
      samples,
    };
  }

  /**
   * Delete a recording by ID
   * @param id - Recording ID
   */
  async deleteRecording(id: string): Promise<void> {
    await recordingStorage.deleteRecording(id);
  }

  /**
   * List all recordings (metadata only)
   * @returns Array of recording metadata
   */
  async listRecordings(): Promise<RecordingMeta[]> {
    return recordingStorage.listRecordings();
  }

  /**
   * Get storage usage information
   * @returns Storage usage details
   */
  async getStorageUsage(): Promise<StorageUsage> {
    return recordingStorage.getStorageUsage();
  }

  /**
   * Update recording metadata
   * @param id - Recording ID
   * @param updates - Partial metadata updates
   */
  async updateMetadata(
    id: string,
    updates: Partial<RecordingMetadata>,
  ): Promise<void> {
    const entry = await recordingStorage.loadRecording(id);

    if (!entry) {
      throw new Error(`Recording not found: ${id}`);
    }

    // Update metadata
    Object.assign(entry.metadata, updates);

    // Delete old entry
    await recordingStorage.deleteRecording(id);

    // Save updated entry
    await recordingStorage.saveRecording(entry);
  }

  /**
   * Close the database connection
   */
  close(): void {
    recordingStorage.close();
  }
}

/**
 * Singleton instance for easy access
 */
export const recordingManager = new RecordingManager();
