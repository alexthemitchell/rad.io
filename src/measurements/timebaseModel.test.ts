import { describe, expect, it } from 'vitest';
import { buildTimebaseModelState } from './timebaseModel';

describe('timebaseModel', () => {
  it('reports unknown integrity when truth mode is unavailable', () => {
    const state = buildTimebaseModelState({
      sampleClockTruthMode: null,
      clockSyncPolicy: 'audio-stable',
      streamSampleRateHz: 2_000_000,
      driftEstimateHzPerSec: 0,
      driftConfidence01: 0,
      phaseErrorRms: 0,
      audioResamplerRatio: 1,
      audioResamplerRatioDeltaPpm: 0,
      audioQueueJitterMs: 0
    });

    expect(state.integrity).toBe('unknown');
  });

  it('marks degraded integrity when drift and audio deltas exceed limits', () => {
    const state = buildTimebaseModelState({
      sampleClockTruthMode: 'disciplined_ref',
      clockSyncPolicy: 'rf-accurate',
      streamSampleRateHz: 2_000_000,
      driftEstimateHzPerSec: 3.1,
      driftConfidence01: 0.4,
      phaseErrorRms: 0.2,
      audioResamplerRatio: 0.998,
      audioResamplerRatioDeltaPpm: 210,
      audioQueueJitterMs: 24
    });

    expect(state.integrity).toBe('degraded');
  });
});
