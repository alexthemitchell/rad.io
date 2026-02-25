import type { ClockSyncPolicy } from './clockSyncPolicy';
import type { SDRSampleClockTruthMode } from '../devices/streamFrame';

export type TimebaseModelInput = {
  sampleClockTruthMode: SDRSampleClockTruthMode | null;
  clockSyncPolicy: ClockSyncPolicy;
  streamSampleRateHz: number;
  driftEstimateHzPerSec: number;
  driftConfidence01: number;
  phaseErrorRms: number;
  audioResamplerRatio: number;
  audioResamplerRatioDeltaPpm: number;
  audioQueueJitterMs: number;
};

export type TimebaseModelState = {
  clockSyncPolicy: ClockSyncPolicy;
  sampleClockTruthMode: SDRSampleClockTruthMode | 'unknown';
  streamSampleRateHz: number;
  driftEstimateHzPerSec: number;
  driftConfidence01: number;
  phaseErrorRms: number;
  audioResamplerRatio: number;
  audioResamplerRatioDeltaPpm: number;
  audioQueueJitterMs: number;
  integrity: 'stable' | 'degraded' | 'unknown';
  summary: string;
};

export const buildTimebaseModelState = (input: TimebaseModelInput): TimebaseModelState => {
  const mode = input.sampleClockTruthMode ?? 'unknown';

  const highDrift = Math.abs(input.driftEstimateHzPerSec) > 2;
  const lowConfidence = input.driftConfidence01 < 0.5;
  const unstableQueue = input.audioQueueJitterMs > 20;
  const largeAudioDelta = Math.abs(input.audioResamplerRatioDeltaPpm) > 150;

  const degraded = highDrift || lowConfidence || unstableQueue || largeAudioDelta;

  const summary = mode === 'unknown'
    ? 'Sample-clock truth mode is unknown; frequency claims should remain approximate.'
    : degraded
      ? `Timebase shows instability signals (drift ${input.driftEstimateHzPerSec.toFixed(2)} Hz/s, delta ${input.audioResamplerRatioDeltaPpm.toFixed(1)} ppm).`
      : `Timebase is stable in ${mode} mode with ${input.driftConfidence01.toFixed(2)} drift confidence.`;

  return {
    clockSyncPolicy: input.clockSyncPolicy,
    sampleClockTruthMode: mode,
    streamSampleRateHz: input.streamSampleRateHz,
    driftEstimateHzPerSec: input.driftEstimateHzPerSec,
    driftConfidence01: input.driftConfidence01,
    phaseErrorRms: input.phaseErrorRms,
    audioResamplerRatio: input.audioResamplerRatio,
    audioResamplerRatioDeltaPpm: input.audioResamplerRatioDeltaPpm,
    audioQueueJitterMs: input.audioQueueJitterMs,
    integrity: mode === 'unknown' ? 'unknown' : degraded ? 'degraded' : 'stable',
    summary
  };
};
