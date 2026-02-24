export type FrontEndOverloadTriageInput = {
  frequencyHz: number;
  fftPeakDb: number;
  fftMeanDb: number;
  elevatedBinCount: number;
  totalBinCount: number;
  clipRisk01: number;
  snrEstimateDb: number;
  hasAttenuatorHint: boolean;
  hasPreampHint: boolean;
};

export type FrontEndOverloadTriageAssessment = {
  overloadLikely: boolean;
  dynamicRangeDegraded: boolean;
  spurDensity01: number;
  noiseFloorRiseDb: number;
  overloadSummary: string;
  dynamicRangeSummary: string;
  overloadActions: string[];
  dynamicRangeActions: string[];
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

const describeBand = (frequencyHz: number): 'hf' | 'vhf' | 'uhf' => {
  if (!Number.isFinite(frequencyHz) || frequencyHz < 30_000_000) {
    return 'hf';
  }

  if (frequencyHz < 300_000_000) {
    return 'vhf';
  }

  return 'uhf';
};

export const assessFrontEndOverloadTriage = (
  input: FrontEndOverloadTriageInput
): FrontEndOverloadTriageAssessment => {
  const spurDensity01 = input.totalBinCount > 0
    ? clamp01(input.elevatedBinCount / input.totalBinCount)
    : 0;
  const noiseFloorRiseDb = Number.isFinite(input.fftPeakDb) && Number.isFinite(input.fftMeanDb)
    ? Math.max(0, input.fftPeakDb - input.fftMeanDb)
    : 0;

  const overloadLikely = (
    (input.fftPeakDb > -8 && spurDensity01 > 0.045)
    || input.clipRisk01 > 0.45
  );

  const dynamicRangeDegraded = overloadLikely
    || (noiseFloorRiseDb > 28 && spurDensity01 > 0.03)
    || (input.snrEstimateDb < 14 && spurDensity01 > 0.05)
    || (input.clipRisk01 > 0.35 && input.snrEstimateDb < 18);

  const overloadActions = ['reduce RF gain by one step and observe clip-risk change'];
  const dynamicRangeActions = [
    'watch Diagnostics -> Runtime metrics while applying one change at a time',
    'if spur density stays high, narrow bandwidth and shift LO to move image/DC artifacts'
  ];

  if (!input.hasAttenuatorHint) {
    overloadActions.push('add 6-12 dB attenuation ahead of the SDR front-end');
  }

  if (input.hasPreampHint) {
    overloadActions.push('disable or reduce external preamp gain temporarily');
  }

  const band = describeBand(input.frequencyHz);
  if (band === 'hf') {
    overloadActions.push('enable high-pass or MW broadcast reject filtering for HF strong-signal scenes');
  } else if (band === 'vhf') {
    overloadActions.push('enable FM broadcast notch or VHF band-pass filtering');
  } else {
    overloadActions.push('use UHF preselection filtering and check nearby cellular downlink overload');
  }

  const overloadSummary = overloadLikely
    ? `Overload likely: peak ${input.fftPeakDb.toFixed(1)} dBFS, clip-risk ${(input.clipRisk01 * 100).toFixed(0)}%, spur density ${(spurDensity01 * 100).toFixed(1)}%.`
    : `No strong overload indicators: peak ${input.fftPeakDb.toFixed(1)} dBFS, clip-risk ${(input.clipRisk01 * 100).toFixed(0)}%.`;

  const dynamicRangeSummary = dynamicRangeDegraded
    ? `Dynamic range degraded: noise-floor spread ${noiseFloorRiseDb.toFixed(1)} dB, SNR ${input.snrEstimateDb.toFixed(1)} dB, spur density ${(spurDensity01 * 100).toFixed(1)}%.`
    : `Dynamic range looks stable: spread ${noiseFloorRiseDb.toFixed(1)} dB, SNR ${input.snrEstimateDb.toFixed(1)} dB.`;

  return {
    overloadLikely,
    dynamicRangeDegraded,
    spurDensity01,
    noiseFloorRiseDb,
    overloadSummary,
    dynamicRangeSummary,
    overloadActions,
    dynamicRangeActions
  };
};
