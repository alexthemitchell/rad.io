/**
 * IndexedDB Storage Layer for IQ Recordings
 *
 * Handles low-level database operations for storing and retrieving
 * IQ recordings with chunked writes for large files.
 */

import {
  DB_CONFIG,
  type RecordingEntry,
  type RecordingMeta,
  type StorageUsage,
} from "./types";

/**
 * Recording storage class for IndexedDB operations
 */
export class RecordingStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    // Return existing initialization promise if already in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.db) {
      return Promise.resolve();
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

      request.onerror = (): void => {
        reject(
          new Error(
            `Failed to open database: ${request.error?.message ?? "Unknown error"}`,
          ),
        );
      };

      request.onsuccess = (): void => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event): void => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create recordings object store
        if (!db.objectStoreNames.contains(DB_CONFIG.stores.recordings)) {
          const recordingsStore = db.createObjectStore(
            DB_CONFIG.stores.recordings,
            { keyPath: "id" },
          );
          recordingsStore.createIndex("timestamp", "metadata.timestamp", {
            unique: false,
          });
          recordingsStore.createIndex("frequency", "metadata.frequency", {
            unique: false,
          });
        }

        // Create metadata object store for quick queries
        if (!db.objectStoreNames.contains(DB_CONFIG.stores.meta)) {
          const metaStore = db.createObjectStore(DB_CONFIG.stores.meta, {
            keyPath: "id",
          });
          metaStore.createIndex("timestamp", "timestamp", { unique: false });
          metaStore.createIndex("frequency", "frequency", { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Ensure database is initialized before operations
   */
  private async ensureInit(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error("Database initialization failed");
    }
    return this.db;
  }

  /**
   * Save a recording to IndexedDB
   */
  async saveRecording(entry: RecordingEntry): Promise<void> {
    const db = await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.stores.recordings, DB_CONFIG.stores.meta],
        "readwrite",
      );

      transaction.onerror = (): void => {
        reject(
          new Error(
            `Transaction failed: ${transaction.error?.message ?? "Unknown error"}`,
          ),
        );
      };

      transaction.oncomplete = (): void => {
        resolve();
      };

      // Save full recording
      const recordingsStore = transaction.objectStore(
        DB_CONFIG.stores.recordings,
      );
      recordingsStore.add(entry);

      // Calculate total size
      const totalSize = entry.chunks.reduce(
        (sum, chunk) => sum + chunk.size,
        0,
      );

      // Save metadata for quick queries
      const metaStore = transaction.objectStore(DB_CONFIG.stores.meta);
      const meta: RecordingMeta = {
        id: entry.id,
        frequency: entry.metadata.frequency,
        timestamp: entry.metadata.timestamp,
        duration: entry.metadata.duration,
        size: totalSize,
        label: entry.metadata.label,
      };
      metaStore.add(meta);
    });
  }

  /**
   * Load a recording by ID
   */
  async loadRecording(id: string): Promise<RecordingEntry | undefined> {
    const db = await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.stores.recordings],
        "readonly",
      );
      const store = transaction.objectStore(DB_CONFIG.stores.recordings);
      const request = store.get(id);

      request.onerror = (): void => {
        reject(
          new Error(
            `Failed to load recording: ${request.error?.message ?? "Unknown error"}`,
          ),
        );
      };

      request.onsuccess = (): void => {
        resolve(request.result as RecordingEntry | undefined);
      };
    });
  }

  /**
   * List all recordings (metadata only)
   */
  async listRecordings(): Promise<RecordingMeta[]> {
    const db = await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([DB_CONFIG.stores.meta], "readonly");
      const store = transaction.objectStore(DB_CONFIG.stores.meta);
      const request = store.getAll();

      request.onerror = (): void => {
        reject(
          new Error(
            `Failed to list recordings: ${request.error?.message ?? "Unknown error"}`,
          ),
        );
      };

      request.onsuccess = (): void => {
        const results = request.result as RecordingMeta[];
        // Sort by timestamp (newest first)
        results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        resolve(results);
      };
    });
  }

  /**
   * Delete a recording by ID
   */
  async deleteRecording(id: string): Promise<void> {
    const db = await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.stores.recordings, DB_CONFIG.stores.meta],
        "readwrite",
      );

      transaction.onerror = (): void => {
        reject(
          new Error(
            `Failed to delete recording: ${transaction.error?.message ?? "Unknown error"}`,
          ),
        );
      };

      transaction.oncomplete = (): void => {
        resolve();
      };

      // Delete from both stores
      const recordingsStore = transaction.objectStore(
        DB_CONFIG.stores.recordings,
      );
      recordingsStore.delete(id);

      const metaStore = transaction.objectStore(DB_CONFIG.stores.meta);
      metaStore.delete(id);
    });
  }

  /**
   * Get storage usage information
   */
  async getStorageUsage(): Promise<StorageUsage> {
    // Check if Storage API is available (needed for test environments)
    /* eslint-disable @typescript-eslint/no-unnecessary-condition */
    if (
      !navigator.storage ||
      typeof navigator.storage.estimate !== "function"
    ) {
      return {
        used: 0,
        quota: 0,
        percent: 0,
      };
    }
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */

    const estimate = await navigator.storage.estimate();
    const used = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    const percent = quota > 0 ? (used / quota) * 100 : 0;

    return {
      used,
      quota,
      percent,
    };
  }

  /**
   * Check if enough storage is available
   */
  async hasAvailableSpace(requiredBytes: number): Promise<boolean> {
    const usage = await this.getStorageUsage();
    const available = usage.quota - usage.used;
    // Use 90% threshold to provide buffer
    return (
      available > requiredBytes &&
      usage.used + requiredBytes < usage.quota * 0.9
    );
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

/**
 * Singleton instance for easy access
 */
export const recordingStorage = new RecordingStorage();
