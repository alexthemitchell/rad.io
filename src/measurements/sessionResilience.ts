export const SESSION_INTERRUPTED_STORAGE_KEY = 'rad.io.sessionInterrupted.v1';

export const markSessionInterrupted = (storage: Pick<Storage, 'setItem'>, nowIso: string): void => {
  storage.setItem(SESSION_INTERRUPTED_STORAGE_KEY, nowIso);
};

export const consumeSessionInterrupted = (
  storage: Pick<Storage, 'getItem' | 'removeItem'>
): string | null => {
  const value = storage.getItem(SESSION_INTERRUPTED_STORAGE_KEY);
  if (!value) {
    return null;
  }

  storage.removeItem(SESSION_INTERRUPTED_STORAGE_KEY);
  return value;
};
