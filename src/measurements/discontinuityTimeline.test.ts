import { describe, expect, it } from 'vitest';
import { appendDiscontinuityTimelineEntry } from './discontinuityTimeline';
import type { SDRStreamFrame } from '../devices/streamFrame';

const makeFrame = (overrides?: Partial<SDRStreamFrame>): SDRStreamFrame => ({
  sequence: 0,
  sampleIndex: 0,
  sampleCount: 256,
  timestampNs: 0,
  sampleRate: 2_000_000,
  droppedSamples: 0,
  sampleClock: { truthMode: 'unknown' },
  ...overrides
});

describe('appendDiscontinuityTimelineEntry', () => {
  it('ignores frames that do not carry discontinuity metadata', () => {
    const timeline = appendDiscontinuityTimelineEntry([], makeFrame(), 1_700_000_000_000);
    expect(timeline).toHaveLength(0);
  });

  it('captures discontinuity fields and derives session offset', () => {
    const sessionStartedUnixMs = 1_772_809_600_000;
    const frame = makeFrame({
      sequence: 8,
      sampleIndex: 16_384,
      droppedSamples: 4_096,
      discontinuity: {
        cause: 'dropped_samples',
        sequence: 8,
        sampleIndex: 16_384,
        droppedSamples: 4_096,
        wallClockMs: sessionStartedUnixMs + 275
      }
    });

    const timeline = appendDiscontinuityTimelineEntry([], frame, sessionStartedUnixMs);
    expect(timeline).toEqual([
      {
        sequence: 8,
        sampleIndex: 16_384,
        cause: 'dropped_samples',
        droppedSamples: 4_096,
        wallClockMs: sessionStartedUnixMs + 275,
        sessionOffsetMs: 275
      }
    ]);
  });

  it('keeps only the newest entries when timeline exceeds cap', () => {
    const base = 1_772_809_600_000;
    let timeline = [] as ReturnType<typeof appendDiscontinuityTimelineEntry>;

    for (let i = 0; i < 6; i += 1) {
      timeline = appendDiscontinuityTimelineEntry(
        timeline,
        makeFrame({
          sequence: i,
          sampleIndex: i * 512,
          discontinuity: {
            cause: 'retune',
            sequence: i,
            sampleIndex: i * 512,
            wallClockMs: base + i
          }
        }),
        base,
        4
      );
    }

    expect(timeline).toHaveLength(4);
    expect(timeline[0].sequence).toBe(2);
    expect(timeline[3].sequence).toBe(5);
  });
});
