import { describe, expect, it } from 'vitest';
import {
  consumeSessionInterrupted,
  markSessionInterrupted,
  SESSION_INTERRUPTED_STORAGE_KEY
} from './sessionResilience';

type MinimalStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const createMemoryStorage = (): MinimalStorage => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    }
  };
};

describe('sessionResilience storage flags', () => {
  it('stores and consumes interrupted-session marker once', () => {
    const storage = createMemoryStorage();
    markSessionInterrupted(storage, '2026-02-24T16:55:00.000Z');

    const consumed = consumeSessionInterrupted(storage);
    expect(consumed).toBe('2026-02-24T16:55:00.000Z');
    expect(consumeSessionInterrupted(storage)).toBeNull();
  });

  it('returns null when no marker exists', () => {
    const storage = createMemoryStorage();

    expect(storage.getItem(SESSION_INTERRUPTED_STORAGE_KEY)).toBeNull();
    expect(consumeSessionInterrupted(storage)).toBeNull();
  });
});
