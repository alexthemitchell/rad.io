Purpose: Document runtime flags and validation thresholds for WASM DSP paths, plus safe fallbacks and dev cache-busting.

Context & Files

- Flags and loader: src/utils/dspWasm.ts
- DSP validation and fallbacks: src/utils/dsp.ts
- Related tests: src/utils/**tests**/dsp.calculateFFTSync.fallback.test.ts, dsp.calculateSpectrogram.fallback.test.ts, dsp.calculateSpectrogram.rowwiseWasmFallback.test.ts, dsp.wasmPath.test.ts, dspWasm.binding.test.ts

Runtime Flags

- radio.wasm.enabled: Enable/disable WASM usage at runtime. Defaults to enabled; interpret any value except literal "false" as enabled. See isWasmRuntimeEnabled().
- radio.wasm.validate: Enable/disable O(N) validation of WASM outputs (checks finiteness, shape, and minimal dynamic range). Defaults: dev=true, prod=false. See isWasmValidationEnabled().

Validation Heuristic

- Degenerate detection: Require dynamic range > 1e-3 dB across FFT arrays and spectrogram rows. Also require all values finite and row length === fftSize. If invalid, log once (spectrogram) and fall back.
- Spectrogram row-wise fallback: When bulk WASM spectrogram output is degenerate, attempt per-row WASM FFT using return-by-value API (calculateFFTOut) via helper attemptRowWiseWasmFFT(). If that still looks degenerate, fall back to JS DFT.

Loader & Dev Cache-Busting

- loadWasmModule() candidate URLs include release.js/dsp.js; in dev (localhost/127.0.0.1/::1), append session-stable version stamp (?v=radio.devBuildTs in sessionStorage; falls back to Date.now on error). See makeUrl() in dspWasm.ts.
- Prefer return-by-value APIs when available (calculateFFTOut/calculateWaveformOut/calculateSpectrogramOut) to avoid output-parameter copy-back issues. Binder exposes optional exports and logs presence.

Operational Notes

- JS fallbacks are instrumented with performanceMonitor marks: fft-wasm/js, waveform-wasm/js, spectrogram-wasm/js/row.
- A one-shot warning suppresses repeated degenerate spectrogram logs; reset via resetSpectrogramWasmDegenerateWarning().
- Tests intentionally mock flags to cover both validated and non-validated paths and binding behaviors.
