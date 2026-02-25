export type CalibrationSourceId =
  | 'wfm-pilot-19khz'
  | 'noaa-weather-carrier'
  | 'wwv-chu-timebase'
  | 'lab-signal-generator';

export type CalibrationSourceCatalogEntry = {
  id: CalibrationSourceId;
  label: string;
  category: 'broadcast' | 'timebase' | 'lab';
  expectedSNRDb: number;
  minimumObservationSeconds: number;
  prerequisites: string[];
  notes: string[];
};

export type CalibrationWizardInput = {
  sourceId: CalibrationSourceId;
  observedSNRDb: number;
  observationSeconds: number;
  lockStable: boolean;
  driftEstimateHzPerSec: number;
};

export type CalibrationWizardAssessment = {
  source: CalibrationSourceCatalogEntry;
  readiness: 'ready' | 'needs-more-evidence';
  confidence01: number;
  suggestedPpmCorrection: number;
  summary: string;
  actions: string[];
};

export type FrequencyCalibrationResult = {
  updatedAtUtc: string;
  sourceId: CalibrationSourceId;
  readiness: CalibrationWizardAssessment['readiness'];
  confidence01: number;
  ppmCorrection: number;
  driftEstimateHzPerSec: number;
  observationSeconds: number;
  notes: string[];
};

export const CALIBRATION_SOURCE_CATALOG: readonly CalibrationSourceCatalogEntry[] = [
  {
    id: 'wfm-pilot-19khz',
    label: 'WFM stereo pilot (19 kHz)',
    category: 'broadcast',
    expectedSNRDb: 14,
    minimumObservationSeconds: 30,
    prerequisites: [
      'Tune a stable local FM broadcast station with stereo pilot visible',
      'Keep AFC disabled during measurement window'
    ],
    notes: ['Good field baseline for VHF consumer receivers']
  },
  {
    id: 'noaa-weather-carrier',
    label: 'NOAA weather carrier',
    category: 'broadcast',
    expectedSNRDb: 16,
    minimumObservationSeconds: 45,
    prerequisites: [
      'Use narrowband FM mode and lock onto a single NOAA transmitter',
      'Avoid mobile antenna movement during capture'
    ],
    notes: ['Useful in North America when time beacons are weak']
  },
  {
    id: 'wwv-chu-timebase',
    label: 'WWV/CHU time beacon',
    category: 'timebase',
    expectedSNRDb: 10,
    minimumObservationSeconds: 60,
    prerequisites: [
      'Select AM/SAM mode with stable carrier lock',
      'Observe long enough to average short-term fading'
    ],
    notes: ['Best for HF drift trend estimation']
  },
  {
    id: 'lab-signal-generator',
    label: 'Lab signal generator',
    category: 'lab',
    expectedSNRDb: 20,
    minimumObservationSeconds: 20,
    prerequisites: [
      'Generator reference should be known and warmed up',
      'Use attenuation to avoid front-end clipping'
    ],
    notes: ['Highest confidence path when external equipment is available']
  }
] as const;

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

const resolveSource = (sourceId: CalibrationSourceId): CalibrationSourceCatalogEntry => {
  const source = CALIBRATION_SOURCE_CATALOG.find((entry) => entry.id === sourceId);
  if (!source) {
    return CALIBRATION_SOURCE_CATALOG[0];
  }

  return source;
};

export const runFrequencyCalibrationWizard = (
  input: CalibrationWizardInput
): CalibrationWizardAssessment => {
  const source = resolveSource(input.sourceId);
  const snrHeadroomDb = input.observedSNRDb - source.expectedSNRDb;
  const snrScore = clamp01(0.5 + (snrHeadroomDb / 20));
  const observationScore = clamp01(input.observationSeconds / source.minimumObservationSeconds);
  const lockScore = input.lockStable ? 1 : 0.45;
  const driftPenalty = clamp01(Math.abs(input.driftEstimateHzPerSec) / 4);

  const confidence01 = clamp01((snrScore * 0.35) + (observationScore * 0.3) + (lockScore * 0.25) - (driftPenalty * 0.2));
  const readiness = confidence01 >= 0.65 ? 'ready' : 'needs-more-evidence';

  const actions: string[] = [];
  if (input.observedSNRDb < source.expectedSNRDb) {
    actions.push('Increase SNR before calibration (gain, antenna, or narrower bandwidth).');
  }
  if (input.observationSeconds < source.minimumObservationSeconds) {
    actions.push(`Collect at least ${source.minimumObservationSeconds} s for this source.`);
  }
  if (!input.lockStable) {
    actions.push('Wait for lock state to stabilize before storing correction.');
  }
  if (Math.abs(input.driftEstimateHzPerSec) > 2.5) {
    actions.push('Large drift detected. Capture additional window and check thermal/reference stability.');
  }

  const suggestedPpmCorrection = Number.isFinite(input.driftEstimateHzPerSec)
    ? Math.max(-100, Math.min(100, -input.driftEstimateHzPerSec * 0.35))
    : 0;

  const summary = readiness === 'ready'
    ? `Calibration evidence is sufficient (${(confidence01 * 100).toFixed(0)}% confidence).`
    : `Calibration needs more evidence (${(confidence01 * 100).toFixed(0)}% confidence).`;

  return {
    source,
    readiness,
    confidence01,
    suggestedPpmCorrection,
    summary,
    actions
  };
};

export const canApplySuggestedPpm = (assessment: CalibrationWizardAssessment): boolean => {
  return assessment.readiness === 'ready' && assessment.confidence01 >= 0.65;
};

export const buildFrequencyCalibrationResult = (input: {
  assessedAtUtc: string;
  assessment: CalibrationWizardAssessment;
  driftEstimateHzPerSec: number;
  observationSeconds: number;
}): FrequencyCalibrationResult => {
  return {
    updatedAtUtc: input.assessedAtUtc,
    sourceId: input.assessment.source.id,
    readiness: input.assessment.readiness,
    confidence01: input.assessment.confidence01,
    ppmCorrection: input.assessment.suggestedPpmCorrection,
    driftEstimateHzPerSec: input.driftEstimateHzPerSec,
    observationSeconds: Math.max(0, Math.round(input.observationSeconds)),
    notes: [...input.assessment.actions]
  };
};
