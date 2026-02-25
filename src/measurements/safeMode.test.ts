import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearSelectedPersistedState,
  shouldBypassAutoRestoreFromKeyHold,
  shouldBypassAutoRestoreFromUrl
} from './safeMode';

afterEach(() => {
  vi.useRealTimers();
});

describe('safeMode', () => {
  it('detects startup bypass query parameters', () => {
    expect(shouldBypassAutoRestoreFromUrl('https://localhost:8080/?safeMode=1')).toBe(true);
    expect(shouldBypassAutoRestoreFromUrl('https://localhost:8080/?safe=true')).toBe(true);
    expect(shouldBypassAutoRestoreFromUrl('https://localhost:8080/?recoverySafeMode=on')).toBe(true);
    expect(shouldBypassAutoRestoreFromUrl('https://localhost:8080/?safe=false')).toBe(false);
  });

  it('clears selected persisted keys safely', () => {
    const removed: string[] = [];
    const storage = {
      removeItem(key: string) {
        removed.push(key);
      }
    };

    const count = clearSelectedPersistedState(storage, ['a', 'b', 'c']);

    expect(count).toBe(3);
    expect(removed).toEqual(['a', 'b', 'c']);
  });

  it('detects startup key hold when keydown arrives within window', async () => {
    vi.useFakeTimers();

    const eventTarget = new EventTarget();
    const testTarget = {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      setInterval,
      clearInterval
    };

    const detectionPromise = shouldBypassAutoRestoreFromKeyHold({
      targetKey: 'Shift',
      timeoutMs: 120,
      checkIntervalMs: 20,
      eventTarget: testTarget
    });

    eventTarget.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Shift' }));
    await vi.advanceTimersByTimeAsync(40);

    await expect(detectionPromise).resolves.toBe(true);
  });

  it('returns false when key hold is not detected before timeout', async () => {
    vi.useFakeTimers();

    const eventTarget = new EventTarget();
    const testTarget = {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      setInterval,
      clearInterval
    };

    const detectionPromise = shouldBypassAutoRestoreFromKeyHold({
      targetKey: 'Shift',
      timeoutMs: 80,
      checkIntervalMs: 20,
      eventTarget: testTarget
    });

    await vi.advanceTimersByTimeAsync(140);
    await expect(detectionPromise).resolves.toBe(false);
  });
});
