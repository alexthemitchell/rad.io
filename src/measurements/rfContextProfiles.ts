import type { FrequencyMappingConfig } from '../dsp/frequencyMapping';

export type SourceCompatibility = 'mock' | 'rtl-sdr' | 'hackrf';

export type AntennaFrontEndContext = {
  antennaName: string;
  preampNote: string;
  attenuatorNote: string;
  filterNote: string;
  chainNotes: string;
  biasTeeEnabled: boolean;
};

export type RfChainProfile = {
  schemaVersion: '1.0.0';
  profileId: string;
  profileName: string;
  sourceCompatibility: SourceCompatibility[];
  antenna?: {
    descriptor?: string;
    notes?: string;
  };
  lna?: {
    enabled: boolean;
    gainDb: number;
  };
  attenuator?: {
    enabled: boolean;
    attenuationDb: number;
  };
  filters: Array<{
    kind: 'preselector' | 'notch' | 'bandpass' | 'highpass' | 'lowpass';
    label: string;
    enabled: boolean;
    lowCutHz?: number;
    highCutHz?: number;
  }>;
  biasTee: {
    enabled: boolean;
  };
  ifOffsetHz: number;
  transverter?: {
    enabled: boolean;
    label: string;
    loHz: number;
    direction: 'up' | 'down';
    ifCenterHz: number;
  };
  levelAdjustments: {
    frontEndGainDb: number;
    pathLossDb: number;
    netOffsetDb: number;
  };
  createdAtIso: string;
  updatedAtIso: string;
};

export type AntennaFrontEndProfile = {
  id: string;
  name: string;
  deviceProfileKey: string;
  context: AntennaFrontEndContext;
  rfChainProfileId: string | null;
  updatedAtUtc: string;
};

type ContextStore = {
  byDevice: Record<string, AntennaFrontEndProfile[]>;
};

type ChainStore = {
  byDevice: Record<string, RfChainProfile[]>;
};

const CONTEXT_PROFILE_STORAGE_KEY = 'rad.io.antennaFrontEndProfiles.v1';
const RF_CHAIN_PROFILE_STORAGE_KEY = 'rad.io.rfChainProfiles.v1';

const defaultContext = (): AntennaFrontEndContext => ({
  antennaName: '',
  preampNote: '',
  attenuatorNote: '',
  filterNote: '',
  chainNotes: '',
  biasTeeEnabled: false
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

const readContextStore = (): ContextStore => {
  if (typeof localStorage === 'undefined') {
    return { byDevice: {} };
  }

  return parseJson(localStorage.getItem(CONTEXT_PROFILE_STORAGE_KEY), { byDevice: {} });
};

const writeContextStore = (store: ContextStore): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(CONTEXT_PROFILE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Best effort persistence only.
  }
};

const readChainStore = (): ChainStore => {
  if (typeof localStorage === 'undefined') {
    return { byDevice: {} };
  }

  return parseJson(localStorage.getItem(RF_CHAIN_PROFILE_STORAGE_KEY), { byDevice: {} });
};

const writeChainStore = (store: ChainStore): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(RF_CHAIN_PROFILE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Best effort persistence only.
  }
};

export const createDefaultAntennaFrontEndContext = (): AntennaFrontEndContext => defaultContext();

export const listAntennaFrontEndProfiles = (deviceProfileKey: string): AntennaFrontEndProfile[] => {
  const store = readContextStore();
  return [...(store.byDevice[deviceProfileKey] ?? [])].sort((a, b) => a.name.localeCompare(b.name));
};

export const upsertAntennaFrontEndProfile = (
  profile: AntennaFrontEndProfile
): AntennaFrontEndProfile => {
  const store = readContextStore();
  const existing = store.byDevice[profile.deviceProfileKey] ?? [];
  const withoutCurrent = existing.filter((entry) => entry.id !== profile.id);
  store.byDevice[profile.deviceProfileKey] = [...withoutCurrent, profile];
  writeContextStore(store);
  return profile;
};

export const listRfChainProfiles = (deviceProfileKey: string): RfChainProfile[] => {
  const store = readChainStore();
  return [...(store.byDevice[deviceProfileKey] ?? [])].sort((a, b) => a.profileName.localeCompare(b.profileName));
};

export const upsertRfChainProfile = (
  deviceProfileKey: string,
  profile: RfChainProfile
): RfChainProfile => {
  const store = readChainStore();
  const existing = store.byDevice[deviceProfileKey] ?? [];
  const withoutCurrent = existing.filter((entry) => entry.profileId !== profile.profileId);
  store.byDevice[deviceProfileKey] = [...withoutCurrent, profile];
  writeChainStore(store);
  return profile;
};

export const buildRfChainProfileFromContext = (input: {
  profileId: string;
  profileName: string;
  context: AntennaFrontEndContext;
  frequencyMapping: FrequencyMappingConfig;
  netOffsetDb: number;
  sourceCompatibility?: SourceCompatibility[];
}): RfChainProfile => {
  const now = new Date().toISOString();

  return {
    schemaVersion: '1.0.0',
    profileId: input.profileId,
    profileName: input.profileName,
    sourceCompatibility: input.sourceCompatibility ?? ['mock', 'rtl-sdr', 'hackrf'],
    antenna: {
      descriptor: input.context.antennaName,
      notes: input.context.chainNotes
    },
    lna: {
      enabled: input.context.preampNote.trim().length > 0,
      gainDb: 0
    },
    attenuator: {
      enabled: input.context.attenuatorNote.trim().length > 0,
      attenuationDb: 0
    },
    filters: input.context.filterNote.trim().length === 0
      ? []
      : [{
          kind: 'bandpass',
          label: input.context.filterNote,
          enabled: true
        }],
    biasTee: {
      enabled: input.context.biasTeeEnabled
    },
    ifOffsetHz: input.frequencyMapping.ifOffsetHz,
    transverter: input.frequencyMapping.transverterEnabled
      ? {
          enabled: true,
          label: 'Transverter',
          loHz: input.frequencyMapping.transverterLoHz,
          direction: input.frequencyMapping.transverterDirection,
          ifCenterHz: 0
        }
      : undefined,
    levelAdjustments: {
      frontEndGainDb: 0,
      pathLossDb: 0,
      netOffsetDb: input.netOffsetDb
    },
    createdAtIso: now,
    updatedAtIso: now
  };
};

export const applyRfChainProfileToFrequencyMapping = (
  profile: RfChainProfile,
  fallback: FrequencyMappingConfig
): FrequencyMappingConfig => ({
  ifOffsetHz: profile.ifOffsetHz,
  transverterEnabled: profile.transverter?.enabled ?? false,
  transverterLoHz: profile.transverter?.loHz ?? fallback.transverterLoHz,
  transverterDirection: profile.transverter?.direction ?? fallback.transverterDirection
});
