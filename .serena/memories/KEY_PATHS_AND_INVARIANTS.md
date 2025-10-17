Purpose: Fast orientation to critical files/symbols and cross-cutting invariants for rad.io.

Key entry points

- App: `src/index.tsx` → `src/App.tsx` → `src/pages/Visualizer.tsx`
- Visualizations: `src/components/*` (IQConstellation, Spectrogram, WaveformChart, FFTChart, etc.)
- Hooks: `src/hooks/useUSBDevice.ts`, `src/hooks/useHackRFDevice.ts`, `src/hooks/useSDR.ts`
- Devices: `src/models/SDRDevice.ts` (ISDRDevice), `src/models/HackRFOne.ts`, `src/models/HackRFOneAdapter.ts`
- DSP: `src/utils/dsp.ts`, `src/utils/dspWasm.ts`, `assembly/dsp.ts`
- Workers: `src/workers/visualization.worker.ts`

Invariants & contracts

- ISDRDevice contract: Configurable via methods (sample rate, frequency, bandwidth, gains), streaming via `receive(callback)` returning IQ data; `parseSamples(DataView)` converts to `Sample[]` with I/Q in ±1.0 floats.
- DSP correctness: Frequency shift centers zero; dB scaling uses `20 * log10(magnitude)`; Parseval’s theorem holds in tests.
- Visualization performance: Canvas contexts with `{ alpha: false, desynchronized: true }`; high-DPI scaling via devicePixelRatio; throttle updates (RAF or <=30 FPS).
- Data formats: HackRF: Int8 interleaved IQ; RTL-SDR: Uint8 interleaved IQ (0..255 offset 127); all normalized to Float32 in ±1.0.

Debugging checkpoints

- If UI says "Receiving" but charts empty: verify sample rate configured before `receive()`; confirm `parseSamples` returns non-empty; check endpoint numbers; throttle state updates to avoid render storms.

CI expectations

- Strict TypeScript (`tsconfig.json`), no `any`; ESLint clean; Prettier formatted; tests green; webpack build succeeds.

Useful tests

- Components: `src/components/__tests__/*.test.tsx`
- Devices: `src/models/__tests__/*.test.ts`
- DSP: `src/utils/__tests__/*`
