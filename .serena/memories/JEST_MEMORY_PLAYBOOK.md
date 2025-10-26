Update: Visibility gating and canvas in tests.

Key additions

- Visibility hooks must degrade gracefully in JSDOM/SSR. `src/hooks/useIntersectionObserver.ts` now defaults `isVisible=true` if `IntersectionObserver` is unavailable, and skips observer setup. This prevents visualizer components from early‑returning and fixes cascading test failures.
- Canvas sizing must occur synchronously before async imports in visualizers (IQConstellation, Spectrogram, WaveformVisualizer). Tests assert DPR‑scaled `canvas.width/height` immediately after render.
- If WebGL path fails in tests, components auto‑fallback to 2D canvas; jest.setup mocks 2D canvas methods sufficiently—extend if new APIs are used.

Still recommended

- For heavy tests: `--maxWorkers=1`, expose GC, unmount components, call `clearMemoryPools()`.
- Keep accessibility assertions preferable to pixel‑level checks.

High‑signal failure pattern (historical)

- Many component tests failing at once typically indicates a shared gating condition (visibility, feature detection) rather than per‑component defects. Check hooks/utilities first.

New: DSP WASM unit-test tips (rad.io utils)

- When testing `calculateSpectrogram` degenerate WASM output fallback (`src/utils/dsp.ts`), the JS fallback calls `calculateFFTSync`, which may re-enter the WASM path. Either:
  - Stub `calculateFFTWasm` to return `null` so `calculateFFTSync` falls back to JS, or
  - Use a stateful mock of `isWasmRuntimeEnabled` that returns true for the first check (spectrogram) and false for subsequent checks (FFT rows).
- Always mock `isWasmAvailable` and `isWasmRuntimeEnabled` consistently in the same module factory.
- Prefer targeted local runs via `npx jest <path> --runInBand` when iterating. The project `npm test` enforces coverage thresholds globally and will fail if you only run one new test.
- For spectrogram tests, generate simple sinusoidal I/Q samples to guarantee a non‑degenerate JS FFT result; assert range > 1e‑3 across rows.
