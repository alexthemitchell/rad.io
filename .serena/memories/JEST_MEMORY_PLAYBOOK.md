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
