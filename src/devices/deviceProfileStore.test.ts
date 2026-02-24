import { describe, expect, it, beforeEach } from 'vitest';
import { getStabilityProfile, profileKeyFor, upsertStabilityProfile } from './deviceProfileStore';

describe('deviceProfileStore', () => {
  beforeEach(() => {
    if (!(globalThis as { localStorage?: Storage }).localStorage) {
      const store = new Map<string, string>();
      (globalThis as { localStorage: Storage }).localStorage = {
        get length() {
          return store.size;
        },
        clear() {
          store.clear();
        },
        getItem(key: string) {
          return store.has(key) ? (store.get(key) as string) : null;
        },
        key(index: number) {
          return [...store.keys()][index] ?? null;
        },
        removeItem(key: string) {
          store.delete(key);
        },
        setItem(key: string, value: string) {
          store.set(key, value);
        }
      };
    }

    globalThis.localStorage.clear();
  });

  it('round-trips a stability profile by key', () => {
    const key = profileKeyFor('HACKRF', 'HackRF One');
    upsertStabilityProfile({
      sourceType: 'HACKRF',
      profileKey: key,
      updatedAtUtc: '2026-02-24T00:00:00.000Z',
      driftEstimateHzPerSec: 1.2,
      driftConfidence: 0.8,
      phaseErrorRms: 0.04,
      ppmCorrectionHz: -12.5
    });

    const loaded = getStabilityProfile(key);
    expect(loaded).not.toBeNull();
    expect(loaded?.driftConfidence).toBeCloseTo(0.8, 6);
    expect(loaded?.sourceType).toBe('HACKRF');
  });
});
