import type { SigmfFixtureMetadata } from '../fixtures/sigmf/schema';

export type DisclosureCalibrationState = 'uncalibrated' | 'approximate' | 'calibrated';
export type DisclosureTimebaseState = 'internal-or-unknown' | 'external-disciplined';

export type MeasurementUncertaintyModel = {
  schemaVersion: '1.0.0';
  levelUnit: 'relative-dBFS' | 'approximate-dBm';
  frequencyUncertaintyPpm: number | null;
  levelUncertaintyDb: number | null;
  uncertaintyUnknown: boolean;
};

export type MeasurementCalibrationDisclosure = {
  schemaVersion: '1.0.0';
  frequency: {
    state: DisclosureCalibrationState;
    ppmCorrectionApplied: number;
    residualUncertaintyPpm: number | null;
    residualUncertaintyHz: number | null;
  };
  level: {
    state: DisclosureCalibrationState;
    residualUncertaintyDb: number | null;
  };
  timebase: {
    state: DisclosureTimebaseState;
    referenceHz: number | null;
    lockState: 'locked' | 'unlocked' | 'unknown';
  };
  disclosureText: {
    uiBadgeShort: string;
    exportSummary: string;
  };
  uncertaintyModel: MeasurementUncertaintyModel;
};

const round = (value: number, decimals = 3): number => {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
};

const mapCalibrationState = (metadata: SigmfFixtureMetadata | null): DisclosureCalibrationState => {
  if (!metadata) {
    return 'uncalibrated';
  }

  if (metadata.calibrationStatus === 'uncalibrated') {
    return 'uncalibrated';
  }

  if (
    metadata.calibrationStatus === 'user' &&
    metadata.referenceClock?.source &&
    metadata.calibratedFrequencyOffsetHz !== undefined &&
    metadata.calibratedLevelOffsetDb !== undefined
  ) {
    return 'calibrated';
  }

  return 'approximate';
};

const buildSummary = (
  frequencyState: DisclosureCalibrationState,
  levelState: DisclosureCalibrationState,
  frequencyUncertaintyPpm: number | null,
  levelUncertaintyDb: number | null
): { uiBadgeShort: string; exportSummary: string } => {
  const frequencySummary = frequencyUncertaintyPpm === null
    ? `Frequency ${frequencyState}`
    : `Frequency ${frequencyState} (+/-${round(frequencyUncertaintyPpm, 2)} ppm)`;

  const levelSummary = levelUncertaintyDb === null
    ? `Level ${levelState}`
    : `Level ${levelState} (+/-${round(levelUncertaintyDb, 2)} dB)`;

  const uiBadgeShort = frequencyState === 'calibrated' && levelState !== 'uncalibrated'
    ? 'Calibrated'
    : frequencyState === 'uncalibrated' && levelState === 'uncalibrated'
      ? 'Uncalibrated'
      : 'Approximate';

  return {
    uiBadgeShort,
    exportSummary: `${frequencySummary}; ${levelSummary}`
  };
};

export const createMeasurementCalibrationDisclosure = (
  fixtureMetadata?: SigmfFixtureMetadata
): MeasurementCalibrationDisclosure => {
  const metadata = fixtureMetadata ?? null;
  const frequencyState = mapCalibrationState(metadata);
  const levelState = metadata?.calibrationStatus === 'uncalibrated' ? 'uncalibrated' : frequencyState;

  const ppmFromReference = Math.abs(metadata?.referenceClock?.measuredPpm ?? 0);
  const residualUncertaintyPpm = frequencyState === 'uncalibrated'
    ? null
    : round(Math.max(0.15, ppmFromReference + (frequencyState === 'calibrated' ? 0.1 : 1.0)), 3);

  const residualUncertaintyHz = (residualUncertaintyPpm === null || !metadata)
    ? null
    : round((metadata.centerFrequencyHz * residualUncertaintyPpm) / 1_000_000, 3);

  const residualUncertaintyDb = levelState === 'uncalibrated'
    ? null
    : round(frequencyState === 'calibrated' ? 1.0 : 3.0, 2);

  const timebaseState: DisclosureTimebaseState = metadata?.referenceClock?.source === 'gpsdo' || metadata?.referenceClock?.source === 'rubidium'
    ? 'external-disciplined'
    : 'internal-or-unknown';

  const uncertaintyUnknown = residualUncertaintyPpm === null || residualUncertaintyDb === null;
  const levelUnit = levelState === 'uncalibrated' ? 'relative-dBFS' : 'approximate-dBm';

  const disclosureText = buildSummary(frequencyState, levelState, residualUncertaintyPpm, residualUncertaintyDb);

  return {
    schemaVersion: '1.0.0',
    frequency: {
      state: frequencyState,
      ppmCorrectionApplied: metadata?.referenceClock?.measuredPpm ?? 0,
      residualUncertaintyPpm,
      residualUncertaintyHz
    },
    level: {
      state: levelState,
      residualUncertaintyDb
    },
    timebase: {
      state: timebaseState,
      referenceHz: metadata?.referenceClock?.nominalFrequencyHz ?? null,
      lockState: timebaseState === 'external-disciplined' ? 'locked' : 'unknown'
    },
    disclosureText,
    uncertaintyModel: {
      schemaVersion: '1.0.0',
      levelUnit,
      frequencyUncertaintyPpm: residualUncertaintyPpm,
      levelUncertaintyDb: residualUncertaintyDb,
      uncertaintyUnknown
    }
  };
};
