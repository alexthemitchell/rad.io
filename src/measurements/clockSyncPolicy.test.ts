import { describe, expect, it } from 'vitest';
import { deriveTargetQueueMs, describeClockSyncPolicy } from './clockSyncPolicy';

describe('clock sync policy', () => {
  it('derives queue targets with explicit policy tradeoff', () => {
    expect(deriveTargetQueueMs('low-latency', 'audio-stable')).toBe(60);
    expect(deriveTargetQueueMs('low-latency', 'rf-accurate')).toBe(40);
    expect(deriveTargetQueueMs('stable', 'audio-stable')).toBe(120);
    expect(deriveTargetQueueMs('stable', 'rf-accurate')).toBe(100);
  });

  it('describes both sync policy modes', () => {
    expect(describeClockSyncPolicy('audio-stable')).toContain('Audio-stable');
    expect(describeClockSyncPolicy('rf-accurate')).toContain('RF-accurate');
  });
});
