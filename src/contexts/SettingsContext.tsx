import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

type SettingsContextValue = {
  settings: SettingsState;
  setSettings: (partial: Partial<SettingsState>) => void;
  resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEY = "rad.settings.v1";

function loadFromStorage(): SettingsState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    // Minimal validation and fill defaults
    const next: SettingsState = { ...DEFAULTS, ...parsed };
    // Normalize values
    const allowedFft = [1024, 2048, 4096, 8192];
    if (!allowedFft.includes(next.fftSize)) {
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
  } catch {
    return null;
  }
}

function saveToStorage(state: SettingsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function SettingsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [settings, setSettingsState] = useState<SettingsState>(
    () => loadFromStorage() ?? DEFAULTS,
  );

  // Persist on change
  useEffect(() => {
    saveToStorage(settings);
  }, [settings]);

  const setSettings = useCallback((partial: Partial<SettingsState>) => {
    setSettingsState((prev) => {
      const next: SettingsState = { ...prev, ...partial } as SettingsState;

      // Enforce valid fftSize
      const allowedFft = [1024, 2048, 4096, 8192];
      if (!allowedFft.includes(next.fftSize)) {
        next.fftSize = prev.fftSize;
      }

      // Normalize dB range entries (permit undefined)
      if (Object.prototype.hasOwnProperty.call(partial, "dbMin")) {
        const v = partial.dbMin;
        if (v === undefined) {
          next.dbMin = undefined;
        } else if (typeof v !== "number" || Number.isNaN(v)) {
          next.dbMin = prev.dbMin;
        }
      }
      if (Object.prototype.hasOwnProperty.call(partial, "dbMax")) {
        const v = partial.dbMax;
        if (v === undefined) {
          next.dbMax = undefined;
        } else if (typeof v !== "number" || Number.isNaN(v)) {
          next.dbMax = prev.dbMax;
        }
      }

      // Ensure dbMin < dbMax when both defined; otherwise fall back to auto
      if (
        next.dbMin !== undefined &&
        next.dbMax !== undefined &&
        !(next.dbMin < next.dbMax)
      ) {
        next.dbMin = undefined;
        next.dbMax = undefined;
      }

      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULTS);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, setSettings, resetSettings }),
    [settings, setSettings, resetSettings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
