/**
 * IndexedDB storage for ATSC channel scan results
 *
 * Provides persistent storage for discovered ATSC channels with signal quality metrics.
 */

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
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(
        new Error(`Failed to open database: ${request.error?.message ?? "Unknown error"}`),
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
          keyPath: ["channel.channel"], // Use physical channel number as key
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
        new Error(`Failed to save channel: ${request.error?.message ?? "Unknown error"}`),
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
    const request = store.get([channelNumber]);

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
        new Error(`Failed to get channel: ${request.error?.message ?? "Unknown error"}`),
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
      const results = request.result as (Omit<
        StoredATSCChannel,
        "discoveredAt" | "lastScanned"
      > & {
        discoveredAt: string;
        lastScanned: string;
      })[];

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
        new Error(`Failed to get channels: ${request.error?.message ?? "Unknown error"}`),
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
      const results = request.result as (Omit<
        StoredATSCChannel,
        "discoveredAt" | "lastScanned"
      > & {
        discoveredAt: string;
        lastScanned: string;
      })[];

      const channels = results.map((ch) => ({
        ...ch,
        discoveredAt: new Date(ch.discoveredAt),
        lastScanned: new Date(ch.lastScanned),
      }));

      resolve(channels);
    };

    request.onerror = () => {
      reject(
        new Error(`Failed to get channels by band: ${request.error?.message ?? "Unknown error"}`),
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
    const request = store.delete([channelNumber]);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(
        new Error(`Failed to delete channel: ${request.error?.message ?? "Unknown error"}`),
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
        new Error(`Failed to clear channels: ${request.error?.message ?? "Unknown error"}`),
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
      const results = request.result as (Omit<
        StoredATSCChannel,
        "discoveredAt" | "lastScanned"
      > & {
        discoveredAt: string;
        lastScanned: string;
      })[];

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
 * Import channels from JSON
 */
export async function importATSCChannelsFromJSON(json: string): Promise<void> {
  const channels = JSON.parse(json) as StoredATSCChannel[];

  for (const channel of channels) {
    // Ensure dates are Date objects
    await saveATSCChannel({
      ...channel,
      discoveredAt:
        channel.discoveredAt instanceof Date
          ? channel.discoveredAt
          : new Date(channel.discoveredAt),
      lastScanned:
        channel.lastScanned instanceof Date
          ? channel.lastScanned
          : new Date(channel.lastScanned),
    });
  }
}
