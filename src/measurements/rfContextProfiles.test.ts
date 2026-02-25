import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyRfChainProfileToFrequencyMapping,
  buildRfChainProfileFromContext,
  createDefaultAntennaFrontEndContext,
  listAntennaFrontEndProfiles,
  listRfChainProfiles,
  upsertAntennaFrontEndProfile,
  upsertRfChainProfile
} from './rfContextProfiles';

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

describe('rfContextProfiles', () => {
  beforeEach(() => {
    installLocalStorage();
    globalThis.localStorage.clear();
  });

  it('round-trips antenna/front-end context profiles by device key', () => {
    const context = createDefaultAntennaFrontEndContext();
    context.antennaName = 'Roof VHF Dipole';

    upsertAntennaFrontEndProfile({
      id: 'roof-vhf',
      name: 'Roof VHF',
      deviceProfileKey: 'HACKRF:hackrf-one',
      context,
      rfChainProfileId: null,
      updatedAtUtc: '2026-02-25T00:00:00.000Z'
    });

    const profiles = listAntennaFrontEndProfiles('HACKRF:hackrf-one');
    expect(profiles).toHaveLength(1);
    expect(profiles[0].context.antennaName).toContain('VHF');
  });

  it('stores typed RF chain profiles and applies mapping fields', () => {
    const chain = buildRfChainProfileFromContext({
      profileId: 'sat-downconverter',
      profileName: 'Satellite Downconverter',
      context: {
        antennaName: 'Helix',
        preampNote: 'LNA in chain',
        attenuatorNote: '',
        filterNote: 'L-band cavity',
        chainNotes: 'Portable sat setup',
        biasTeeEnabled: true
      },
      frequencyMapping: {
        ifOffsetHz: 1_250_000,
        transverterEnabled: true,
        transverterLoHz: 9_750_000_000,
        transverterDirection: 'down'
      },
      netOffsetDb: 4
    });

    upsertRfChainProfile('HACKRF:hackrf-one', chain);

    const profiles = listRfChainProfiles('HACKRF:hackrf-one');
    expect(profiles).toHaveLength(1);
    expect(profiles[0].schemaVersion).toBe('1.0.0');

    const mapping = applyRfChainProfileToFrequencyMapping(profiles[0], {
      ifOffsetHz: 0,
      transverterEnabled: false,
      transverterLoHz: 125_000_000,
      transverterDirection: 'up'
    });

    expect(mapping.ifOffsetHz).toBe(1_250_000);
    expect(mapping.transverterEnabled).toBe(true);
    expect(mapping.transverterDirection).toBe('down');
  });
});
