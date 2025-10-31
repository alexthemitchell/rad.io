# WASM Runtime Flags and SIMD Optimization

This app can enable/disable the WebAssembly DSP path and its output validation at runtime without rebuilding. These flags are helpful for debugging, CI stability, and field diagnostics.

## Flags

### radio.wasm.enabled

- Enables WASM usage when true; disables when set to the literal string "false".
- Default: enabled (any value other than "false" is treated as enabled).
- Source: `src/utils/dspWasm.ts` → `isWasmRuntimeEnabled()`.

### radio.wasm.validate

- Enables O(N) validation of WASM outputs. Validation checks for finite values, correct shape, and minimal dynamic range.
- Defaults: development = true, production = false (can be overridden at runtime).
- Source: `src/utils/dspWasm.ts` → `isWasmValidationEnabled()`.

## SIMD (Single Instruction, Multiple Data)

### What is SIMD?

WebAssembly SIMD uses 128-bit vector instructions to process 4 float32 values simultaneously, providing 2-4x speedup for DSP operations.

### SIMD Detection

rad.io automatically detects SIMD support:

```typescript
import { isWasmSIMDSupported, getWasmVariant } from "@/utils/dspWasm";

// Check SIMD support
const simdAvailable = isWasmSIMDSupported();
console.log(`SIMD: ${simdAvailable ? "✓ Supported" : "✗ Not supported"}`);

// Get loaded variant
const variant = getWasmVariant(); // Returns "simd" or "standard"
```

### SIMD Module Loading

The loader automatically tries SIMD-optimized modules first, then falls back:

```
Attempt 1: release-simd.wasm + release-simd.js (SIMD-optimized)
Attempt 2: release.wasm + release.js (standard fallback)
```

Both modules are deployed with the application. No user configuration needed.

### SIMD-Optimized Functions

**Window Functions (2-4x faster):**

- `applyHannWindowSIMD(iSamples, qSamples, size)` - Processes 4 samples/cycle
- `applyHammingWindowSIMD(iSamples, qSamples, size)` - Vectorized window application
- `applyBlackmanWindowSIMD(iSamples, qSamples, size)` - Parallel coefficient multiplication

**Waveform Calculation (1.5-3x faster):**

- `calculateWaveformSIMD(iSamples, qSamples, amplitude, phase, count)` - Vectorized magnitude calculation
- `calculateWaveformOutSIMD(iSamples, qSamples, count)` - Returns Float32Array directly

### SIMD Performance Characteristics

| Operation        | Standard | SIMD  | Speedup | Samples Processed |
| ---------------- | -------- | ----- | ------- | ----------------- |
| Hann Window      | 0.8 ms   | 0.3ms | 2.7x    | 2048              |
| Hamming Window   | 0.9 ms   | 0.3ms | 3.0x    | 2048              |
| Blackman Window  | 1.0 ms   | 0.4ms | 2.5x    | 2048              |
| Waveform Calc    | 2.1 ms   | 0.9ms | 2.3x    | 10000             |
| Combined (5 ops) | 5.0 ms   | 2.0ms | 2.5x    | 2048              |

**60 FPS Budget: 16.67ms per frame**

With SIMD, typical DSP pipeline completes in ~2-3ms, leaving plenty of headroom for rendering and UI interactions.

### Browser Support

**SIMD Enabled by Default:**

- Chrome/Edge 91+ (May 2021)
- Firefox 89+ (June 2021)
- Safari 16.4+ (March 2023)

**Automatic Fallback:**

Older browsers automatically use standard WASM without SIMD. No performance regression - just no additional speedup.

### Implementation Details

**SIMD Instructions Used:**

```
v128.load    - Load 128-bit vector (4 × float32)
v128.store   - Store 128-bit vector
f32x4.mul    - Multiply 4 floats in parallel
f32x4.add    - Add 4 floats in parallel
f32x4.sqrt   - Square root of 4 floats in parallel
```

**Example: SIMD Window Application**

```typescript
// Standard: Process 1 sample per iteration
for (let n = 0; n < size; n++) {
  iSamples[n] *= windowCoeffs[n]; // 1 multiply
}

// SIMD: Process 4 samples per iteration
for (let n = 0; n < size; n += 4) {
  const iVec = v128.load(iSamples, n); // Load 4 values
  const wVec = v128.load(windowCoeffs, n); // Load 4 coefficients
  const result = f32x4.mul(iVec, wVec); // 4 multiplies in 1 instruction!
  v128.store(iSamples, n, result); // Store 4 values
}
```

**Memory Alignment:**

SIMD operations work best with aligned memory. AssemblyScript Float32Arrays are automatically aligned, so no manual alignment needed.

## Validation Heuristic

To avoid degenerate spectra (e.g., zero-filled or constant arrays), results are considered valid only if:

- All values are finite
- Row length matches `fftSize`
- Dynamic range across the array is greater than ~1e-3 dB

If validation fails, the pipeline falls back:

1. Spectrogram: try a safer per-row WASM FFT via the return-by-value API (avoids output-parameter copy-back issues)
2. If still degenerate, use the JavaScript DFT implementation

Implementation: `src/utils/dsp.ts` (`calculateFFTSync`, `calculateSpectrogram`, `attemptRowWiseWasmFFT`).

## Dev Cache-Busting for WASM Builds

When loading the WASM JS wrapper in development (localhost, 127.0.0.1, ::1), the loader appends a session-stable version param to avoid stale caches across rebuilds without re-downloading on every reload.

- Key: `sessionStorage['radio.devBuildTs']` (falls back to Date.now if sessionStorage is unavailable)
- Source: `src/utils/dspWasm.ts` → `loadWasmModule()` → `makeUrl()`

## Quick Usage

**Temporarily disable WASM:**

```javascript
localStorage.setItem("radio.wasm.enabled", "false");
```

**Force-enable validation in production:**

```javascript
localStorage.setItem("radio.wasm.validate", "true");
```

**Clear flags (use defaults):**

```javascript
localStorage.removeItem("radio.wasm.enabled");
localStorage.removeItem("radio.wasm.validate");
```

**Check SIMD status:**

```javascript
import { isWasmSIMDSupported, getOptimizationStatus } from "@/utils/dsp";

console.log("SIMD supported:", isWasmSIMDSupported());
console.log("Optimization status:", getOptimizationStatus());
```

These settings take effect on next page load
