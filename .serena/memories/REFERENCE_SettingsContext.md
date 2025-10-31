# SettingsContext (Rendering/Visualization)

Centralized source of truth for visualization/rendering settings, persisted to localStorage and provided app‑wide via React Context.

Paths:

- Provider/Hook: src/contexts/SettingsContext.tsx (exports SettingsProvider, useSettings)
- Barrel export: src/contexts/index.ts
- Consumers: src/pages/Monitor.tsx, src/pages/Settings.tsx, src/components/RenderingSettingsModal.tsx

State shape (SettingsState):

- highPerf: boolean — performance mode toggle
- vizMode: "fft" | "waterfall" | "spectrogram"
- showWaterfall: boolean — used when vizMode === "fft"
- fftSize: number — 1024 | 2048 | 4096 | 8192
- colorMap: string — name of WATERFALL_COLORMAPS (kept as string to avoid import cycles)
- dbMin?: number — manual dB floor (leave undefined for auto)
- dbMax?: number — manual dB ceiling (leave undefined for auto)

Persistence:

- Storage key: rad.settings.v1
- Defaults embedded in SettingsContext; simple validation/normalization on load (fftSize whitelist; dbMin/dbMax numeric)

Usage:

- Wrap app at root: <SettingsProvider> … </SettingsProvider>
- Access in components: const { settings, setSettings, resetSettings } = useSettings()
- Update settings with partials: setSettings({ vizMode: "waterfall" })
- In JSX where strict types are required (e.g., PrimaryVisualization colorMap), assert type: const key = settings.colorMap as keyof typeof WATERFALL_COLORMAPS

Notes:

- Replaces prior ad‑hoc localStorage + CustomEvent bridging for highPerf mode
- When adding new settings, extend SettingsState and DEFAULTS, then update Settings page controls accordingly
- Keep long‑term defaults stable; if breaking changes are needed, bump storage key suffix (v2) and add a migration
