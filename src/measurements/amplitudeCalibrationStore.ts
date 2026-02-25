export type CalibrationBandId = 'hf' | 'vhf' | 'uhf';

export type AmplitudeCalibrationBlob = {
  updatedAtUtc: string;
  deviceProfileKey: string;
  bandId: CalibrationBandId;
  sourceId: string;
  centerFrequencyHz: number;
  sampleRateHz: number;
  dbfsToDbmOffset: number;
  dbfsToDbuvOffset: number;
  uncertaintyDb: number;
  baselineNoiseDbfs: number;
  gainDbByStage: Record<string, number>;
  rfChainProfileId: string | null;
  notes: string[];
};

export type BandCalibrationProfile = {
  bandId: CalibrationBandId;
  label: string;
  minHz: number;
  maxHz: number;
  preferredSourceId: string;
  targetUncertaintyDb: number;
  autoApply: boolean;
  updatedAtUtc: string;
};

type CalibrationStore = {
  byDevice: Record<string, Partial<Record<CalibrationBandId, AmplitudeCalibrationBlob>>>;
};

type BandProfileStore = {
  byDevice: Record<string, Partial<Record<CalibrationBandId, BandCalibrationProfile>>>;
};

const AMPLITUDE_CALIBRATION_STORAGE_KEY = 'rad.io.amplitudeCalibration.v1';
const BAND_CALIBRATION_PROFILE_STORAGE_KEY = 'rad.io.bandCalibrationProfiles.v1';

const emptyCalibrationStore = (): CalibrationStore => ({
  byDevice: {}
});

const emptyBandProfileStore = (): BandProfileStore => ({
  byDevice: {}
});

const parseJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const readCalibrationStore = (): CalibrationStore => {
  if (typeof localStorage === 'undefined') {
    return emptyCalibrationStore();
  }

  return parseJson(localStorage.getItem(AMPLITUDE_CALIBRATION_STORAGE_KEY), emptyCalibrationStore());
};

const writeCalibrationStore = (store: CalibrationStore): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(AMPLITUDE_CALIBRATION_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Best effort persistence only.
  }
};

const readBandProfileStore = (): BandProfileStore => {
  if (typeof localStorage === 'undefined') {
    return emptyBandProfileStore();
  }

  return parseJson(localStorage.getItem(BAND_CALIBRATION_PROFILE_STORAGE_KEY), emptyBandProfileStore());
};

const writeBandProfileStore = (store: BandProfileStore): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(BAND_CALIBRATION_PROFILE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Best effort persistence only.
  }
};

export const resolveCalibrationBandId = (frequencyHz: number): CalibrationBandId => {
  if (!Number.isFinite(frequencyHz) || frequencyHz < 0) {
    return 'vhf';
  }

  if (frequencyHz < 30_000_000) {
    return 'hf';
  }

  if (frequencyHz < 300_000_000) {
    return 'vhf';
  }

  return 'uhf';
};

export const listAmplitudeCalibrations = (deviceProfileKey: string): AmplitudeCalibrationBlob[] => {
  const store = readCalibrationStore();
  const byBand = store.byDevice[deviceProfileKey] ?? {};
  return (Object.values(byBand) as AmplitudeCalibrationBlob[])
    .filter((entry): entry is AmplitudeCalibrationBlob => Boolean(entry))
    .sort((a, b) => a.bandId.localeCompare(b.bandId));
};

export const getAmplitudeCalibration = (
  deviceProfileKey: string,
  bandId: CalibrationBandId
): AmplitudeCalibrationBlob | null => {
  const store = readCalibrationStore();
  return store.byDevice[deviceProfileKey]?.[bandId] ?? null;
};

export const upsertAmplitudeCalibration = (
  calibration: AmplitudeCalibrationBlob
): AmplitudeCalibrationBlob => {
  const store = readCalibrationStore();
  const previous = store.byDevice[calibration.deviceProfileKey] ?? {};
  store.byDevice[calibration.deviceProfileKey] = {
    ...previous,
    [calibration.bandId]: calibration
  };
  writeCalibrationStore(store);
  return calibration;
};

export const listBandCalibrationProfiles = (deviceProfileKey: string): BandCalibrationProfile[] => {
  const store = readBandProfileStore();
  const byBand = store.byDevice[deviceProfileKey] ?? {};
  return (Object.values(byBand) as BandCalibrationProfile[])
    .filter((entry): entry is BandCalibrationProfile => Boolean(entry))
    .sort((a, b) => a.bandId.localeCompare(b.bandId));
};

export const getBandCalibrationProfile = (
  deviceProfileKey: string,
  bandId: CalibrationBandId
): BandCalibrationProfile | null => {
  const store = readBandProfileStore();
  return store.byDevice[deviceProfileKey]?.[bandId] ?? null;
};

export const upsertBandCalibrationProfile = (
  deviceProfileKey: string,
  profile: Omit<BandCalibrationProfile, 'updatedAtUtc'> & { updatedAtUtc?: string }
): BandCalibrationProfile => {
  const entry: BandCalibrationProfile = {
    ...profile,
    updatedAtUtc: profile.updatedAtUtc ?? new Date().toISOString()
  };

  const store = readBandProfileStore();
  const previous = store.byDevice[deviceProfileKey] ?? {};
  store.byDevice[deviceProfileKey] = {
    ...previous,
    [entry.bandId]: entry
  };
  writeBandProfileStore(store);
  return entry;
};

export const createDefaultBandCalibrationProfile = (
  bandId: CalibrationBandId,
  sourceId = 'lab-signal-generator'
): BandCalibrationProfile => {
  if (bandId === 'hf') {
    return {
      bandId,
      label: 'HF',
      minHz: 100_000,
      maxHz: 30_000_000,
      preferredSourceId: sourceId,
      targetUncertaintyDb: 3,
      autoApply: true,
      updatedAtUtc: new Date().toISOString()
    };
  }

  if (bandId === 'vhf') {
    return {
      bandId,
      label: 'VHF',
      minHz: 30_000_000,
      maxHz: 300_000_000,
      preferredSourceId: sourceId,
      targetUncertaintyDb: 2.5,
      autoApply: true,
      updatedAtUtc: new Date().toISOString()
    };
  }

  return {
    bandId,
    label: 'UHF',
    minHz: 300_000_000,
    maxHz: 3_000_000_000,
    preferredSourceId: sourceId,
    targetUncertaintyDb: 3.5,
    autoApply: true,
    updatedAtUtc: new Date().toISOString()
  };
};

export const exportCalibrationBundle = (deviceProfileKey: string): {
  schemaVersion: '1.0.0';
  exportedAtUtc: string;
  deviceProfileKey: string;
  amplitudeCalibrations: AmplitudeCalibrationBlob[];
  bandProfiles: BandCalibrationProfile[];
} => ({
  schemaVersion: '1.0.0',
  exportedAtUtc: new Date().toISOString(),
  deviceProfileKey,
  amplitudeCalibrations: listAmplitudeCalibrations(deviceProfileKey),
  bandProfiles: listBandCalibrationProfiles(deviceProfileKey)
});
