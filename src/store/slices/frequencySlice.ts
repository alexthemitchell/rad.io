/**
 * Frequency Slice
 *
 * Manages the current tuned frequency (VFO) for the SDR.
 * Migrated from FrequencyContext.tsx to use Zustand.
 */

import { type StateCreator } from "zustand";

export interface FrequencySlice {
  frequencyHz: number;
  setFrequencyHz: (hz: number) => void;
}

export const frequencySlice: StateCreator<FrequencySlice> = (
  set: (
    partial:
      | FrequencySlice
      | Partial<FrequencySlice>
      | ((state: FrequencySlice) => FrequencySlice | Partial<FrequencySlice>),
  ) => void,
) => ({
  frequencyHz: 100_000_000, // Default to 100 MHz

  setFrequencyHz: (hz: number): void => {
    set({ frequencyHz: hz });
  },
});
