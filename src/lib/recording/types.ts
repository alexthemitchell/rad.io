/**
 * Type definitions for IQ Recording storage
 *
 * Defines the database schema and interfaces for persistent storage
 * of IQ recordings using IndexedDB.
 */

import type { IQSample } from "../../models/SDRDevice";

/**
 * Metadata for a recording
 */
export interface RecordingMetadata {
  /** Center frequency in Hz */
  frequency: number;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Recording timestamp (ISO 8601) */
  timestamp: Date;
  /** Recording duration in seconds */
  duration: number;
  /** Optional device name */
  deviceName?: string;
  /** User-defined tags for categorization */
  tags: string[];
  /** Optional user-defined label */
  label?: string;
}

/**
 * Complete recording entry stored in IndexedDB
 */
export interface RecordingEntry {
  /** Unique identifier (UUID) */
  id: string;
  /** Recording metadata */
  metadata: RecordingMetadata;
  /** Chunked IQ data (10MB per chunk) */
  chunks: Blob[];
}

/**
 * Lightweight metadata for quick queries (separate object store)
 */
export interface RecordingMeta {
  /** Unique identifier (UUID) */
  id: string;
  /** Center frequency in Hz */
  frequency: number;
  /** Recording timestamp */
  timestamp: Date;
  /** Recording duration in seconds */
  duration: number;
  /** Total size in bytes */
  size: number;
  /** Optional user-defined label */
  label?: string;
}

/**
 * Storage usage information
 */
export interface StorageUsage {
  /** Bytes currently used */
  used: number;
  /** Total quota in bytes */
  quota: number;
  /** Percentage used (0-100) */
  percent: number;
}

/**
 * Recording with IQ samples (runtime representation)
 */
export interface IQRecording {
  /** Unique identifier */
  id: string;
  /** Recording metadata */
  metadata: RecordingMetadata;
  /** IQ samples */
  samples: IQSample[];
}

/**
 * Database schema constants
 */
export const DB_CONFIG = {
  /** Database name */
  name: "rad-io-recordings",
  /** Current schema version */
  version: 1,
  /** Object store names */
  stores: {
    recordings: "recordings",
    meta: "recordings-meta",
  },
  /** Chunk size for large recordings (10MB) */
  chunkSize: 10 * 1024 * 1024,
} as const;
