const SAFE_MODE_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const SAFE_MODE_QUERY_KEYS = ['safeMode', 'safe', 'recoverySafeMode'] as const;

export const shouldBypassAutoRestoreFromUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return SAFE_MODE_QUERY_KEYS.some((key) => {
      const value = parsed.searchParams.get(key);
      return value !== null && SAFE_MODE_TRUE_VALUES.has(value.trim().toLowerCase());
    });
  } catch {
    return false;
  }
};

export const clearSelectedPersistedState = (
  storage: Pick<Storage, 'removeItem'>,
  keys: readonly string[]
): number => {
  let removed = 0;

  for (const key of keys) {
    try {
      storage.removeItem(key);
      removed += 1;
    } catch {
      // Ignore storage errors in private browsing modes.
    }
  }

  return removed;
};

export type SafeModeKeyHoldDetectionOptions = {
  targetKey?: string;
  timeoutMs?: number;
  checkIntervalMs?: number;
  eventTarget?: {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
    setInterval: typeof globalThis.setInterval;
    clearInterval: typeof globalThis.clearInterval;
  };
};

export const shouldBypassAutoRestoreFromKeyHold = async (
  options?: SafeModeKeyHoldDetectionOptions
): Promise<boolean> => {
  const eventTarget = options?.eventTarget ?? (typeof window !== 'undefined' ? window : null);
  if (!eventTarget) {
    return false;
  }

  const targetKey = options?.targetKey ?? 'Shift';
  const timeoutMs = options?.timeoutMs ?? 500;
  const checkIntervalMs = Math.max(10, options?.checkIntervalMs ?? 50);

  let keyIsHeld = false;

  const onKeyDown: EventListener = (event) => {
    const key = (event as KeyboardEvent).key;
    if (key === targetKey) {
      keyIsHeld = true;
    }
  };

  const onKeyUp: EventListener = (event) => {
    const key = (event as KeyboardEvent).key;
    if (key === targetKey) {
      keyIsHeld = false;
    }
  };

  eventTarget.addEventListener('keydown', onKeyDown);
  eventTarget.addEventListener('keyup', onKeyUp);

  return new Promise<boolean>((resolve) => {
    const start = Date.now();
    const timer = eventTarget.setInterval(() => {
      if (keyIsHeld) {
        eventTarget.clearInterval(timer);
        eventTarget.removeEventListener('keydown', onKeyDown);
        eventTarget.removeEventListener('keyup', onKeyUp);
        resolve(true);
        return;
      }

      if (Date.now() - start > timeoutMs) {
        eventTarget.clearInterval(timer);
        eventTarget.removeEventListener('keydown', onKeyDown);
        eventTarget.removeEventListener('keyup', onKeyUp);
        resolve(false);
      }
    }, checkIntervalMs);
  });
};
