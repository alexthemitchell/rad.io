import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDefaultBandCalibrationProfile,
  exportCalibrationBundle,
  getAmplitudeCalibration,
  getBandCalibrationProfile,
  resolveCalibrationBandId,
  upsertAmplitudeCalibration,
  upsertBandCalibrationProfile
} from './amplitudeCalibrationStore';

const installLocalStorage = (): void => {
  if ((globalThis as { localStorage?: Storage }).localStorage) {
    globalThis.localStorage.clear();
    return;
  }

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
};

describe('amplitudeCalibrationStore', () => {
  beforeEach(() => {
    installLocalStorage();
    globalThis.localStorage.clear();
  });

  it('resolves HF/VHF/UHF calibration bands by frequency', () => {
    expect(resolveCalibrationBandId(7_100_000)).toBe('hf');
    expect(resolveCalibrationBandId(145_000_000)).toBe('vhf');
    expect(resolveCalibrationBandId(915_000_000)).toBe('uhf');
  });

  it('stores and loads per-device per-band amplitude calibration blobs', () => {
    upsertAmplitudeCalibration({
      updatedAtUtc: '2026-02-25T00:00:00.000Z',
      deviceProfileKey: 'HACKRF:hackrf-one',
      bandId: 'vhf',
      sourceId: 'noaa-weather-carrier',
      centerFrequencyHz: 162_550_000,
      sampleRateHz: 2_000_000,
      dbfsToDbmOffset: -70.2,
      dbfsToDbuvOffset: 36.8,
      uncertaintyDb: 2.7,
      baselineNoiseDbfs: -102,
      gainDbByStage: { LNA: 16, VGA: 20 },
      rfChainProfileId: 'mobile-vhf',
      notes: ['Bench verified against service monitor']
    });

    const loaded = getAmplitudeCalibration('HACKRF:hackrf-one', 'vhf');
    expect(loaded).not.toBeNull();
    expect(loaded?.dbfsToDbmOffset).toBeCloseTo(-70.2, 6);
    expect(loaded?.gainDbByStage.LNA).toBe(16);
  });

  it('stores band profile defaults and exports full bundle', () => {
    const profile = createDefaultBandCalibrationProfile('uhf', 'lab-signal-generator');
    upsertBandCalibrationProfile('RTLSDR:rtlsdr', profile);

    const loaded = getBandCalibrationProfile('RTLSDR:rtlsdr', 'uhf');
    expect(loaded).not.toBeNull();
    expect(loaded?.autoApply).toBe(true);
    expect(loaded?.targetUncertaintyDb).toBeGreaterThan(0);

    const bundle = exportCalibrationBundle('RTLSDR:rtlsdr');
    expect(bundle.schemaVersion).toBe('1.0.0');
    expect(bundle.bandProfiles).toHaveLength(1);
  });
});
