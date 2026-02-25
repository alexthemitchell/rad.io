import type { InteractionDemodMode } from './bandPlans';

export type TuneHistoryEntry = {
  tunedAtIso: string;
  displayFrequencyHz: number;
  tunerFrequencyHz: number;
  demodMode: InteractionDemodMode;
};

export type HeardHistoryEntry = {
  heardAtIso: string;
  displayFrequencyHz: number;
  demodMode: InteractionDemodMode;
  snrEstimateDb: number;
  lockState: 'searching' | 'locked' | 'degraded';
};

export const appendTuneHistory = (
  history: readonly TuneHistoryEntry[],
  nextEntry: TuneHistoryEntry,
  maxEntries = 12,
  dedupeWithinHz = 50
): TuneHistoryEntry[] => {
  const next: TuneHistoryEntry[] = [];
  next.push(nextEntry);

  for (const entry of history) {
    const duplicate =
      Math.abs(entry.displayFrequencyHz - nextEntry.displayFrequencyHz) <= dedupeWithinHz
      && entry.demodMode === nextEntry.demodMode;

    if (!duplicate) {
      next.push(entry);
    }

    if (next.length >= maxEntries) {
      break;
    }
  }

  return next;
};

export const swapRecallPair = (
  slotAHz: number | null,
  slotBHz: number | null
): { slotAHz: number | null; slotBHz: number | null } => {
  return {
    slotAHz: slotBHz,
    slotBHz: slotAHz
  };
};

export const appendHeardHistory = (
  history: readonly HeardHistoryEntry[],
  nextEntry: HeardHistoryEntry,
  maxEntries = 12,
  dedupeWithinHz = 500
): HeardHistoryEntry[] => {
  const next: HeardHistoryEntry[] = [nextEntry];

  for (const entry of history) {
    const duplicate =
      Math.abs(entry.displayFrequencyHz - nextEntry.displayFrequencyHz) <= dedupeWithinHz
      && entry.demodMode === nextEntry.demodMode;

    if (!duplicate) {
      next.push(entry);
    }

    if (next.length >= maxEntries) {
      break;
    }
  }

  return next;
};
