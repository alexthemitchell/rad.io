import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildCatalogEntriesFromAnnotations,
  findSpurCatalogMatches,
  upsertSpurArtifactEntries
} from './spurArtifactCatalog';

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

describe('spurArtifactCatalog', () => {
  beforeEach(() => {
    installLocalStorage();
    globalThis.localStorage.clear();
  });

  it('stores known artifact annotations and matches by context', () => {
    const entries = buildCatalogEntriesFromAnnotations({
      sampleRateHz: 2_000_000,
      gainSignature: 'LNA:16|VGA:20',
      annotations: [
        {
          frequencyHz: 145_000_000,
          label: 'LO leakage spur',
          kind: 'lo-leakage'
        }
      ]
    });

    upsertSpurArtifactEntries('HACKRF:hackrf-one', entries);

    const matches = findSpurCatalogMatches({
      deviceProfileKey: 'HACKRF:hackrf-one',
      sampleRateHz: 2_000_000,
      gainSignature: 'LNA:16|VGA:20',
      candidateFrequencyHz: 145_000_120,
      toleranceHz: 300
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe('lo-leakage');
  });

  it('does not match entries from different gain signatures', () => {
    const entries = buildCatalogEntriesFromAnnotations({
      sampleRateHz: 2_000_000,
      gainSignature: 'LNA:8|VGA:12',
      annotations: [
        {
          frequencyHz: 100_000_000,
          label: 'DC spur image',
          kind: 'spur'
        }
      ]
    });

    upsertSpurArtifactEntries('HACKRF:hackrf-one', entries);

    const matches = findSpurCatalogMatches({
      deviceProfileKey: 'HACKRF:hackrf-one',
      sampleRateHz: 2_000_000,
      gainSignature: 'LNA:16|VGA:20',
      candidateFrequencyHz: 100_000_000,
      toleranceHz: 100
    });

    expect(matches).toHaveLength(0);
  });
});
