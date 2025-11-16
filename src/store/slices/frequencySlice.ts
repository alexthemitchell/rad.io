/**
 * Frequency Slice
 *
 * Persistence: None (ephemeral, runtime-only)
 * Scope: Application-wide (Zustand store)
 * Expiration: Cleared on page reload
 *
 * Manages the current tuned frequency (VFO) for the SDR.
 * This is session-only state - the frequency resets to default (100 MHz) on reload.
 *
 * Migrated from FrequencyContext.tsx to use Zustand.
 *
 * Related: See ARCHITECTURE.md "State & Persistence" section for storage pattern guidance
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
