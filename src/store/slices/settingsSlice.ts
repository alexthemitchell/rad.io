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
  // Multi-station FM / wideband scan settings
  multiStationEnabled: boolean; // enable decoding multiple FM station RDS in-band
  multiStationEnableRDS: boolean; // enable RDS decoding in processor
  multiStationChannelBandwidthHz: number; // default channel bandwidth in Hz
  multiStationScanFFTSize: number; // FFT size for scanning
  multiStationScanIntervalMs: number; // how often to scan/process wideband samples
  multiStationUsePFBChannelizer: boolean; // use PFB channelizer when available
  showGridlines: boolean; // show frequency gridlines in the visualization
  showGridLabels: boolean; // show frequency grid labels
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
  // MultiStation FM defaults
  multiStationEnabled: false,
  multiStationEnableRDS: true,
  multiStationChannelBandwidthHz: 200000,
  multiStationScanFFTSize: 8192,
  multiStationScanIntervalMs: 1000,
  multiStationUsePFBChannelizer: true,
  showGridlines: true,
  showGridLabels: true,
};

const STORAGE_KEY = "rad.settings.v1";

/**
 * Allowed FFT sizes for validation
 */
const ALLOWED_FFT_SIZES: readonly number[] = [1024, 2048, 4096, 8192];

/**
 * Validates and normalizes settings loaded from storage or during updates.
 *
 * This function uses a two-phase approach:
 * 1. Merge phase: Combines partial settings with either DEFAULTS (initial load) or base (updates)
 * 2. Validation phase: Validates the merged result and falls back to safe values if needed
 *
 * When `base` is provided (during setSettings):
 * - Spreads partial over base to preserve existing user values
 * - Validates explicitly provided fields in partial
 * - Falls back to base values for invalid partial values
 *
 * When `base` is NOT provided (initial load from storage):
 * - Spreads partial over DEFAULTS
 * - Validates all fields and falls back to DEFAULTS for invalid values
 *
 * @param partial - The partial settings to apply (from user or storage)
 * @param base - Optional base settings to merge with (used during updates to preserve existing values)
 * @returns Fully normalized settings with all required fields
 */
function normalizeSettings(
  partial: Partial<SettingsState>,
  base?: SettingsState,
): SettingsState {
  const next: SettingsState = base
    ? { ...base, ...partial }
    : { ...DEFAULTS, ...partial };

  // Normalize fftSize - reject invalid values
  if (!ALLOWED_FFT_SIZES.includes(next.fftSize)) {
    next.fftSize = base ? base.fftSize : DEFAULTS.fftSize;
  }

  // Normalize dB range: allow undefined (auto). Coerce non-number/NaN to undefined.
  // The validation only triggers if the field exists in next (from merge).
  // If partial doesn't contain dbMin/dbMax, they're already preserved from base.
  if (next.dbMin !== undefined) {
    if (typeof next.dbMin !== "number" || Number.isNaN(next.dbMin)) {
      next.dbMin = base?.dbMin ?? undefined;
    }
  }
  if (next.dbMax !== undefined) {
    if (typeof next.dbMax !== "number" || Number.isNaN(next.dbMax)) {
      next.dbMax = base?.dbMax ?? undefined;
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

  // Validate multi-station FM settings
  if (typeof next.multiStationEnabled !== "boolean") {
    next.multiStationEnabled =
      base?.multiStationEnabled ?? DEFAULTS.multiStationEnabled;
  }
  if (typeof next.multiStationEnableRDS !== "boolean") {
    next.multiStationEnableRDS =
      base?.multiStationEnableRDS ?? DEFAULTS.multiStationEnableRDS;
  }
  if (
    typeof next.multiStationChannelBandwidthHz !== "number" ||
    Number.isNaN(next.multiStationChannelBandwidthHz) ||
    next.multiStationChannelBandwidthHz <= 0
  ) {
    next.multiStationChannelBandwidthHz =
      base?.multiStationChannelBandwidthHz ??
      DEFAULTS.multiStationChannelBandwidthHz;
  }
  if (!ALLOWED_FFT_SIZES.includes(next.multiStationScanFFTSize)) {
    next.multiStationScanFFTSize =
      base?.multiStationScanFFTSize ?? DEFAULTS.multiStationScanFFTSize;
  }
  if (
    typeof next.multiStationScanIntervalMs !== "number" ||
    Number.isNaN(next.multiStationScanIntervalMs) ||
    next.multiStationScanIntervalMs <= 0
  ) {
    next.multiStationScanIntervalMs =
      base?.multiStationScanIntervalMs ?? DEFAULTS.multiStationScanIntervalMs;
  }
  if (typeof next.multiStationUsePFBChannelizer !== "boolean") {
    next.multiStationUsePFBChannelizer =
      base?.multiStationUsePFBChannelizer ??
      DEFAULTS.multiStationUsePFBChannelizer;
  }
  if (typeof next.showGridlines !== "boolean") {
    next.showGridlines = base?.showGridlines ?? DEFAULTS.showGridlines;
  }
  if (typeof next.showGridLabels !== "boolean") {
    next.showGridLabels = base?.showGridLabels ?? DEFAULTS.showGridLabels;
  }

  return next;
}

export interface SettingsSlice {
  settings: SettingsState;
  setSettings: (partial: Partial<SettingsState>) => void;
  resetSettings: () => void;
}

export const settingsSlice: StateCreator<SettingsSlice> = (
  set: (
    partial:
      | SettingsSlice
      | Partial<SettingsSlice>
      | ((state: SettingsSlice) => SettingsSlice | Partial<SettingsSlice>),
  ) => void,
) => ({
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
    set((state: SettingsSlice) => {
      // Normalize partial updates against current settings (not DEFAULTS)
      const next = normalizeSettings(partial, state.settings);

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
