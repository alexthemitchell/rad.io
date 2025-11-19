/**
 * Marker Slice
 *
 * Persistence: None (ephemeral, runtime-only)
 * Scope: Application-wide (Zustand store)
 * Expiration: Cleared on page reload
 *
 * Manages frequency marker state for spectrum analysis.
 * Markers are used to measure frequency, power, and calculate deltas.
 *
 * Related: See ARCHITECTURE.md "State & Persistence" section for storage pattern guidance
 */

import { type StateCreator } from "zustand";

/**
 * Marker definition matching MarkerTable's MarkerRow type
 */
export interface Marker {
  id: string;
  label: string; // "M1", "M2", etc.
  freqHz: number; // Hz (matches MarkerTable.tsx)
  powerDb?: number; // dBFS or dBm (matches MarkerTable.tsx)
}

/**
 * Marker slice state and actions
 */
export interface MarkerSlice {
  /**
   * Array of frequency markers
   */
  markers: Marker[];

  /**
   * Counter for next marker number to ensure unique sequential labels
   */
  nextMarkerNumber: number;

  /**
   * Add a new marker with auto-generated label
   */
  addMarker: (freqHz: number, powerDb?: number) => void;

  /**
   * Remove a marker by ID
   */
  removeMarker: (id: string) => void;

  /**
   * Remove all markers
   */
  clearMarkers: () => void;
}

/**
 * Generate unique marker ID
 */
function generateMarkerId(): string {
  return `marker-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate marker label (M1, M2, M3, etc.)
 */
function generateMarkerLabel(markerNumber: number): string {
  return `M${markerNumber}`;
}

/**
 * Marker slice implementation
 */
export const markerSlice: StateCreator<MarkerSlice> = (set) => ({
  markers: [],
  nextMarkerNumber: 1,

  addMarker: (freqHz: number, powerDb?: number): void => {
    set((state) => {
      const id = generateMarkerId();
      const label = generateMarkerLabel(state.nextMarkerNumber);
      const newMarker: Marker = { id, label, freqHz, powerDb };
      return {
        markers: [...state.markers, newMarker],
        nextMarkerNumber: state.nextMarkerNumber + 1,
      };
    });
  },

  removeMarker: (id: string): void => {
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== id),
    }));
  },

  clearMarkers: (): void => {
    set({ markers: [], nextMarkerNumber: 1 });
  },
});
