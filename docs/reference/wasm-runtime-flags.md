# WASM runtime flags and validation

This app can enable/disable the WebAssembly DSP path and its output validation at runtime without rebuilding. These flags are helpful for debugging, CI stability, and field diagnostics.

## Flags

- radio.wasm.enabled
  - Enables WASM usage when true; disables when set to the literal string "false".
  - Default: enabled (any value other than "false" is treated as enabled).
  - Source: `src/utils/dspWasm.ts` → `isWasmRuntimeEnabled()`.

- radio.wasm.validate
  - Enables O(N) validation of WASM outputs. Validation checks for finite values, correct shape, and minimal dynamic range.
  - Defaults: development = true, production = false (can be overridden at runtime).
  - Source: `src/utils/dspWasm.ts` → `isWasmValidationEnabled()`.

## Validation heuristic

To avoid degenerate spectra (e.g., zero-filled or constant arrays), results are considered valid only if:

- All values are finite
- Row length matches `fftSize`
- Dynamic range across the array is greater than ~1e-3 dB

If validation fails, the pipeline falls back:

1. Spectrogram: try a safer per-row WASM FFT via the return-by-value API (avoids output-parameter copy-back issues)
2. If still degenerate, use the JavaScript DFT implementation

Implementation: `src/utils/dsp.ts` (`calculateFFTSync`, `calculateSpectrogram`, `attemptRowWiseWasmFFT`).

## Dev cache-busting for WASM builds

When loading the WASM JS wrapper in development (localhost, 127.0.0.1, ::1), the loader appends a session-stable version param to avoid stale caches across rebuilds without re-downloading on every reload.

- Key: `sessionStorage['radio.devBuildTs']` (falls back to Date.now if sessionStorage is unavailable)
- Source: `src/utils/dspWasm.ts` → `loadWasmModule()` → `makeUrl()`

## Quick usage

- Temporarily disable WASM:
  - `localStorage.setItem('radio.wasm.enabled', 'false')`
- Force-enable validation in production:
  - `localStorage.setItem('radio.wasm.validate', 'true')`
- Clear flags (use defaults):
  - `localStorage.removeItem('radio.wasm.enabled'); localStorage.removeItem('radio.wasm.validate')`

These settings take effect on next page load.
