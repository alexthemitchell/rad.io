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
      ppmCorrectionHz: -12.5,
      iqIntegrityLastReport: {
        recordedAtUtc: '2026-02-24T00:01:00.000Z',
        status: 'warn',
        findings: ['dc-offset'],
        fixes: ['enable-iq-correction'],
        summary: 'Detected 1 IQ integrity risk signal(s). Apply guided fixes and persist profile if stable.'
      },
      applyOnConnect: {
        enabled: true,
        sampleRateHz: 2_000_000,
        ppmCorrection: -1.5,
        gains: {
          LNA: 24,
          VGA: 20
        }
      },
      calibrationSeed: {
        updatedAtUtc: '2026-02-24T00:02:00.000Z',
        sourceId: 'wfm-pilot-19khz',
        suggestedPpmCorrection: -1.5,
        driftEstimateHzPerSec: 0.22,
        confidence01: 0.78,
        notes: ['Pilot lock stable for 60 s']
      },
      frequencyCalibration: {
        updatedAtUtc: '2026-02-24T00:03:00.000Z',
        sourceId: 'wfm-pilot-19khz',
        readiness: 'ready',
        confidence01: 0.84,
        ppmCorrection: -1.4,
        driftEstimateHzPerSec: 0.2,
        observationSeconds: 72,
        notes: ['Applied after stable lock window']
      }
    });

    const loaded = getStabilityProfile(key);
    expect(loaded).not.toBeNull();
    expect(loaded?.driftConfidence).toBeCloseTo(0.8, 6);
    expect(loaded?.sourceType).toBe('HACKRF');
    expect(loaded?.iqIntegrityLastReport?.status).toBe('warn');
    expect(loaded?.applyOnConnect?.enabled).toBe(true);
    expect(loaded?.applyOnConnect?.gains?.LNA).toBe(24);
    expect(loaded?.calibrationSeed?.sourceId).toBe('wfm-pilot-19khz');
    expect(loaded?.frequencyCalibration?.readiness).toBe('ready');
  });
});
