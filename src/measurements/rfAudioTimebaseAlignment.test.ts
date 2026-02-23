import { describe, expect, it } from 'vitest';
import { createRfAudioTimebaseAlignmentSnapshot } from './rfAudioTimebaseAlignment';

describe('createRfAudioTimebaseAlignmentSnapshot', () => {
  it('computes baseline RF-to-audio mapping and bounded drift estimate', () => {
    const snapshot = createRfAudioTimebaseAlignmentSnapshot({
      streamSessionStartedUnixMs: 1_772_809_600_000,
      exportUnixMs: 1_772_809_606_000,
      lastFrameSequence: 24,
      lastFrameSampleIndex: 12_000_000,
      lastFrameTimestampNs: 6_000_000_000,
      lastFrameSampleRate: 2_000_000,
      audioQueueAheadMs: 110,
      audioUnderruns: 0,
      sampleClockTruthMode: 'unknown'
    });

    expect(snapshot.modelVersion).toBe(1);
    expect(snapshot.rf.elapsedMsFromSampleClock).toBe(6_000);
    expect(snapshot.audio.estimatedPlaybackHeadMs).toBe(6_110);
    expect(snapshot.drift.estimatedPpm).toBeCloseTo(18_333.333, 3);
    expect(snapshot.drift.bounded).toBe(false);
    expect(snapshot.truth.confidence).toBe('relative-only');
  });

  it('handles missing session anchors without inventing drift', () => {
    const snapshot = createRfAudioTimebaseAlignmentSnapshot({
      streamSessionStartedUnixMs: null,
      exportUnixMs: 1_772_809_606_000,
      lastFrameSequence: null,
      lastFrameSampleIndex: null,
      lastFrameTimestampNs: null,
      lastFrameSampleRate: null,
      audioQueueAheadMs: 90,
      audioUnderruns: 2,
      sampleClockTruthMode: 'disciplined_ref'
    });

    expect(snapshot.audio.estimatedPlaybackHeadMs).toBeNull();
    expect(snapshot.drift.estimatedPpm).toBeNull();
    expect(snapshot.drift.bounded).toBe(true);
    expect(snapshot.truth.confidence).toBe('disciplined');
  });
});
