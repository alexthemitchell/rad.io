export type TuningAccuracyCase = {
  requestedFrequencyHz: number;
  observedFrequencyHz: number;
  ppmTolerance: number;
  absoluteToleranceHz: number;
  afcEnabled: boolean;
};

export type TuningAccuracyCaseResult = {
  passed: boolean;
  errorHz: number;
  errorPpm: number;
  toleranceHz: number;
};

export const computeFrequencyErrorPpm = (requestedFrequencyHz: number, observedFrequencyHz: number): number => {
  const denom = Math.max(1, Math.abs(requestedFrequencyHz));
  return ((observedFrequencyHz - requestedFrequencyHz) / denom) * 1_000_000;
};

export const evaluateTuningAccuracyCase = (input: TuningAccuracyCase): TuningAccuracyCaseResult => {
  const errorHz = input.observedFrequencyHz - input.requestedFrequencyHz;
  const errorPpm = computeFrequencyErrorPpm(input.requestedFrequencyHz, input.observedFrequencyHz);
  const ppmBudgetHz = (Math.abs(input.requestedFrequencyHz) * Math.max(0, input.ppmTolerance)) / 1_000_000;

  // AFC can absorb part of the static offset; still keep a bounded floor tolerance.
  const afcBonusHz = input.afcEnabled ? Math.min(40, ppmBudgetHz * 0.25) : 0;
  const toleranceHz = Math.max(1, input.absoluteToleranceHz, ppmBudgetHz + afcBonusHz);

  return {
    passed: Math.abs(errorHz) <= toleranceHz,
    errorHz,
    errorPpm,
    toleranceHz
  };
};

export const evaluateRetuneAccuracyWindow = (cases: TuningAccuracyCase[]): {
  passed: boolean;
  total: number;
  failures: number;
  worstErrorHz: number;
  worstErrorPpm: number;
} => {
  if (cases.length === 0) {
    return {
      passed: true,
      total: 0,
      failures: 0,
      worstErrorHz: 0,
      worstErrorPpm: 0
    };
  }

  const results = cases.map((entry) => evaluateTuningAccuracyCase(entry));
  const failures = results.filter((result) => !result.passed).length;
  const worst = results.reduce((current, candidate) => {
    if (Math.abs(candidate.errorHz) > Math.abs(current.errorHz)) {
      return candidate;
    }
    return current;
  }, results[0]);

  return {
    passed: failures === 0,
    total: results.length,
    failures,
    worstErrorHz: worst.errorHz,
    worstErrorPpm: worst.errorPpm
  };
};
