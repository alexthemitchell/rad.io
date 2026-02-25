export type InteractionDemodMode = 'WFM' | 'NFM' | 'AM' | 'SAM' | 'USB' | 'LSB' | 'CW';

export type BandRegionId = 'na' | 'eu' | 'jp';

export type BandPlanEntry = {
  id: string;
  label: string;
  startHz: number;
  stopHz: number;
  rasterHz: number;
  defaultMode: InteractionDemodMode;
  allowedModes: readonly InteractionDemodMode[];
  modeStepHz: Partial<Record<InteractionDemodMode, number>>;
  preferredNfmPreset?: 'voice-na-75us' | 'voice-eu-50us' | 'flat-discriminator';
};

export type BandRegionPlan = {
  id: BandRegionId;
  label: string;
  bands: readonly BandPlanEntry[];
};

const BASE_MODE_STEPS_HZ: Record<InteractionDemodMode, number> = {
  WFM: 100_000,
  NFM: 12_500,
  AM: 5_000,
  SAM: 5_000,
  USB: 100,
  LSB: 100,
  CW: 50
};

const BAND_REGION_PLANS: readonly BandRegionPlan[] = [
  {
    id: 'na',
    label: 'North America',
    bands: [
      {
        id: 'fm-broadcast',
        label: 'FM Broadcast',
        startHz: 87_500_000,
        stopHz: 108_000_000,
        rasterHz: 200_000,
        defaultMode: 'WFM',
        allowedModes: ['WFM'],
        modeStepHz: { WFM: 200_000 }
      },
      {
        id: 'airband',
        label: 'Airband VHF',
        startHz: 118_000_000,
        stopHz: 136_991_666,
        rasterHz: 25_000,
        defaultMode: 'AM',
        allowedModes: ['AM', 'SAM'],
        modeStepHz: { AM: 25_000, SAM: 25_000 }
      },
      {
        id: 'vhf-land-mobile',
        label: 'VHF Land Mobile',
        startHz: 136_000_000,
        stopHz: 174_000_000,
        rasterHz: 12_500,
        defaultMode: 'NFM',
        allowedModes: ['NFM', 'AM'],
        modeStepHz: { NFM: 12_500, AM: 12_500 },
        preferredNfmPreset: 'voice-na-75us'
      }
    ]
  },
  {
    id: 'eu',
    label: 'Europe',
    bands: [
      {
        id: 'fm-broadcast',
        label: 'FM Broadcast',
        startHz: 87_500_000,
        stopHz: 108_000_000,
        rasterHz: 100_000,
        defaultMode: 'WFM',
        allowedModes: ['WFM'],
        modeStepHz: { WFM: 100_000 }
      },
      {
        id: 'airband',
        label: 'Airband VHF',
        startHz: 118_000_000,
        stopHz: 136_991_666,
        rasterHz: 8_333,
        defaultMode: 'AM',
        allowedModes: ['AM', 'SAM'],
        modeStepHz: { AM: 8_333, SAM: 8_333 }
      },
      {
        id: 'pmr446',
        label: 'PMR446',
        startHz: 446_000_000,
        stopHz: 446_200_000,
        rasterHz: 12_500,
        defaultMode: 'NFM',
        allowedModes: ['NFM'],
        modeStepHz: { NFM: 12_500 },
        preferredNfmPreset: 'voice-eu-50us'
      }
    ]
  },
  {
    id: 'jp',
    label: 'Japan',
    bands: [
      {
        id: 'fm-broadcast',
        label: 'FM Broadcast',
        startHz: 76_000_000,
        stopHz: 95_000_000,
        rasterHz: 100_000,
        defaultMode: 'WFM',
        allowedModes: ['WFM'],
        modeStepHz: { WFM: 100_000 }
      },
      {
        id: 'airband',
        label: 'Airband VHF',
        startHz: 118_000_000,
        stopHz: 136_991_666,
        rasterHz: 25_000,
        defaultMode: 'AM',
        allowedModes: ['AM', 'SAM'],
        modeStepHz: { AM: 25_000, SAM: 25_000 }
      },
      {
        id: 'uav-control',
        label: 'UAV/Industrial 169 MHz',
        startHz: 169_400_000,
        stopHz: 169_812_500,
        rasterHz: 12_500,
        defaultMode: 'NFM',
        allowedModes: ['NFM', 'AM'],
        modeStepHz: { NFM: 12_500, AM: 12_500 },
        preferredNfmPreset: 'voice-eu-50us'
      }
    ]
  }
];

export const listBandRegionPlans = (): readonly BandRegionPlan[] => BAND_REGION_PLANS;

export const getBandRegionPlan = (regionId: BandRegionId): BandRegionPlan => {
  return BAND_REGION_PLANS.find((plan) => plan.id === regionId) ?? BAND_REGION_PLANS[0];
};

export const findBandForFrequencyHz = (
  regionId: BandRegionId,
  frequencyHz: number
): BandPlanEntry | null => {
  const region = getBandRegionPlan(regionId);
  return region.bands.find((band) => frequencyHz >= band.startHz && frequencyHz <= band.stopHz) ?? null;
};

export const getBandById = (regionId: BandRegionId, bandId: string): BandPlanEntry | null => {
  const region = getBandRegionPlan(regionId);
  return region.bands.find((band) => band.id === bandId) ?? null;
};

export const clampFrequencyToBandHz = (frequencyHz: number, band: BandPlanEntry): number => {
  return Math.min(band.stopHz, Math.max(band.startHz, Math.round(frequencyHz)));
};

export const snapFrequencyToRasterHz = (
  frequencyHz: number,
  rasterHz: number,
  anchorHz = 0
): number => {
  if (!Number.isFinite(rasterHz) || rasterHz <= 0) {
    return Math.round(frequencyHz);
  }

  const binsFromAnchor = Math.round((frequencyHz - anchorHz) / rasterHz);
  return Math.round(anchorHz + binsFromAnchor * rasterHz);
};

export const defaultStepForModeHz = (mode: InteractionDemodMode): number => {
  return BASE_MODE_STEPS_HZ[mode] ?? 1_000;
};

export const stepForBandModeHz = (
  band: BandPlanEntry | null,
  mode: InteractionDemodMode,
  fallbackHz: number
): number => {
  if (band?.modeStepHz[mode]) {
    return Math.max(1, Math.round(band.modeStepHz[mode] as number));
  }

  if (band?.modeStepHz[band.defaultMode]) {
    return Math.max(1, Math.round(band.modeStepHz[band.defaultMode] as number));
  }

  return Math.max(1, Math.round(fallbackHz));
};

export const validateBandMode = (
  band: BandPlanEntry | null,
  mode: InteractionDemodMode
): { valid: boolean; warning: string | null } => {
  if (!band) {
    return { valid: true, warning: null };
  }

  if (band.allowedModes.includes(mode)) {
    return { valid: true, warning: null };
  }

  return {
    valid: false,
    warning: `${band.label} usually uses ${band.allowedModes.join('/')} mode.`
  };
};
