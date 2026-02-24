import type { FilterProfile, InterferencePreset } from './AudioPostProcessor';
import type { DemodMode, LockState } from './DemodMetrics';

export type ModeControlContract = {
  lowCutMinHz: number;
  lowCutMaxHz: number;
  highCutMinHz: number;
  highCutMaxHz: number;
  defaultLowCutHz: number;
  defaultHighCutHz: number;
  defaultFilterProfile: FilterProfile;
  defaultInterferencePreset: InterferencePreset;
  defaultOutputLevel: number;
  defaultMaxOutputLevel: number;
};

export const MODE_CONTROL_CONTRACTS: Record<DemodMode, ModeControlContract> = {
  WFM: {
    lowCutMinHz: 0,
    lowCutMaxHz: 400,
    highCutMinHz: 10_000,
    highCutMaxHz: 18_000,
    defaultLowCutHz: 80,
    defaultHighCutHz: 14_000,
    defaultFilterProfile: 'low-ringing',
    defaultInterferencePreset: 'off',
    defaultOutputLevel: 0.45,
    defaultMaxOutputLevel: 0.75
  },
  AM: {
    lowCutMinHz: 40,
    lowCutMaxHz: 1_200,
    highCutMinHz: 2_200,
    highCutMaxHz: 7_500,
    defaultLowCutHz: 120,
    defaultHighCutHz: 4_500,
    defaultFilterProfile: 'sharp',
    defaultInterferencePreset: 'off',
    defaultOutputLevel: 0.5,
    defaultMaxOutputLevel: 0.78
  },
  NFM: {
    lowCutMinHz: 120,
    lowCutMaxHz: 1_600,
    highCutMinHz: 2_000,
    highCutMaxHz: 5_200,
    defaultLowCutHz: 250,
    defaultHighCutHz: 3_400,
    defaultFilterProfile: 'sharp',
    defaultInterferencePreset: 'off',
    defaultOutputLevel: 0.6,
    defaultMaxOutputLevel: 0.82
  }
};

export const clampFilterForMode = (
  mode: DemodMode,
  lowCutHz: number,
  highCutHz: number
): { lowCutHz: number; highCutHz: number } => {
  const contract = MODE_CONTROL_CONTRACTS[mode];
  const clampedLow = Math.min(Math.max(lowCutHz, contract.lowCutMinHz), contract.lowCutMaxHz);
  const minimumHigh = Math.max(contract.highCutMinHz, clampedLow + 250);
  const clampedHigh = Math.min(Math.max(highCutHz, minimumHigh), contract.highCutMaxHz);

  return {
    lowCutHz: clampedLow,
    highCutHz: clampedHigh
  };
};

export const maxFineTuneHzForFilter = (highCutHz: number, sampleRateHz = 2_000_000): number => {
  const nyquist = sampleRateHz * 0.5;
  const guardBandHz = 20_000;
  return Math.max(5_000, Math.floor(nyquist - highCutHz - guardBandHz));
};

export const clampFineTuneHz = (fineTuneHz: number, highCutHz: number, sampleRateHz = 2_000_000): number => {
  const maxFineTuneHz = maxFineTuneHzForFilter(highCutHz, sampleRateHz);
  return Math.min(Math.max(fineTuneHz, -maxFineTuneHz), maxFineTuneHz);
};

export const lockStateLabel = (mode: DemodMode, state: LockState): string => {
  if (mode === 'WFM') {
    return state === 'locked' ? 'pilot lock' : state === 'degraded' ? 'pilot degraded' : 'pilot searching';
  }

  if (mode === 'AM') {
    return state === 'locked' ? 'carrier lock' : state === 'degraded' ? 'carrier weak' : 'carrier searching';
  }

  return state === 'locked' ? 'discriminator locked' : state === 'degraded' ? 'discriminator degraded' : 'discriminator searching';
};
