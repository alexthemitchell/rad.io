import { describe, expect, it } from 'vitest';
import { appendHeardHistory, appendTuneHistory, swapRecallPair } from './interactionHistory';

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

  it('prepends heard entries and deduplicates nearby heard frequencies', () => {
    const first = {
      heardAtIso: '2026-02-25T00:00:00.000Z',
      displayFrequencyHz: 162_550_000,
      demodMode: 'NFM' as const,
      snrEstimateDb: 11.2,
      lockState: 'locked' as const
    };

    const second = {
      heardAtIso: '2026-02-25T00:00:05.000Z',
      displayFrequencyHz: 162_550_180,
      demodMode: 'NFM' as const,
      snrEstimateDb: 12.1,
      lockState: 'locked' as const
    };

    const history = appendHeardHistory([], first, 6, 500);
    const updated = appendHeardHistory(history, second, 6, 500);

    expect(updated).toHaveLength(1);
    expect(updated[0].heardAtIso).toBe(second.heardAtIso);
  });
});
