export type SignalClassHint = 'am-like' | 'fm-like' | 'narrowband-fm-like' | 'digital-ish' | 'bursty' | 'unknown';

export type SignalIdTuningAdvisorInput = {
  peakDbfs: number;
  meanDbfs: number;
  snrEstimateDb: number;
  demodMode: 'WFM' | 'AM' | 'NFM' | 'SAM' | 'USB' | 'LSB' | 'CW';
  bandwidthHz: number;
  dcSpurLevelDbfs: number;
  spurDensity01: number;
};

export type SignalIdTuningAdvisorResult = {
  hint: SignalClassHint;
  confidence01: number;
  recommendedDemodMode: 'WFM' | 'AM' | 'NFM' | 'SAM' | 'USB' | 'LSB' | 'CW';
  recommendedBandwidthHz: number;
  warnings: string[];
  summary: string;
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

export const buildSignalIdTuningAdvisor = (
  input: SignalIdTuningAdvisorInput
): SignalIdTuningAdvisorResult => {
  const spectralSpreadDb = input.peakDbfs - input.meanDbfs;
  const warnings: string[] = [];

  if (input.dcSpurLevelDbfs > -28) {
    warnings.push('dc_spur_or_lo_leakage');
  }
  if (input.spurDensity01 > 0.06) {
    warnings.push('aliasing_or_image_risk');
  }

  let hint: SignalClassHint = 'unknown';
  let confidence01 = 0.25;
  let recommendedDemodMode: SignalIdTuningAdvisorResult['recommendedDemodMode'] = input.demodMode;
  let recommendedBandwidthHz = Math.max(2500, Math.round(input.bandwidthHz));

  if (input.snrEstimateDb > 16 && input.bandwidthHz > 120_000) {
    hint = 'fm-like';
    confidence01 = 0.78;
    recommendedDemodMode = 'WFM';
    recommendedBandwidthHz = 180_000;
  } else if (input.snrEstimateDb > 10 && input.bandwidthHz <= 25_000) {
    hint = 'narrowband-fm-like';
    confidence01 = 0.72;
    recommendedDemodMode = 'NFM';
    recommendedBandwidthHz = 12_500;
  } else if (input.snrEstimateDb > 9 && input.bandwidthHz <= 15_000) {
    hint = 'am-like';
    confidence01 = 0.64;
    recommendedDemodMode = 'AM';
    recommendedBandwidthHz = 10_000;
  } else if (input.spurDensity01 > 0.08 && spectralSpreadDb < 16) {
    hint = 'digital-ish';
    confidence01 = 0.58;
    recommendedDemodMode = 'NFM';
    recommendedBandwidthHz = 12_500;
  } else if (input.snrEstimateDb < 7 && input.spurDensity01 > 0.05) {
    hint = 'bursty';
    confidence01 = 0.46;
    recommendedDemodMode = 'NFM';
    recommendedBandwidthHz = 9_000;
  }

  confidence01 = clamp01(confidence01 - (warnings.length * 0.08));

  return {
    hint,
    confidence01,
    recommendedDemodMode,
    recommendedBandwidthHz,
    warnings,
    summary: `Hint ${hint} (${Math.round(confidence01 * 100)}%): try ${recommendedDemodMode} @ ${Math.round(recommendedBandwidthHz / 1000)} kHz.`
  };
};
