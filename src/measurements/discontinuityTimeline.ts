import type { SDRDiscontinuityEvent, SDRStreamFrame } from '../devices/streamFrame';

export type DiscontinuityTimelineEntry = {
  sequence: number;
  sampleIndex: number;
  cause: SDRDiscontinuityEvent['cause'];
  droppedSamples: number;
  wallClockMs: number | null;
  sessionOffsetMs: number | null;
};

export const appendDiscontinuityTimelineEntry = (
  current: DiscontinuityTimelineEntry[],
  frame: SDRStreamFrame,
  sessionStartedUnixMs: number | null,
  maxEntries = 256
): DiscontinuityTimelineEntry[] => {
  if (!frame.discontinuity) {
    return current;
  }

  const wallClockMs = typeof frame.discontinuity.wallClockMs === 'number'
    ? frame.discontinuity.wallClockMs
    : null;

  const sessionOffsetMs =
    typeof wallClockMs === 'number' && typeof sessionStartedUnixMs === 'number'
      ? Math.max(0, wallClockMs - sessionStartedUnixMs)
      : null;

  const next: DiscontinuityTimelineEntry = {
    sequence: frame.discontinuity.sequence,
    sampleIndex: frame.discontinuity.sampleIndex,
    cause: frame.discontinuity.cause,
    droppedSamples: frame.discontinuity.droppedSamples ?? frame.droppedSamples,
    wallClockMs,
    sessionOffsetMs
  };

  const withNext = [...current, next];
  if (withNext.length <= maxEntries) {
    return withNext;
  }

  return withNext.slice(withNext.length - maxEntries);
};
