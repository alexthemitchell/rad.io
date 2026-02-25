export type WidebandScanConfig = {
  startHz: number;
  stopHz: number;
  stepHz: number;
  tuneSettleMs: number;
  dwellMs: number;
  holdMs: number;
  minProminenceDb: number;
};

export type WidebandScanObservation = {
  frequencyHz: number;
  prominenceDb: number;
  peakDb: number;
  noiseFloorDb: number;
  detected: boolean;
  measuredAtIso: string;
};

export type WidebandOccupancyBin = {
  frequencyHz: number;
  sweeps: number;
  hits: number;
  occupancy01: number;
  lastDetectedAtIso: string | null;
  lastProminenceDb: number;
  holdUntilIso: string | null;
};

export type WidebandOccupancyLog = {
  schemaVersion: 1;
  updatedAtIso: string;
  sweeps: number;
  bins: WidebandOccupancyBin[];
};

export type WidebandDetectionSummary = {
  frequencyHz: number;
  hits: number;
  maxProminenceDb: number;
  lastSeenIso: string;
};

const SCHEMA_VERSION = 1;
const DEFAULT_CONFIG: WidebandScanConfig = {
  startHz: 87_500_000,
  stopHz: 108_000_000,
  stepHz: 200_000,
  tuneSettleMs: 280,
  dwellMs: 600,
  holdMs: 2_000,
  minProminenceDb: 8
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const finiteOr = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
};

export const createEmptyWidebandOccupancyLog = (): WidebandOccupancyLog => ({
  schemaVersion: SCHEMA_VERSION,
  updatedAtIso: new Date(0).toISOString(),
  sweeps: 0,
  bins: []
});

export const normalizeWidebandScanConfig = (input: Partial<WidebandScanConfig>): WidebandScanConfig => {
  const startHzRaw = finiteOr(input.startHz, DEFAULT_CONFIG.startHz);
  const stopHzRaw = finiteOr(input.stopHz, DEFAULT_CONFIG.stopHz);
  const startHz = Math.max(0, Math.round(Math.min(startHzRaw, stopHzRaw)));
  const stopHz = Math.max(startHz, Math.round(Math.max(startHzRaw, stopHzRaw)));

  return {
    startHz,
    stopHz,
    stepHz: clamp(Math.round(finiteOr(input.stepHz, DEFAULT_CONFIG.stepHz)), 1_000, 10_000_000),
    tuneSettleMs: clamp(Math.round(finiteOr(input.tuneSettleMs, DEFAULT_CONFIG.tuneSettleMs)), 80, 5_000),
    dwellMs: clamp(Math.round(finiteOr(input.dwellMs, DEFAULT_CONFIG.dwellMs)), 0, 10_000),
    holdMs: clamp(Math.round(finiteOr(input.holdMs, DEFAULT_CONFIG.holdMs)), 0, 120_000),
    minProminenceDb: clamp(finiteOr(input.minProminenceDb, DEFAULT_CONFIG.minProminenceDb), 1, 60)
  };
};

export const buildWidebandScanFrequencies = (config: WidebandScanConfig): number[] => {
  const normalized = normalizeWidebandScanConfig(config);
  const frequencies: number[] = [];

  for (let hz = normalized.startHz; hz <= normalized.stopHz; hz += normalized.stepHz) {
    frequencies.push(hz);
    if (frequencies.length > 20_000) {
      break;
    }
  }

  const last = frequencies[frequencies.length - 1];
  if (last !== normalized.stopHz && frequencies.length < 20_000) {
    frequencies.push(normalized.stopHz);
  }

  return frequencies;
};

const toMillis = (iso: string): number => {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const updateWidebandOccupancyLog = (
  previous: WidebandOccupancyLog,
  observations: readonly WidebandScanObservation[],
  sweepAtIso: string,
  holdMs: number
): WidebandOccupancyLog => {
  const prevBins = new Map<number, WidebandOccupancyBin>();
  for (const bin of previous.bins) {
    prevBins.set(bin.frequencyHz, { ...bin });
  }

  const sweepCount = Math.max(0, previous.sweeps) + 1;
  const holdUntilIso = new Date(toMillis(sweepAtIso) + Math.max(0, holdMs)).toISOString();

  for (const obs of observations) {
    const existing = prevBins.get(obs.frequencyHz) ?? {
      frequencyHz: obs.frequencyHz,
      sweeps: 0,
      hits: 0,
      occupancy01: 0,
      lastDetectedAtIso: null,
      lastProminenceDb: Number.NEGATIVE_INFINITY,
      holdUntilIso: null
    };

    existing.sweeps += 1;
    if (obs.detected) {
      existing.hits += 1;
      existing.lastDetectedAtIso = obs.measuredAtIso;
      existing.lastProminenceDb = Math.max(existing.lastProminenceDb, obs.prominenceDb);
      existing.holdUntilIso = holdUntilIso;
    }

    existing.occupancy01 = existing.sweeps > 0 ? existing.hits / existing.sweeps : 0;
    prevBins.set(obs.frequencyHz, existing);
  }

  const bins = Array.from(prevBins.values())
    .map((bin) => {
      if (bin.sweeps < sweepCount) {
        return {
          ...bin,
          sweeps: sweepCount,
          occupancy01: sweepCount > 0 ? bin.hits / sweepCount : 0
        };
      }
      return bin;
    })
    .sort((a, b) => a.frequencyHz - b.frequencyHz);

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAtIso: sweepAtIso,
    sweeps: sweepCount,
    bins
  };
};

export const listHeldWidebandFrequencies = (
  log: WidebandOccupancyLog,
  nowIso: string
): WidebandOccupancyBin[] => {
  const nowMs = toMillis(nowIso);
  return log.bins
    .filter((bin) => {
      if (!bin.holdUntilIso) {
        return false;
      }
      return toMillis(bin.holdUntilIso) > nowMs;
    })
    .sort((a, b) => b.lastProminenceDb - a.lastProminenceDb);
};

export const summarizeWidebandDetections = (
  observations: readonly WidebandScanObservation[],
  mergeWindowHz: number
): WidebandDetectionSummary[] => {
  const detected = observations
    .filter((obs) => obs.detected)
    .sort((a, b) => a.frequencyHz - b.frequencyHz);

  if (detected.length === 0) {
    return [];
  }

  const groups: WidebandDetectionSummary[] = [];
  for (const obs of detected) {
    const prev = groups[groups.length - 1];
    if (!prev || obs.frequencyHz - prev.frequencyHz > mergeWindowHz) {
      groups.push({
        frequencyHz: obs.frequencyHz,
        hits: 1,
        maxProminenceDb: obs.prominenceDb,
        lastSeenIso: obs.measuredAtIso
      });
      continue;
    }

    prev.hits += 1;
    if (obs.prominenceDb >= prev.maxProminenceDb) {
      prev.frequencyHz = obs.frequencyHz;
      prev.maxProminenceDb = obs.prominenceDb;
      prev.lastSeenIso = obs.measuredAtIso;
    }
  }

  return groups.sort((a, b) => b.maxProminenceDb - a.maxProminenceDb);
};

export const exportWidebandOccupancyCsv = (log: WidebandOccupancyLog): string => {
  const header = 'frequency_hz,sweeps,hits,occupancy_percent,last_detected_iso,max_prominence_db,hold_until_iso';
  const rows = log.bins.map((bin) => {
    const occupancyPercent = (bin.occupancy01 * 100).toFixed(2);
    const lastDetected = bin.lastDetectedAtIso ?? '';
    const prominence = Number.isFinite(bin.lastProminenceDb) ? bin.lastProminenceDb.toFixed(2) : '';
    const holdUntil = bin.holdUntilIso ?? '';
    return [
      Math.round(bin.frequencyHz).toString(),
      bin.sweeps.toString(),
      bin.hits.toString(),
      occupancyPercent,
      lastDetected,
      prominence,
      holdUntil
    ].join(',');
  });

  return `${header}\n${rows.join('\n')}`;
};

export const WIDEBAND_OCCUPANCY_STORAGE_KEY = 'rad.io.phase65.widebandOccupancy.v1';

export const saveWidebandOccupancyLog = (
  storage: Pick<Storage, 'setItem'>,
  log: WidebandOccupancyLog
): void => {
  storage.setItem(WIDEBAND_OCCUPANCY_STORAGE_KEY, JSON.stringify(log));
};

export const loadWidebandOccupancyLog = (
  storage: Pick<Storage, 'getItem'>
): WidebandOccupancyLog => {
  const raw = storage.getItem(WIDEBAND_OCCUPANCY_STORAGE_KEY);
  if (!raw) {
    return createEmptyWidebandOccupancyLog();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WidebandOccupancyLog>;
    if (parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.bins)) {
      return createEmptyWidebandOccupancyLog();
    }

    const bins = parsed.bins
      .filter((bin): bin is WidebandOccupancyBin => typeof bin === 'object' && bin !== null)
      .map((bin) => ({
        frequencyHz: Math.max(0, Math.round(finiteOr(bin.frequencyHz, 0))),
        sweeps: Math.max(0, Math.round(finiteOr(bin.sweeps, 0))),
        hits: Math.max(0, Math.round(finiteOr(bin.hits, 0))),
        occupancy01: clamp(finiteOr(bin.occupancy01, 0), 0, 1),
        lastDetectedAtIso: typeof bin.lastDetectedAtIso === 'string' ? bin.lastDetectedAtIso : null,
        lastProminenceDb: finiteOr(bin.lastProminenceDb, Number.NEGATIVE_INFINITY),
        holdUntilIso: typeof bin.holdUntilIso === 'string' ? bin.holdUntilIso : null
      }))
      .sort((a, b) => a.frequencyHz - b.frequencyHz);

    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAtIso: typeof parsed.updatedAtIso === 'string' ? parsed.updatedAtIso : new Date(0).toISOString(),
      sweeps: Math.max(0, Math.round(finiteOr(parsed.sweeps, 0))),
      bins
    };
  } catch {
    return createEmptyWidebandOccupancyLog();
  }
};
