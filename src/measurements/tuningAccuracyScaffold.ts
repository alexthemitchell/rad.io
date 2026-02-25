import {
  evaluateRetuneAccuracyWindow,
  evaluateTuningAccuracyCase,
  type TuningAccuracyCase,
  type TuningAccuracyCaseResult
} from './tuningAccuracy';

export type TuningAccuracyScenarioSource = 'sim-fixture' | 'real-device';

export type TuningAccuracyScenarioPoint = {
  label: string;
  requestedFrequencyHz: number;
  observedFrequencyHz: number;
  dwellMs?: number;
};

export type TuningAccuracyScenario = {
  scenarioId: string;
  source: TuningAccuracyScenarioSource;
  afcEnabled: boolean;
  ppmTolerance: number;
  absoluteToleranceHz: number;
  capturedAtIso?: string;
  points: TuningAccuracyScenarioPoint[];
};

export type TuningAccuracyScenarioReport = {
  scenarioId: string;
  source: TuningAccuracyScenarioSource;
  capturedAtIso: string;
  total: number;
  failures: number;
  passed: boolean;
  worstErrorHz: number;
  worstErrorPpm: number;
  caseResults: Array<TuningAccuracyCaseResult & { label: string }>;
};

const toCaseInput = (
  scenario: TuningAccuracyScenario,
  point: TuningAccuracyScenarioPoint
): TuningAccuracyCase => {
  return {
    requestedFrequencyHz: point.requestedFrequencyHz,
    observedFrequencyHz: point.observedFrequencyHz,
    ppmTolerance: scenario.ppmTolerance,
    absoluteToleranceHz: scenario.absoluteToleranceHz,
    afcEnabled: scenario.afcEnabled
  };
};

export const evaluateTuningAccuracyScenario = (scenario: TuningAccuracyScenario): TuningAccuracyScenarioReport => {
  const caseResults = scenario.points.map((point) => {
    const result = evaluateTuningAccuracyCase(toCaseInput(scenario, point));
    return {
      label: point.label,
      ...result
    };
  });

  const aggregate = evaluateRetuneAccuracyWindow(scenario.points.map((point) => toCaseInput(scenario, point)));

  return {
    scenarioId: scenario.scenarioId,
    source: scenario.source,
    capturedAtIso: scenario.capturedAtIso ?? new Date().toISOString(),
    total: aggregate.total,
    failures: aggregate.failures,
    passed: aggregate.passed,
    worstErrorHz: aggregate.worstErrorHz,
    worstErrorPpm: aggregate.worstErrorPpm,
    caseResults
  };
};

export const createSimTuningAccuracyScenario = (): TuningAccuracyScenario => {
  return {
    scenarioId: 'sim-golden-tone-retune-v1',
    source: 'sim-fixture',
    afcEnabled: false,
    ppmTolerance: 2,
    absoluteToleranceHz: 120,
    capturedAtIso: 'fixture',
    points: [
      { label: 'fm-beacon-98m1', requestedFrequencyHz: 98_100_000, observedFrequencyHz: 98_100_082 },
      { label: 'uhf-weather-162m55', requestedFrequencyHz: 162_550_000, observedFrequencyHz: 162_550_106 },
      { label: 'vhf-airband-119m1', requestedFrequencyHz: 119_100_000, observedFrequencyHz: 119_099_943 }
    ]
  };
};

export const createRealDeviceTuningAccuracyScenarioScaffold = (scenarioId = 'real-hackrf-retune-v1'): TuningAccuracyScenario => {
  return {
    scenarioId,
    source: 'real-device',
    afcEnabled: false,
    ppmTolerance: 3,
    absoluteToleranceHz: 180,
    points: []
  };
};
