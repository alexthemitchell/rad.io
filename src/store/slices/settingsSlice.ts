/**
 * Settings Slice
 *
 * Manages visualization and rendering settings with localStorage persistence.
 * Migrated from SettingsContext.tsx to use Zustand for better performance.
 */

import { type StateCreator } from "zustand";

export type VizMode = "fft" | "waterfall" | "spectrogram";

export interface SettingsState {
  highPerf: boolean;
  vizMode: VizMode;
  showWaterfall: boolean; // used when vizMode === "fft"
  fftSize: number; // 1024|2048|4096|8192
  colorMap: string; // key of WATERFALL_COLORMAPS; kept as string to avoid import cycles
  dbMin?: number;
  dbMax?: number;
}

const DEFAULTS: SettingsState = {
  highPerf: false,
  vizMode: "fft",
  showWaterfall: true,
  fftSize: 4096,
  colorMap: "turbo",
  // Leave dB range undefined to allow auto-scaling by default
  dbMin: undefined,
  dbMax: undefined,
};

const STORAGE_KEY = "rad.settings.v1";

/**
 * Allowed FFT sizes for validation
 */
const ALLOWED_FFT_SIZES: readonly number[] = [1024, 2048, 4096, 8192];

/**
 * Validates and normalizes settings loaded from storage
 */
function normalizeSettings(partial: Partial<SettingsState>): SettingsState {
  const next: SettingsState = { ...DEFAULTS, ...partial };

  // Normalize fftSize
  if (!ALLOWED_FFT_SIZES.includes(next.fftSize)) {
    next.fftSize = DEFAULTS.fftSize;
  }

  // Normalize dB range: allow undefined (auto). Coerce non-number/NaN to undefined.
  if (next.dbMin !== undefined) {
    if (typeof next.dbMin !== "number" || Number.isNaN(next.dbMin)) {
      next.dbMin = undefined;
    }
  }
  if (next.dbMax !== undefined) {
    if (typeof next.dbMax !== "number" || Number.isNaN(next.dbMax)) {
      next.dbMax = undefined;
    }
  }
  if (
    next.dbMin !== undefined &&
    next.dbMax !== undefined &&
    !(next.dbMin < next.dbMax)
  ) {
    // Invalid manual range; fall back to auto
    next.dbMin = undefined;
    next.dbMax = undefined;
  }

  return next;
}

export interface SettingsSlice {
  settings: SettingsState;
  setSettings: (partial: Partial<SettingsState>) => void;
  resetSettings: () => void;
}

export const settingsSlice: StateCreator<SettingsSlice> = (set) => ({
  settings: ((): SettingsState => {
    // Load from storage on initialization
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return DEFAULTS;
      }
      const parsed = JSON.parse(raw) as Partial<SettingsState>;
      return normalizeSettings(parsed);
    } catch {
      return DEFAULTS;
    }
  })(),

  setSettings: (partial: Partial<SettingsState>): void => {
    set((state) => {
      // Merge partial updates with current settings and normalize
      const merged = { ...state.settings, ...partial };
      const next = normalizeSettings(merged);

      // Persist to storage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }

      return { settings: next };
    });
  },

  resetSettings: (): void => {
    set({ settings: DEFAULTS });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS));
    } catch {
      // ignore
    }
  },
});
