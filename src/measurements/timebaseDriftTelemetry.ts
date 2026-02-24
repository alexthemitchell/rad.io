import type { SDRSampleClockTruthMode } from '../devices/streamFrame';

export type TimebaseDriftTelemetryInput = {
  streamSampleRateHz: number;
  driftEstimateHzPerSec: number;
  driftConfidence: number;
  phaseErrorRms: number;
  audioResamplerRatio: number;
  audioResamplerRatioDeltaPpm: number;
  audioQueueJitterMs: number;
  clockTruthMode: SDRSampleClockTruthMode | null;
};

export type TimebaseDriftTelemetryAssessment = {
  stable: boolean;
  sampleRateErrorPpm: number;
  driftPpmPerSec: number;
  confidence01: number;
  severity: 'ok' | 'warn';
  summary: string;
  recommendations: string[];
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

export const assessTimebaseDriftTelemetry = (
  input: TimebaseDriftTelemetryInput
): TimebaseDriftTelemetryAssessment => {
  const sampleRateErrorPpm = Number.isFinite(input.audioResamplerRatio)
    ? Math.abs(input.audioResamplerRatio - 1) * 1_000_000
    : 0;
  const streamRate = Number.isFinite(input.streamSampleRateHz) && input.streamSampleRateHz > 0
    ? input.streamSampleRateHz
    : 1;
  const driftPpmPerSec = Math.abs(input.driftEstimateHzPerSec / streamRate) * 1_000_000;
  const confidence01 = clamp01(input.driftConfidence);

  const unstable = sampleRateErrorPpm > 120
    || input.audioResamplerRatioDeltaPpm > 220
    || input.audioQueueJitterMs > 12
    || (confidence01 > 0.4 && driftPpmPerSec > 1.5)
    || (confidence01 > 0.6 && input.phaseErrorRms > 0.35);

  const recommendations = [
    'monitor Diagnostics -> Runtime metrics for queue jitter and ratio drift over a 30s window'
  ];

  if (input.clockTruthMode !== 'disciplined_ref') {
    recommendations.push('treat long-run frequency claims as approximate unless reference discipline is active');
  }

  if (unstable) {
    recommendations.push('switch to Stable latency policy and reduce host load before measurement exports');
  }

  const severity: 'ok' | 'warn' = unstable ? 'warn' : 'ok';
  const stable = !unstable;

  return {
    stable,
    sampleRateErrorPpm,
    driftPpmPerSec,
    confidence01,
    severity,
    summary: stable
      ? `Timebase stable: ratio error ${sampleRateErrorPpm.toFixed(1)} ppm, drift ${driftPpmPerSec.toFixed(2)} ppm/s.`
      : `Timebase drift risk: ratio error ${sampleRateErrorPpm.toFixed(1)} ppm, drift ${driftPpmPerSec.toFixed(2)} ppm/s, jitter ${input.audioQueueJitterMs.toFixed(1)} ms.`,
    recommendations
  };
};
