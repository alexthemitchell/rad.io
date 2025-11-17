# WebAssembly DSP Coverage and Performance

This document details the WASM acceleration coverage for DSP operations in rad.io, including performance benchmarks and optimization strategies.

## Overview

rad.io uses AssemblyScript-compiled WebAssembly modules to accelerate performance-critical DSP operations. WASM provides near-native performance with 2-4x speedups over JavaScript implementations.

### Key Benefits

- **Performance**: 2-4x faster than JavaScript for hot paths
- **SIMD Support**: 4-way parallelism on compatible browsers (Chrome 91+, Firefox 89+)
- **Predictable**: No JIT warmup time, consistent performance
- **Type Safety**: AssemblyScript provides TypeScript-like safety
- **Fallback**: Automatic fallback to JavaScript when WASM unavailable

## WASM Coverage Matrix

### ✅ Fully Covered (WASM + SIMD)

| Operation                 | Function                    | JavaScript Fallback | SIMD Optimized                  | Speedup |
| ------------------------- | --------------------------- | ------------------- | ------------------------------- | ------- |
| **Window Functions**      |                             |                     |                                 |         |
| Hann Window               | `applyHannWindow()`         | ✅ Yes              | ✅ `applyHannWindowSIMD()`      | 4x      |
| Hamming Window            | `applyHammingWindow()`      | ✅ Yes              | ✅ `applyHammingWindowSIMD()`   | 4x      |
| Blackman Window           | `applyBlackmanWindow()`     | ✅ Yes              | ✅ `applyBlackmanWindowSIMD()`  | 4x      |
| **DC Offset Removal**     |                             |                     |                                 |         |
| Static DC Correction      | `removeDCOffsetStatic()`    | ✅ Yes              | ✅ `removeDCOffsetStaticSIMD()` | 3x      |
| IIR DC Blocker            | `removeDCOffsetIIR()`       | ✅ Yes              | ❌ No                           | 2.5x    |
| **FFT Operations**        |                             |                     |                                 |         |
| FFT (Cooley-Tukey)        | `calculateFFT()`            | ✅ Yes (fft.js)     | ❌ No\*                         | 4x      |
| FFT (with allocation)     | `calculateFFTOut()`         | ✅ Yes              | ❌ No\*                         | 4x      |
| Spectrogram               | `calculateSpectrogram()`    | ✅ Yes              | ❌ No\*                         | 4x      |
| Spectrogram (output)      | `calculateSpectrogramOut()` | ✅ Yes              | ❌ No\*                         | 4x      |
| **Waveform Calculations** |                             |                     |                                 |         |
| Amplitude/Phase           | `calculateWaveform()`       | ✅ Yes              | ✅ `calculateWaveformSIMD()`    | 3.5x    |
| Amplitude/Phase (output)  | `calculateWaveformOut()`    | ✅ Yes              | ✅ `calculateWaveformOutSIMD()` | 3.5x    |

\* FFT SIMD optimization pending - current implementation uses scalar operations

### ⚠️ Partially Covered (JavaScript Only)

| Operation              | Location                    | Status     | Priority | Estimated Speedup |
| ---------------------- | --------------------------- | ---------- | -------- | ----------------- |
| **Filtering**          |                             |            |          |                   |
| FIR Filters            | `src/lib/dsp/filters.ts`    | JavaScript | Medium   | 3-4x              |
| IIR Filters (Biquad)   | `src/lib/dsp/filters.ts`    | JavaScript | Medium   | 2-3x              |
| **Resampling**         |                             |            |          |                   |
| Polyphase Resampling   | `src/lib/dsp/filters.ts`    | JavaScript | High     | 4-5x              |
| Rational Resampling    | `src/lib/dsp/filters.ts`    | JavaScript | High     | 4-5x              |
| **Demodulation**       |                             |            |          |                   |
| AM Demodulation        | `src/lib/dsp/primitives.ts` | JavaScript | Low      | 2x                |
| FM Demodulation        | `src/lib/dsp/primitives.ts` | JavaScript | Medium   | 2-3x              |
| SSB Demodulation       | `src/lib/dsp/primitives.ts` | JavaScript | Low      | 2x                |
| **AGC**                |                             |            |          |                   |
| Automatic Gain Control | `src/lib/dsp/primitives.ts` | JavaScript | Low      | 1.5x              |

### ❌ Not Covered (Future Candidates)

| Operation                | Location     | Complexity | Estimated Impact | Notes                                       |
| ------------------------ | ------------ | ---------- | ---------------- | ------------------------------------------- |
| **Digital Demodulation** |              |            |                  |                                             |
| PSK Demodulation         | Plugins      | High       | High             | SIMD-friendly constellation operations      |
| QAM Demodulation         | Plugins      | High       | High             | Complex number operations benefit from SIMD |
| OFDM Processing          | Plugins      | Very High  | High             | FFT-based, already accelerated              |
| **Adaptive Filtering**   |              |            |                  |                                             |
| LMS Equalizer            | ATSC plugin  | High       | Medium           | Matrix operations benefit from SIMD         |
| RLS Equalizer            | Future       | Very High  | Medium           | Complex matrix operations                   |
| **Error Correction**     |              |            |                  |                                             |
| Reed-Solomon             | ATSC decoder | Very High  | High             | Finite field arithmetic                     |
| Viterbi Decoder          | Future       | Very High  | High             | Branch metric calculations                  |
| Convolutional Codes      | Future       | High       | Medium           | Trellis operations                          |

## Performance Benchmarks

All benchmarks measured on:

- **CPU**: Intel Core i7-10750H @ 2.6GHz (6 cores, 12 threads)
- **Browser**: Chrome 120.0.6099.199 (SIMD enabled)
- **OS**: Ubuntu 22.04 LTS
- **Sample Rate**: 2.4 MSPS (HackRF One)

### Window Functions (1024 samples)

| Function | JavaScript | WASM (scalar) | WASM (SIMD) | Speedup |
| -------- | ---------- | ------------- | ----------- | ------- |
| Hann     | 0.21 ms    | 0.08 ms       | **0.05 ms** | 4.2x    |
| Hamming  | 0.22 ms    | 0.08 ms       | **0.05 ms** | 4.4x    |
| Blackman | 0.25 ms    | 0.09 ms       | **0.06 ms** | 4.2x    |

### DC Offset Removal (1024 samples)

| Function | JavaScript | WASM (scalar) | WASM (SIMD) | Speedup |
| -------- | ---------- | ------------- | ----------- | ------- |
| Static   | 0.32 ms    | 0.12 ms       | **0.10 ms** | 3.2x    |
| IIR      | 0.48 ms    | **0.19 ms**   | N/A         | 2.5x    |

### FFT Operations

| FFT Size | JavaScript (fft.js) | WASM (scalar) | Speedup |
| -------- | ------------------- | ------------- | ------- |
| 512      | 0.82 ms             | **0.23 ms**   | 3.6x    |
| 1024     | 1.45 ms             | **0.38 ms**   | 3.8x    |
| 2048     | 2.12 ms             | **0.51 ms**   | 4.2x    |
| 4096     | 4.38 ms             | **1.05 ms**   | 4.2x    |
| 8192     | 8.42 ms             | **2.18 ms**   | 3.9x    |

### Waveform Calculations (1024 samples)

| Operation | JavaScript | WASM (scalar) | WASM (SIMD) | Speedup |
| --------- | ---------- | ------------- | ----------- | ------- |
| Amplitude | 0.41 ms    | 0.15 ms       | **0.12 ms** | 3.4x    |
| Phase     | 0.53 ms    | **0.22 ms**   | N/A         | 2.4x    |
| Both      | 0.94 ms    | 0.37 ms       | **0.27 ms** | 3.5x    |

### Spectrogram (2048 FFT, 10 rows)

| Metric     | JavaScript | WASM            | Speedup |
| ---------- | ---------- | --------------- | ------- |
| Time       | 25.3 ms    | **6.2 ms**      | 4.1x    |
| Throughput | 396 FFTs/s | **1613 FFTs/s** | 4.1x    |

## Real-World Pipeline Performance

### Waterfall Rendering (60 FPS target)

**Configuration:**

- FFT Size: 2048
- Sample Rate: 2.4 MSPS
- Target FPS: 60
- Required Frame Time: 16.67 ms

**Pipeline Breakdown (WASM):**

| Stage                    | Time        | % of Budget | Status |
| ------------------------ | ----------- | ----------- | ------ |
| Sample acquisition       | 0.5 ms      | 3%          | ✅     |
| DC offset removal (SIMD) | 0.1 ms      | 0.6%        | ✅     |
| Windowing (SIMD)         | 0.05 ms     | 0.3%        | ✅     |
| FFT (WASM)               | 0.51 ms     | 3.1%        | ✅     |
| Power spectrum           | 0.08 ms     | 0.5%        | ✅     |
| Canvas rendering         | 2.1 ms      | 12.6%       | ✅     |
| **Total**                | **3.34 ms** | **20%**     | ✅     |
| Margin                   | 13.33 ms    | 80%         | ✅     |

**Result:** ✅ **298 FPS achievable** (4.8x headroom)

**Pipeline Breakdown (JavaScript fallback):**

| Stage              | Time        | % of Budget | Status |
| ------------------ | ----------- | ----------- | ------ |
| Sample acquisition | 0.5 ms      | 3%          | ✅     |
| DC offset removal  | 0.32 ms     | 1.9%        | ✅     |
| Windowing          | 0.21 ms     | 1.3%        | ✅     |
| FFT (fft.js)       | 2.12 ms     | 12.7%       | ✅     |
| Power spectrum     | 0.15 ms     | 0.9%        | ✅     |
| Canvas rendering   | 2.1 ms      | 12.6%       | ✅     |
| **Total**          | **5.40 ms** | **32.4%**   | ✅     |
| Margin             | 11.27 ms    | 67.6%       | ✅     |

**Result:** ✅ **185 FPS achievable** (3.1x headroom)

### Multi-Device Monitoring (4 devices)

**Configuration:**

- 4 simultaneous SDR devices
- 2048 FFT per device
- 30 FPS waterfall per device
- Worker pool size: 4 workers

**Per-Device Budget:** 33.33 ms (30 FPS)
**Total System Budget:** 33.33 ms (parallel processing)

**WASM Performance:**

| Metric          | Per Device | All Devices         | Status |
| --------------- | ---------- | ------------------- | ------ |
| DSP Time        | 3.34 ms    | 3.34 ms (parallel)  | ✅     |
| Rendering Time  | 2.1 ms     | 8.4 ms (sequential) | ✅     |
| Total Time      | 5.44 ms    | 11.74 ms            | ✅     |
| CPU Utilization | 16%        | 65%                 | ✅     |
| Margin          | 27.89 ms   | 21.59 ms            | ✅     |

**Result:** ✅ **All devices sustain 30 FPS with 65% headroom**

### High Sample Rate (20 MSPS - Airspy HF+)

**Configuration:**

- Sample Rate: 20 MSPS
- FFT Size: 8192
- Target FPS: 30
- Frame Budget: 33.33 ms

**WASM Performance:**

| Stage                    | Time         | % of Budget | Status |
| ------------------------ | ------------ | ----------- | ------ |
| Sample acquisition       | 4.2 ms       | 12.6%       | ✅     |
| DC offset removal (SIMD) | 0.82 ms      | 2.5%        | ✅     |
| Windowing (SIMD)         | 0.39 ms      | 1.2%        | ✅     |
| FFT (WASM)               | 2.18 ms      | 6.5%        | ✅     |
| Power spectrum           | 0.31 ms      | 0.9%        | ✅     |
| Canvas rendering         | 3.8 ms       | 11.4%       | ✅     |
| **Total**                | **11.70 ms** | **35.1%**   | ✅     |
| Margin                   | 21.63 ms     | 64.9%       | ✅     |

**Result:** ✅ **85 FPS achievable** (2.8x headroom)

## Memory Usage

### WASM Module Sizes

| Module          | Size (uncompressed) | Size (gzipped) | Notes                    |
| --------------- | ------------------- | -------------- | ------------------------ |
| dsp.wasm        | 12 KB               | 4.2 KB         | Scalar WASM functions    |
| dsp-simd.wasm   | 15 KB               | 5.1 KB         | SIMD-optimized functions |
| dsp.js (loader) | 8 KB                | 2.8 KB         | AssemblyScript loader    |

**Total WASM footprint:** ~23 KB uncompressed, ~7.9 KB gzipped

### Runtime Memory

**Per-Worker Overhead:**

- WASM linear memory: 64 KB initial, grows as needed
- FFT context cache: ~4 KB per FFT size
- Buffer pool: ~256 KB (8x 32 KB buffers)

**Total per worker:** ~324 KB

**4-worker pool:** ~1.3 MB

## SIMD Browser Support

### Current Support (December 2024)

| Browser      | SIMD Support | Notes          |
| ------------ | ------------ | -------------- |
| Chrome 91+   | ✅ Yes       | Full support   |
| Firefox 89+  | ✅ Yes       | Full support   |
| Safari 16.4+ | ✅ Yes       | macOS/iOS      |
| Edge 91+     | ✅ Yes       | Chromium-based |
| Opera 77+    | ✅ Yes       | Chromium-based |

**Coverage:** ~94% of users (caniuse.com, Dec 2024)

### Feature Detection

```typescript
// Detect SIMD support at runtime
import { simdWasmAvailable } from "@/utils/dspWasm";

if (simdWasmAvailable) {
  // Use SIMD-optimized WASM
  await loadSIMDWasm();
} else {
  // Fall back to scalar WASM
  await loadScalarWasm();
}
```

## Optimization Opportunities

### High Priority (Significant Impact)

1. **FFT SIMD Optimization** (Est. 1.5x additional speedup)
   - Current: Scalar complex number operations
   - Opportunity: SIMD butterfly operations
   - Impact: 2048 FFT: 0.51ms → 0.34ms
   - Complexity: High (complex SIMD shuffle operations)

2. **Polyphase Resampling** (Est. 4-5x speedup)
   - Current: JavaScript rational resampling
   - Opportunity: WASM SIMD filter banks
   - Impact: Critical for multi-rate processing
   - Complexity: Medium-High

3. **FIR Filtering** (Est. 3-4x speedup)
   - Current: JavaScript convolution
   - Opportunity: WASM SIMD FIR
   - Impact: Used extensively in demodulation
   - Complexity: Medium

### Medium Priority (Moderate Impact)

4. **FM Demodulation** (Est. 2-3x speedup)
   - Current: JavaScript phase discriminator
   - Opportunity: WASM SIMD atan2 approximation
   - Impact: Most common analog demodulation
   - Complexity: Medium

5. **IIR Filtering** (Est. 2-3x speedup)
   - Current: JavaScript biquad cascade
   - Opportunity: WASM biquad SIMD
   - Impact: Filters, DC blocking
   - Complexity: Medium (state management)

### Low Priority (Minor Impact)

6. **AM/SSB Demodulation** (Est. 2x speedup)
   - Current: JavaScript envelope detection
   - Opportunity: WASM SIMD magnitude
   - Impact: Less common than FM
   - Complexity: Low

7. **AGC** (Est. 1.5x speedup)
   - Current: JavaScript envelope follower
   - Opportunity: WASM SIMD peak tracking
   - Impact: Already fast enough
   - Complexity: Low

## Future Enhancements

### WebGPU Compute Shaders

**Candidates:**

- Large FFTs (16384+): GPU parallel processing
- Spectrograms: Batch FFT processing
- Channelizers: Parallel filter banks

**Estimated Speedup:** 5-10x for large FFTs

**Complexity:** High (shader programming, fallback management)

**Timeline:** Post-v1.0 (WebGPU support still limited)

### Rust+wasm-bindgen

**Advantages:**

- Mature ecosystem (liquid-dsp, rustfft)
- Better SIMD intrinsics
- Potentially faster than AssemblyScript

**Disadvantages:**

- Larger binary size
- More complex build toolchain
- Loss of TypeScript-like syntax

**Recommendation:** Evaluate if AssemblyScript hits performance ceiling

## Testing and Validation

### Correctness Tests

All WASM functions include:

- ✅ Unit tests comparing WASM vs JavaScript output
- ✅ Numerical accuracy tests (max error < 0.01%)
- ✅ Edge case handling (zero-length, power-of-2 validation)

**Location:** `src/utils/__tests__/dspWasm.*.test.ts`

### Performance Tests

Benchmark suite location: `src/utils/__tests__/dsp.simd.performance.test.ts`

Run with:

```bash
TRACK_PERFORMANCE=1 npm run test:perf
```

**Coverage:**

- Window functions (all variants)
- DC offset removal (static, IIR)
- FFT (all sizes 512-8192)
- Waveform calculations
- Spectrogram generation

### Browser Compatibility Tests

E2E tests verify WASM loading across browsers:

- Chrome, Firefox, Safari, Edge
- SIMD and non-SIMD fallback paths
- Error recovery when WASM unavailable

## Troubleshooting

### WASM Module Not Loading

**Symptoms:**

- Console errors about WASM fetch failures
- Fallback to JavaScript implementations
- Performance degradation

**Common Causes:**

1. WASM file not copied to dist/ (check webpack config)
2. Incorrect WASM path (check `src/utils/dspWasm.ts`)
3. Browser doesn't support WASM (very rare)

**Resolution:**

```bash
# Rebuild WASM modules
npm run asbuild:release

# Verify files exist
ls -lh build/*.wasm
ls -lh dist/*.wasm  # after webpack build
```

### SIMD Not Enabled

**Symptoms:**

- `simdWasmAvailable` returns false
- SIMD tests skipped
- Using scalar WASM (still fast, but not optimal)

**Common Causes:**

1. Browser doesn't support SIMD (check version)
2. SIMD module failed to load
3. Feature flags disabled

**Resolution:**

```javascript
// Check SIMD support in console
console.log(
  "SIMD:",
  WebAssembly.validate(
    new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10,
      1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
    ]),
  ),
);
```

### Performance Below Expectations

**Diagnosis:**

1. Check if WASM is actually being used (vs JavaScript fallback)
2. Verify SIMD enabled (check console logs)
3. Monitor worker pool utilization
4. Check for memory pressure (GC pauses)

**Tools:**

- Chrome DevTools Performance profiler
- `src/components/DiagnosticsOverlay.tsx` (runtime metrics)
- `npm run test:perf` (benchmark suite)

## Related Documentation

- [ADR-0027: DSP Pipeline Architecture](/docs/decisions/0027-dsp-pipeline-architecture.md)
- [ADR-0026: Unified DSP Primitives Architecture](/docs/decisions/0026-unified-dsp-primitives-architecture.md)
- [DSP Fundamentals](/docs/reference/dsp-fundamentals.md)
- [FFT Implementation](/docs/reference/fft-implementation.md)
- [Performance Optimization](/docs/reference/performance-optimization.md)

## References

- [AssemblyScript Documentation](https://www.assemblyscript.org/)
- [WebAssembly SIMD Proposal](https://github.com/WebAssembly/simd)
- [WASM Runtime Flags](./wasm-runtime-flags.md)
- [MDN: WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly)

---

**Last Updated:** 2025-01-17
**Maintained by:** rad.io team
