/**
 * P25 Transmission Logging Service
 *
 * Provides persistent storage for P25 transmission records using IndexedDB.
 * Stores historical transmission data including talkgroup, source, duration,
 * and signal quality metrics.
 */

/**
 * Transmission record stored in IndexedDB
 */
export type TransmissionRecord = {
  id?: number; // Auto-incremented primary key
  timestamp: number; // Unix timestamp in milliseconds
  talkgroupId?: number;
  sourceId?: number;
  duration: number; // Duration in milliseconds
  signalQuality: number; // 0-100
  slot: number; // P25 TDMA slot (1 or 2)
  isEncrypted: boolean;
  errorRate: number; // 0-1
};

/**
 * Query options for searching transmission logs
 */
export type TransmissionQueryOptions = {
  talkgroupId?: number;
  sourceId?: number;
  startTime?: number;
  endTime?: number;
  minQuality?: number;
  limit?: number;
  offset?: number;
};

const DB_NAME = "P25TransmissionLog";
const DB_VERSION = 1;
const STORE_NAME = "transmissions";

/**
 * P25 Transmission Logger
 *
 * Manages persistent storage of P25 transmission records using IndexedDB.
 */
export class P25TransmissionLogger {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.db) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB is not supported in this browser"));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (): void => {
        reject(new Error("Failed to open IndexedDB"));
      };

      request.onsuccess = (): void => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent): void => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });

          // Create indexes for efficient querying
          objectStore.createIndex("timestamp", "timestamp", { unique: false });
          objectStore.createIndex("talkgroupId", "talkgroupId", {
            unique: false,
          });
          objectStore.createIndex("sourceId", "sourceId", { unique: false });
          objectStore.createIndex("signalQuality", "signalQuality", {
            unique: false,
          });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Log a transmission record
   */
  async logTransmission(record: TransmissionRecord): Promise<number> {
    await this.init();

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.add(record);

      request.onsuccess = (): void => {
        resolve(request.result as number);
      };

      request.onerror = (): void => {
        reject(new Error("Failed to log transmission"));
      };
    });
  }

  /**
   * Query transmission records
   */
  async queryTransmissions(
    options: TransmissionQueryOptions = {},
  ): Promise<TransmissionRecord[]> {
    await this.init();

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const objectStore = transaction.objectStore(STORE_NAME);
      const records: TransmissionRecord[] = [];

      let request: IDBRequest;

      // Use index if filtering by specific field
      if (options.talkgroupId !== undefined) {
        const index = objectStore.index("talkgroupId");
        request = index.openCursor(
          IDBKeyRange.only(options.talkgroupId),
          "prev",
        );
      } else if (options.sourceId !== undefined) {
        const index = objectStore.index("sourceId");
        request = index.openCursor(IDBKeyRange.only(options.sourceId), "prev");
      } else {
        // Get all records in reverse chronological order
        const index = objectStore.index("timestamp");
        request = index.openCursor(null, "prev");
      }

      let count = 0;
      const limit = options.limit ?? 1000;
      const offset = options.offset ?? 0;

      request.onsuccess = (event: Event): void => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (cursor) {
          const record = cursor.value as TransmissionRecord;

          // Apply filters
          let include = true;

          if (options.startTime && record.timestamp < options.startTime) {
            include = false;
          }

          if (options.endTime && record.timestamp > options.endTime) {
            include = false;
          }

          if (
            options.minQuality &&
            record.signalQuality < options.minQuality
          ) {
            include = false;
          }

          if (include) {
            if (count >= offset && records.length < limit) {
              records.push(record);
            }
            count++;
          }

          if (records.length < limit) {
            cursor.continue();
          } else {
            resolve(records);
          }
        } else {
          resolve(records);
        }
      };

      request.onerror = (): void => {
        reject(new Error("Failed to query transmissions"));
      };
    });
  }

  /**
   * Get count of transmission records
   */
  async getCount(options: TransmissionQueryOptions = {}): Promise<number> {
    await this.init();

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    // If no filters, use count directly
    if (
      !options.talkgroupId &&
      !options.sourceId &&
      !options.startTime &&
      !options.endTime &&
      !options.minQuality
    ) {
      return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const transaction = this.db!.transaction([STORE_NAME], "readonly");
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.count();

        request.onsuccess = (): void => {
          resolve(request.result);
        };

        request.onerror = (): void => {
          reject(new Error("Failed to count transmissions"));
        };
      });
    }

    // Otherwise, query and count matching records
    const records = await this.queryTransmissions({
      ...options,
      limit: Number.MAX_SAFE_INTEGER,
    });
    return records.length;
  }

  /**
   * Delete old transmission records
   */
  async deleteOlderThan(timestamp: number): Promise<number> {
    await this.init();

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index("timestamp");
      const request = index.openCursor(
        IDBKeyRange.upperBound(timestamp, true),
      );
      let deletedCount = 0;

      request.onsuccess = (event: Event): void => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = (): void => {
        reject(new Error("Failed to delete old transmissions"));
      };
    });
  }

  /**
   * Clear all transmission records
   */
  async clear(): Promise<void> {
    await this.init();

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onsuccess = (): void => {
        resolve();
      };

      request.onerror = (): void => {
        reject(new Error("Failed to clear transmissions"));
      };
    });
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

// Singleton instance for application-wide use
let loggerInstance: P25TransmissionLogger | null = null;

/**
 * Get the singleton P25 transmission logger instance
 */
export function getP25TransmissionLogger(): P25TransmissionLogger {
  loggerInstance ??= new P25TransmissionLogger();
  return loggerInstance;
}
