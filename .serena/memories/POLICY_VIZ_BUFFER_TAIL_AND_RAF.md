Performance policy for Monitor visualization updates to minimize React churn and GC pressure.

Policy

- Cap viz ring buffer to fftSize×(highPerf?16:64).
- Update React state via rAF; copy only tail window fftSize×(highPerf?4:12).
- Pace updates: ~30 fps when highPerf active (minFrameMs=33), ~60 fps otherwise (16ms).
- Status bar uses same cap for buffer health.

Why

- Fewer/lighter state copies, less GC, smoother paints; enough history for SpectrumExplorer and Spectrogram.

References

- Code: src/pages/Monitor.tsx (vizUpdatePendingRef, lastVizUpdateRef, highPerfMode, StatusBar maxSamples).
- Consumers: src/visualization/components/SpectrumExplorer.tsx (rAF + incremental waterfall).
- Related: Spectrogram prefers smaller windows; has WebGPU/WebGL/worker fallback.

Notes

- Keep heavy DSP in WASM/workers, not React state.
- If FPS < 30 sustained, consider disabling waterfall and/or lowering fftSize.
- WebUSB pairing cannot be automated in Playwright (see PLAYWRIGHT_WEBUSB_LIMITATION_2025).
