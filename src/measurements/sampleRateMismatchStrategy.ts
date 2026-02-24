export type SampleRateMismatchInput = {
  deviceIqSampleRateHz: number;
  dspInputSampleRateHz: number;
  dspOutputSampleRateHz: number;
  audioResamplerRatio: number;
  audioResamplerRatioDeltaPpm: number;
};

export type SampleRateMismatchAssessment = {
  severity: 'ok' | 'warn';
  estimatedOsOutputRateHz: number;
  mismatchPpm: number;
  summary: string;
  recommendations: string[];
};

const sanitizePositive = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
};

export const assessSampleRateMismatchStrategy = (
  input: SampleRateMismatchInput
): SampleRateMismatchAssessment => {
  const deviceIqSampleRateHz = sanitizePositive(input.deviceIqSampleRateHz, 2_000_000);
  const dspInputSampleRateHz = sanitizePositive(input.dspInputSampleRateHz, deviceIqSampleRateHz);
  const dspOutputSampleRateHz = sanitizePositive(input.dspOutputSampleRateHz, 50_000);
  const ratio = sanitizePositive(input.audioResamplerRatio, 1);

  const estimatedOsOutputRateHz = dspOutputSampleRateHz * ratio;
  const mismatchPpm = Math.abs((estimatedOsOutputRateHz - dspOutputSampleRateHz) / dspOutputSampleRateHz) * 1_000_000;

  const severity: 'ok' | 'warn' = mismatchPpm > 120 || input.audioResamplerRatioDeltaPpm > 220 ? 'warn' : 'ok';

  const recommendations = [
    `Device IQ ${Math.round(deviceIqSampleRateHz / 1_000)} kHz -> DSP in ${Math.round(dspInputSampleRateHz / 1_000)} kHz -> DSP out ${Math.round(dspOutputSampleRateHz / 1_000)} kHz.`
  ];

  if (severity === 'warn') {
    recommendations.push('Prefer Stable latency policy when output is forced near 48 kHz and ratio drift remains elevated.');
  } else {
    recommendations.push('Current resampler ratio is bounded; forced-48 kHz hosts should remain stable.');
  }

  return {
    severity,
    estimatedOsOutputRateHz,
    mismatchPpm,
    summary: `Audio output estimate ${estimatedOsOutputRateHz.toFixed(1)} Hz (ratio ${ratio.toFixed(6)}), mismatch ${mismatchPpm.toFixed(1)} ppm.`,
    recommendations
  };
};
