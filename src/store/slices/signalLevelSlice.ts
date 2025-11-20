/**
 * Signal Level Slice
 * Phase 2 - Measurement Service & Conversion Utilities
 *
 * Persistence: None (ephemeral, runtime-only)
 * Scope: Application-wide (Zustand store)
 * Expiration: Cleared on page reload
 *
 * Stores the current signal level measurement including dBFS, dBm, S-units.
 * Updated periodically by the SignalLevelService.
 *
 * Related: See ARCHITECTURE.md "State & Persistence" section for storage pattern guidance
 */

import { type StateCreator } from "zustand";
import type { SignalLevel } from "../../lib/measurement/types";

export interface SignalLevelSlice {
  /** Current signal level measurement, null if no measurement available */
  signalLevel: SignalLevel | null;

  /** Update the signal level measurement */
  setSignalLevel: (level: SignalLevel) => void;

  /** Clear the signal level measurement */
  clearSignalLevel: () => void;
}

export const signalLevelSlice: StateCreator<SignalLevelSlice> = (set) => ({
  signalLevel: null,

  setSignalLevel: (level: SignalLevel): void => {
    set({ signalLevel: level });
  },

  clearSignalLevel: (): void => {
    set({ signalLevel: null });
  },
});
