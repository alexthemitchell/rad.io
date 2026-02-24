import { describe, expect, it } from 'vitest';
import { appendSessionParameterChangeEntry } from './sessionProvenanceTimeline';

describe('appendSessionParameterChangeEntry', () => {
  it('records session offset when session start is provided', () => {
    const sessionStart = 1_772_809_600_000;
    const timeline = appendSessionParameterChangeEntry(
      [],
      'frequency_hz',
      99_900_000,
      100_100_000,
      sessionStart,
      512,
      sessionStart + 275
    );

    expect(timeline).toEqual([
      {
        parameter: 'frequency_hz',
        oldValue: 99_900_000,
        newValue: 100_100_000,
        wallClockMs: sessionStart + 275,
        sessionOffsetMs: 275
      }
    ]);
  });

  it('caps timeline length and retains newest entries', () => {
    let timeline = [] as ReturnType<typeof appendSessionParameterChangeEntry>;

    for (let i = 0; i < 6; i += 1) {
      timeline = appendSessionParameterChangeEntry(
        timeline,
        'fine_tune_hz',
        i * 100,
        (i + 1) * 100,
        null,
        4,
        1_772_809_600_000 + i
      );
    }

    expect(timeline).toHaveLength(4);
    expect(timeline[0].oldValue).toBe(200);
    expect(timeline[3].newValue).toBe(600);
  });

  it('supports clock sync policy change entries', () => {
    const timeline = appendSessionParameterChangeEntry(
      [],
      'clock_sync_policy',
      'audio-stable',
      'rf-accurate',
      null,
      128,
      1_772_809_601_000
    );

    expect(timeline[0].parameter).toBe('clock_sync_policy');
    expect(timeline[0].oldValue).toBe('audio-stable');
    expect(timeline[0].newValue).toBe('rf-accurate');
  });
});
