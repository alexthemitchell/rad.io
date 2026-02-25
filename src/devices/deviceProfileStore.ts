export type StabilityProfile = {
  sourceType: 'MOCK' | 'HACKRF' | 'RTLSDR' | 'FILE';
  profileKey: string;
  updatedAtUtc: string;
  driftEstimateHzPerSec: number;
  driftConfidence: number;
  phaseErrorRms: number;
  ppmCorrectionHz: number;
  iqIntegrityLastReport?: {
    recordedAtUtc: string;
    status: 'ok' | 'warn';
    findings: string[];
    fixes: string[];
    summary: string;
  };
  applyOnConnect?: {
    enabled: boolean;
    sampleRateHz?: number;
    ppmCorrection?: number;
    gains?: Record<string, number>;
  };
  calibrationSeed?: {
    updatedAtUtc: string;
    sourceId: string;
    suggestedPpmCorrection: number;
    driftEstimateHzPerSec: number;
    confidence01: number;
    notes: string[];
  };
  frequencyCalibration?: {
    updatedAtUtc: string;
    sourceId: string;
    readiness: 'ready' | 'needs-more-evidence';
    confidence01: number;
    ppmCorrection: number;
    driftEstimateHzPerSec: number;
    observationSeconds: number;
    notes: string[];
  };
};

const STORAGE_KEY = 'rad.io.deviceProfiles.v1';

type ProfileMap = Record<string, StabilityProfile>;

const loadProfiles = (): ProfileMap => {
  if (typeof localStorage === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as ProfileMap;
    return parsed ?? {};
  } catch {
    return {};
  }
};

const saveProfiles = (profiles: ProfileMap): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // Best-effort persistence only.
  }
};

export const profileKeyFor = (sourceType: StabilityProfile['sourceType'], deviceName: string | null): string =>
  `${sourceType}:${(deviceName ?? 'default').toLowerCase().replace(/\s+/g, '-')}`;

export const getStabilityProfile = (key: string): StabilityProfile | null => {
  const profiles = loadProfiles();
  return profiles[key] ?? null;
};

export const upsertStabilityProfile = (profile: StabilityProfile): StabilityProfile => {
  const profiles = loadProfiles();
  profiles[profile.profileKey] = profile;
  saveProfiles(profiles);
  return profile;
};
