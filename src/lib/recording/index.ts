/**
 * Recording Library - Public API
 *
 * Exports the recording manager and related types for persistent
 * storage of IQ recordings using IndexedDB.
 */

export { RecordingManager, recordingManager } from "./recording-manager";
export { RecordingStorage, recordingStorage } from "./recording-storage";
export type {
  RecordingMetadata,
  RecordingEntry,
  RecordingMeta,
  StorageUsage,
  IQRecording,
} from "./types";
export { DB_CONFIG } from "./types";
