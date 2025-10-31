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
  dbMin: -100,
  dbMax: 0,
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
    if (next.dbMin !== undefined && typeof next.dbMin !== "number") {
      next.dbMin = DEFAULTS.dbMin;
    }
    if (next.dbMax !== undefined && typeof next.dbMax !== "number") {
      next.dbMax = DEFAULTS.dbMax;
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
    setSettingsState((prev) => ({ ...prev, ...partial }));
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
