import { create } from "zustand";
import type { RDSStationData } from "../models/RDSData";

/** Entry stored per frequency */
interface RDSCacheEntry {
  data: RDSStationData;
  lastUpdated: number; // epoch ms
}

interface RDSCacheState {
  entries: Map<number, RDSCacheEntry>; // keyed by exact Hz center frequency
  /** Update or insert station data */
  updateRDSData: (frequencyHz: number, data: RDSStationData) => void;
  /** Get station data for frequency or nearby cached (within tolerance) */
  getRDSData: (frequencyHz: number) => RDSStationData | undefined;
  /** Remove stale entries (no update in given ms) */
  prune: (maxAgeMs?: number) => void;
  /** Bulk update many stations within current captured bandwidth */
  updateBulkRDSData: (
    updates: Array<{ frequencyHz: number; data: RDSStationData }>,
  ) => void;
  /** Retrieve all stations whose center frequencies fall inside [lowerHz, upperHz] */
  getStationsInRange: (lowerHz: number, upperHz: number) => RDSStationData[];
  /** Convenience: stations inside the current SDR capture bandwidth defined by center & sample rate */
  getStationsForBandwidth: (
    centerFrequencyHz: number,
    sampleRateHz: number,
  ) => RDSStationData[];
  /** All cached stations (deduped by Program Service name preference) */
  getAllStations: () => RDSStationData[];
}

// FM broadcast channels are typically spaced 200 kHz apart (US/ITU),
// so we want to tolerate at least +/-100 kHz to match stations when
// the detected signal frequency differs slightly from the cached station
// center frequency. 150 kHz gives us some margin for receiver offsets.
const NEARBY_TOLERANCE_HZ = 150_000; // 150 kHz tolerance for matching cached FM channels
const DEFAULT_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

export const rdsCacheStore = create<RDSCacheState>()((set, get) => ({
  entries: new Map<number, RDSCacheEntry>(),
  updateRDSData: (frequencyHz: number, data: RDSStationData): void => {
    set((state) => {
      const next = new Map(state.entries);
      next.set(frequencyHz, { data, lastUpdated: Date.now() });
      return { entries: next };
    });
  },
  getRDSData: (frequencyHz: number): RDSStationData | undefined => {
    const { entries } = get();
    // Exact match first
    const direct = entries.get(frequencyHz);
    if (direct) return direct.data;
    // Otherwise search within tolerance (use closest recent)
    let best: RDSCacheEntry | undefined;
    for (const [freq, entry] of entries) {
      if (Math.abs(freq - frequencyHz) <= NEARBY_TOLERANCE_HZ) {
        if (!best || entry.lastUpdated > best.lastUpdated) {
          best = entry;
        }
      }
    }
    return best?.data;
  },
  prune: (maxAgeMs = DEFAULT_MAX_AGE_MS): void => {
    const cutoff = Date.now() - maxAgeMs;
    set((state) => {
      const next = new Map<number, RDSCacheEntry>();
      for (const [freq, entry] of state.entries) {
        if (entry.lastUpdated >= cutoff) {
          next.set(freq, entry);
        }
      }
      return { entries: next };
    });
  },
  updateBulkRDSData: (updates: Array<{ frequencyHz: number; data: RDSStationData }>): void => {
    if (updates.length === 0) return;
    const now = Date.now();
    set((state) => {
      const next = new Map(state.entries);
      for (const { frequencyHz, data } of updates) {
        next.set(frequencyHz, { data, lastUpdated: now });
      }
      return { entries: next };
    });
  },
  getStationsInRange: (lowerHz: number, upperHz: number): RDSStationData[] => {
    if (upperHz < lowerHz) return [];
    const { entries } = get();
    const pairs: Array<{ freq: number; data: RDSStationData }> = [];
    for (const [freq, entry] of entries) {
      if (freq >= lowerHz && freq <= upperHz) {
        pairs.push({ freq, data: entry.data });
      }
    }
    pairs.sort((a, b) => a.freq - b.freq);
    return pairs.map((p) => p.data);
  },
  getStationsForBandwidth: (centerFrequencyHz: number, sampleRateHz: number): RDSStationData[] => {
    const half = sampleRateHz / 2;
    const lower = centerFrequencyHz - half;
    const upper = centerFrequencyHz + half;
    return get().getStationsInRange(lower, upper);
  },
  getAllStations: (): RDSStationData[] => {
    const seen = new Map<string, { freq: number; data: RDSStationData }>();
    const { entries } = get();
    for (const [freq, entry] of entries) {
      const psKey = entry.data.ps || `__freq_${freq}`;
      const prev = seen.get(psKey);
      if (!prev || entry.lastUpdated > prev.data.lastUpdate) {
        seen.set(psKey, { freq, data: entry.data });
      }
    }
    return Array.from(seen.values())
      .sort((a, b) => a.freq - b.freq)
      .map((v) => v.data);
  },
}));

// Convenience accessors (non-hook usage for non-React classes)
export const getCachedRDSData = (
  frequencyHz: number,
): RDSStationData | undefined =>
  rdsCacheStore.getState().getRDSData(frequencyHz);
export const updateCachedRDSData = (
  frequencyHz: number,
  data: RDSStationData,
): void => {
  rdsCacheStore.getState().updateRDSData(frequencyHz, data);
};

// Bulk convenience wrapper
export const updateBulkCachedRDSData = (
  updates: Array<{ frequencyHz: number; data: RDSStationData }>,
): void => {
  rdsCacheStore.getState().updateBulkRDSData(updates);
};

// Retrieval helpers for bandwidth scanning
export const getStationsForBandwidth = (
  centerFrequencyHz: number,
  sampleRateHz: number,
): RDSStationData[] =>
  rdsCacheStore
    .getState()
    .getStationsForBandwidth(centerFrequencyHz, sampleRateHz);

export const getAllCachedStations = (): RDSStationData[] =>
  rdsCacheStore.getState().getAllStations();
