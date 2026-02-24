export type LatencyPolicy = 'low-latency' | 'stable';
export type ClockSyncPolicy = 'audio-stable' | 'rf-accurate';

export const deriveTargetQueueMs = (
  latencyPolicy: LatencyPolicy,
  clockSyncPolicy: ClockSyncPolicy
): number => {
  const base = latencyPolicy === 'low-latency' ? 60 : 120;
  if (clockSyncPolicy === 'rf-accurate') {
    // Lower queue target reduces smoothing and keeps RF-timed changes more immediate.
    return Math.max(40, base - 20);
  }
  return base;
};

export const describeClockSyncPolicy = (policy: ClockSyncPolicy): string => {
  if (policy === 'rf-accurate') {
    return 'RF-accurate: prioritizes RF/sample-clock fidelity and faster correction response; audio smoothness may decrease under jitter.';
  }

  return 'Audio-stable: prioritizes smooth playback and jitter tolerance; small RF timing corrections may converge more slowly.';
};
