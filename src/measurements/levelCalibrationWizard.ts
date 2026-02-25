import type { CalibrationBandId } from './amplitudeCalibrationStore';

export type LevelCalibrationInput = {
  sourceId: string;
  bandId: CalibrationBandId;
  observedSignalDbfs: number;
  expectedSignalDbm: number;
  observedNoiseFloorDbfs: number;
  observationSeconds: number;
  driftConfidence01: number;
  lockStable: boolean;
  rfChainNetGainDb: number;
};

export type LevelCalibrationAssessment = {
  readiness: 'ready' | 'needs-more-evidence';
  confidence01: number;
  uncertaintyDb: number;
  dbfsToDbmOffset: number;
  dbfsToDbuvOffset: number;
  baselineNoiseDbfs: number;
  summary: string;
  actions: string[];
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

export const runLevelCalibrationWizard = (input: LevelCalibrationInput): LevelCalibrationAssessment => {
  const observationScore = clamp01(input.observationSeconds / 45);
  const driftScore = clamp01(input.driftConfidence01);
  const lockScore = input.lockStable ? 1 : 0.5;
  const snrDb = input.observedSignalDbfs - input.observedNoiseFloorDbfs;
  const snrScore = clamp01((snrDb - 12) / 28);

  const confidence01 = clamp01((observationScore * 0.25) + (driftScore * 0.35) + (lockScore * 0.2) + (snrScore * 0.2));
  const readiness = confidence01 >= 0.65 ? 'ready' : 'needs-more-evidence';

  const dbfsToDbmOffset = input.expectedSignalDbm - input.observedSignalDbfs;
  const dbfsToDbuvOffset = dbfsToDbmOffset + 106.99;

  const confidencePenalty = (1 - confidence01) * 5;
  const chainPenalty = Math.min(3, Math.abs(input.rfChainNetGainDb) * 0.12);
  const uncertaintyDb = Math.max(1.5, Number((1.2 + confidencePenalty + chainPenalty).toFixed(2)));

  const actions: string[] = [];
  if (snrDb < 16) {
    actions.push('Increase calibration signal SNR before storing level mapping.');
  }
  if (!input.lockStable) {
    actions.push('Wait for lock stability before accepting quasi-absolute level mapping.');
  }
  if (input.observationSeconds < 30) {
    actions.push('Collect at least 30 s of stable samples for stronger uncertainty bounds.');
  }

  const summary = readiness === 'ready'
    ? `Level calibration is ready with ${uncertaintyDb.toFixed(1)} dB uncertainty.`
    : `Level calibration needs more evidence (${(confidence01 * 100).toFixed(0)}% confidence).`;

  return {
    readiness,
    confidence01,
    uncertaintyDb,
    dbfsToDbmOffset,
    dbfsToDbuvOffset,
    baselineNoiseDbfs: input.observedNoiseFloorDbfs,
    summary,
    actions
  };
};
