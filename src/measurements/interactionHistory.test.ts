import { describe, expect, it } from 'vitest';
import { appendTuneHistory, swapRecallPair } from './interactionHistory';

describe('interactionHistory', () => {
  it('prepends newest and deduplicates nearby entries', () => {
    const first = {
      tunedAtIso: '2026-02-24T00:00:00.000Z',
      displayFrequencyHz: 145_500_000,
      tunerFrequencyHz: 145_500_000,
      demodMode: 'NFM' as const
    };

    const second = {
      tunedAtIso: '2026-02-24T00:01:00.000Z',
      displayFrequencyHz: 145_500_020,
      tunerFrequencyHz: 145_500_020,
      demodMode: 'NFM' as const
    };

    const history = appendTuneHistory([], first, 6, 50);
    const updated = appendTuneHistory(history, second, 6, 50);

    expect(updated).toHaveLength(1);
    expect(updated[0].displayFrequencyHz).toBe(second.displayFrequencyHz);
  });

  it('swaps recall slots', () => {
    const swapped = swapRecallPair(100, 200);
    expect(swapped.slotAHz).toBe(200);
    expect(swapped.slotBHz).toBe(100);
  });
});
