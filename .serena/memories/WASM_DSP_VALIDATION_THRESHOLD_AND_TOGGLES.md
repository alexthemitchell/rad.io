Purpose: Document runtime flags and validation rules that gate WASM DSP usage and when JS fallbacks are triggered. Links: src/utils/dsp.ts, src/utils/dspWasm.ts. Related: WASM_DSP_RUNTIME_FLAGS, WASM_OUTPUT_ARRAY_BUG.

Overview
- WASM is preferred for FFT/Spectrogram/Waveform, but known loader behaviors can return zero/constant arrays when using output-parameter APIs. We defensively validate outputs and fall back to JS when needed.

Runtime flags (localStorage)
- radio.wasm.enabled: string ('false' to disable WASM). Default: enabled.
- radio.wasm.validate: string ('true' to enable validation). Default: dev=true, prod=false.

Validation contract (degenerate-output detection)
- After WASM compute, we scan the result(s) to ensure:
  - All entries are finite numbers.
  - Shapes are correct (length equals fftSize; 2D results are arrays of Float32Array rows of fftSize).
  - Minimal dynamic range: (max - min) > 1e-3 dB.
- Rationale: range <= 1e-3 indicates a constant/zero-filled spectrum which breaks downstream detection (reports ~0 dB floor). Threshold is generous enough to pass typical legitimate spectra while catching the “flat” failure mode.
- If validation fails:
  - calculateFFTSync() logs once and falls back to JS.
  - calculateSpectrogram() logs once, then attempts a per-row WASM FFT using return-by-value API if available; otherwise falls back to JS.

APIs and preferences
- Prefer return-by-value WASM APIs (calculateFFTOut/calculateWaveformOut/calculateSpectrogramOut) when exported; they avoid copy-back issues. Legacy output-parameter APIs remain supported but are validated and may trigger fallbacks.

Dev ergonomics
- In dev on localhost/127.0.0.1/::1, the WASM module URL is cache-busted (query param) to avoid stale module loads after rebuilds.

Notes
- Log category: dspLogger. Perf marks: fft-wasm, spectrogram-wasm, spectrogram-wasm-row, waveform-wasm.
- Related memories: WASM_DSP_RUNTIME_FLAGS (high-level toggles), WASM_OUTPUT_ARRAY_BUG (root-cause context).