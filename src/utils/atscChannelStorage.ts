/**
 * IndexedDB storage for ATSC channel scan results
 *
 * Provides persistent storage for discovered ATSC channels with signal quality metrics.
 */

/* eslint-disable @typescript-eslint/explicit-function-return-type */

import type { ATSCChannel } from "./atscChannels";

/**
 * Stored ATSC channel data with scan results
 */
export interface StoredATSCChannel {
  /** Channel information */
  channel: ATSCChannel;
  /** Signal strength (0-1 scale) */
  strength: number;
  /** Signal-to-Noise Ratio in dB */
  snr: number;
  /** Modulation Error Ratio in dB (if available) */
  mer?: number;
  /** Whether pilot tone was detected */
  pilotDetected: boolean;
  /** Whether sync was achieved */
  syncLocked: boolean;
  /** Number of segment syncs detected during scan */
  segmentSyncCount: number;
  /** Number of field syncs detected during scan */
  fieldSyncCount: number;
  /** Virtual channel numbers (if decoded from PSIP) */
  virtualChannels?: number[];
  /** Station call signs (if decoded from PSIP) */
  callSigns?: string[];
  /** Timestamp when channel was discovered */
  discoveredAt: Date;
  /** Timestamp of last successful scan */
  lastScanned: Date;
  /** Number of times this channel has been scanned */
  scanCount: number;
}

/**
 * Database name and version
 */
const DB_NAME = "rad-io-atsc-channels";
const DB_VERSION = 1;
const STORE_NAME = "channels";

/**
 * Open or create the IndexedDB database
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(
        new Error(
          `Failed to open database: ${request.error?.message ?? "Unknown error"}`,
        ),
      );
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "channel.channel", // Use physical channel number as key
        });

        // Create indexes for efficient querying
        store.createIndex("band", "channel.band", { unique: false });
        store.createIndex("strength", "strength", { unique: false });
        store.createIndex("discoveredAt", "discoveredAt", { unique: false });
        store.createIndex("lastScanned", "lastScanned", { unique: false });
        store.createIndex("syncLocked", "syncLocked", { unique: false });
      }
    };
  });
}

/**
 * Save a scanned channel to the database
 */
export async function saveATSCChannel(
  channelData: StoredATSCChannel,
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    // Convert Date objects to ISO strings for storage
    const storedData = {
      ...channelData,
      discoveredAt: channelData.discoveredAt.toISOString(),
      lastScanned: channelData.lastScanned.toISOString(),
    };

    const request = store.put(storedData);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(
        new Error(
          `Failed to save channel: ${request.error?.message ?? "Unknown error"}`,
        ),
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Get a channel by physical channel number
 */
export async function getATSCChannelData(
  channelNumber: number,
): Promise<StoredATSCChannel | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(channelNumber);

    request.onsuccess = () => {
      const result = request.result as
        | (Omit<StoredATSCChannel, "discoveredAt" | "lastScanned"> & {
            discoveredAt: string;
            lastScanned: string;
          })
        | undefined;

      if (result) {
        // Convert ISO strings back to Date objects
        resolve({
          ...result,
          discoveredAt: new Date(result.discoveredAt),
          lastScanned: new Date(result.lastScanned),
        });
      } else {
        resolve(undefined);
      }
    };

    request.onerror = () => {
      reject(
        new Error(
          `Failed to get channel: ${request.error?.message ?? "Unknown error"}`,
        ),
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Get all stored channels
 */
export async function getAllATSCChannels(): Promise<StoredATSCChannel[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as Array<
        Omit<StoredATSCChannel, "discoveredAt" | "lastScanned"> & {
          discoveredAt: string;
          lastScanned: string;
        }
      >;

      // Convert ISO strings back to Date objects
      const channels = results.map((ch) => ({
        ...ch,
        discoveredAt: new Date(ch.discoveredAt),
        lastScanned: new Date(ch.lastScanned),
      }));

      resolve(channels);
    };

    request.onerror = () => {
      reject(
        new Error(
          `Failed to get channels: ${request.error?.message ?? "Unknown error"}`,
        ),
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Get channels by band
 */
export async function getATSCChannelsByBand(
  band: "VHF-Low" | "VHF-High" | "UHF",
): Promise<StoredATSCChannel[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("band");
    const request = index.getAll(band);

    request.onsuccess = () => {
      const results = request.result as Array<
        Omit<StoredATSCChannel, "discoveredAt" | "lastScanned"> & {
          discoveredAt: string;
          lastScanned: string;
        }
      >;

      const channels = results.map((ch) => ({
        ...ch,
        discoveredAt: new Date(ch.discoveredAt),
        lastScanned: new Date(ch.lastScanned),
      }));

      resolve(channels);
    };

    request.onerror = () => {
      reject(
        new Error(
          `Failed to get channels by band: ${request.error?.message ?? "Unknown error"}`,
        ),
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Delete a channel from the database
 */
export async function deleteATSCChannel(channelNumber: number): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(channelNumber);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(
        new Error(
          `Failed to delete channel: ${request.error?.message ?? "Unknown error"}`,
        ),
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Clear all stored channels
 */
export async function clearAllATSCChannels(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(
        new Error(
          `Failed to clear channels: ${request.error?.message ?? "Unknown error"}`,
        ),
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Get channels sorted by signal strength
 */
export async function getATSCChannelsByStrength(): Promise<
  StoredATSCChannel[]
> {
  const channels = await getAllATSCChannels();
  return channels.sort((a, b) => b.strength - a.strength);
}

/**
 * Get only channels with sync lock
 */
export async function getSyncLockedATSCChannels(): Promise<
  StoredATSCChannel[]
> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as Array<
        Omit<StoredATSCChannel, "discoveredAt" | "lastScanned"> & {
          discoveredAt: string;
          lastScanned: string;
        }
      >;

      // Filter for syncLocked channels
      const channels = results
        .filter((ch) => ch.syncLocked)
        .map((ch) => ({
          ...ch,
          discoveredAt: new Date(ch.discoveredAt),
          lastScanned: new Date(ch.lastScanned),
        }));

      resolve(channels);
    };

    request.onerror = () => {
      reject(
        new Error(
          `Failed to get sync-locked channels: ${request.error?.message ?? "Unknown error"}`,
        ),
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Export all channels to JSON
 */
export async function exportATSCChannelsToJSON(): Promise<string> {
  const channels = await getAllATSCChannels();
  return JSON.stringify(channels, null, 2);
}

/**
 * Imports ATSC channel data from a JSON string.
 *
 * Parses the provided JSON, validates its structure, and imports the channels into persistent storage.
 * Throws an error if the JSON is invalid or does not contain a valid array of channels.
 *
 * @param json - A JSON string representing an array of ATSC channel objects.
 * @returns A Promise that resolves when the import is complete.
 */
export async function importATSCChannelsFromJSON(json: string): Promise<void> {
  // Validate JSON structure
  let channels: unknown;
  try {
    channels = JSON.parse(json);
  } catch (_error) {
    throw new Error("Invalid JSON format");
  }

  // Verify it's an array
  if (!Array.isArray(channels)) {
    throw new Error("JSON must contain an array of channels");
  }

  // Validate each channel
  for (const channel of channels) {
    // Check required properties
    if (!channel || typeof channel !== "object") {
      throw new Error("Invalid channel object");
    }

    const ch = channel as Partial<StoredATSCChannel>;

    // Validate channel structure
    if (!ch.channel || typeof ch.channel !== "object") {
      throw new Error("Missing or invalid channel information");
    }

    // Validate channel number
    if (
      typeof ch.channel.channel !== "number" ||
      ch.channel.channel < 2 ||
      ch.channel.channel > 36
    ) {
      throw new Error(
        `Invalid channel number: ${ch.channel.channel}. Must be between 2 and 36.`,
      );
    }

    // Validate numeric values
    if (typeof ch.strength !== "number" || ch.strength < 0 || ch.strength > 1) {
      throw new Error("Invalid strength value. Must be between 0 and 1.");
    }

    if (typeof ch.snr !== "number") {
      throw new Error("Invalid SNR value");
    }

    if (typeof ch.pilotDetected !== "boolean") {
      throw new Error("Invalid pilotDetected value");
    }

    if (typeof ch.syncLocked !== "boolean") {
      throw new Error("Invalid syncLocked value");
    }

    if (typeof ch.segmentSyncCount !== "number" || ch.segmentSyncCount < 0) {
      throw new Error("Invalid segmentSyncCount value");
    }

    if (typeof ch.fieldSyncCount !== "number" || ch.fieldSyncCount < 0) {
      throw new Error("Invalid fieldSyncCount value");
    }

    // Validate required date fields
    if (!ch.discoveredAt) {
      throw new Error("Missing discoveredAt field");
    }
    if (!ch.lastScanned) {
      throw new Error("Missing lastScanned field");
    }

    if (typeof ch.scanCount !== "number" || ch.scanCount < 0) {
      throw new Error("Invalid scanCount value");
    }

    // Construct validated channel object explicitly
    // All required properties have been validated above, so TypeScript can infer they exist
    const validatedChannel: StoredATSCChannel = {
      channel: ch.channel,
      strength: ch.strength,
      snr: ch.snr,
      mer: ch.mer,
      pilotDetected: ch.pilotDetected,
      syncLocked: ch.syncLocked,
      segmentSyncCount: ch.segmentSyncCount,
      fieldSyncCount: ch.fieldSyncCount,
      virtualChannels: ch.virtualChannels,
      callSigns: ch.callSigns,
      discoveredAt:
        ch.discoveredAt instanceof Date
          ? ch.discoveredAt
          : new Date(ch.discoveredAt),
      lastScanned:
        ch.lastScanned instanceof Date
          ? ch.lastScanned
          : new Date(ch.lastScanned),
      scanCount: ch.scanCount,
    } as StoredATSCChannel;

    await saveATSCChannel(validatedChannel);
  }
}
