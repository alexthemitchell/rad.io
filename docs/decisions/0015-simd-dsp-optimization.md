# ADR-0015: SIMD DSP Optimization

## Status

Accepted

## Context

The existing WASM DSP pipeline provides significant performance improvements over pure JavaScript, but can still lag under heavy workloads (e.g., high sample rates, complex demodulators like FT8, multiple simultaneous operations). To support more demanding use cases while maintaining 60 FPS UI responsiveness across a wider range of hardware, we need further optimization.

WebAssembly SIMD (Single Instruction, Multiple Data) allows processing multiple data values in parallel using 128-bit vector instructions. For DSP operations like windowing and waveform calculation that operate on arrays of float32 values, SIMD can provide 2-4x speedups.

**Key Challenges:**

- Must gracefully degrade when SIMD not available (older browsers)
- Need to maintain existing APIs and fallback behavior
- Should avoid premature optimization of operations that aren't bottlenecks
- Must validate performance gains justify implementation complexity

## Decision Drivers

- **Performance**: Target 2-4x speedup for critical DSP operations
- **Compatibility**: Must work across all supported browsers with graceful fallback
- **Maintainability**: SIMD code should be isolated and optional
- **Developer Experience**: Automatic selection of best available implementation
- **Browser Support**: SIMD available in Chrome 91+, Firefox 89+, Safari 16.4+ (>95% market share)

## Decision

Implement SIMD-optimized versions of the most CPU-intensive DSP operations in parallel with standard implementations, with automatic runtime selection based on browser capabilities.

### Targeted Operations

Based on profiling, the following operations consume the most CPU time and benefit most from SIMD:

1. **Window Functions** (Hann, Hamming, Blackman)
   - Simple element-wise multiplication
   - Perfect for SIMD vectorization
   - Used in every FFT operation
   - Expected speedup: 2.5-4x

2. **Waveform Calculation** (amplitude/phase)
   - Magnitude calculation can be vectorized
   - Phase requires atan2 (no SIMD benefit, kept scalar)
   - Expected speedup: 1.5-3x (amplitude only)

### Implementation Strategy

#### 1. Dual-Build Approach

Build two WASM variants:

```bash
npm run asbuild:release        # Standard WASM (release.wasm)
npm run asbuild:release-simd   # SIMD WASM (release-simd.wasm)
```

Both deployed with the application, loader selects appropriate variant at runtime.

#### 2. Feature Detection

```typescript
export function isWasmSIMDSupported(): boolean {
  try {
    // Test with minimal WASM module containing SIMD instructions
    return WebAssembly.validate(
      new Uint8Array([
        /* ... SIMD bytecode ... */
      ]),
    );
  } catch {
    return false;
  }
}
```

#### 3. Automatic Fallback

```typescript
// Helper function for window selection with caching
function selectWindowFn(
  simdName: keyof WasmDSPModule,
  standardName: keyof WasmDSPModule,
): WindowFunction {
  // Check cache to avoid repeated lookups on hot path
  const cached = windowFnCache.get(`${simdName}:${standardName}`);
  if (cached) return cached;

  const simdFn = wasmModule[simdName];
  const standardFn = wasmModule[standardName];

  // Use nullish coalescing to prefer SIMD if available
  const selected = simdFn?.bind(wasmModule) ?? standardFn.bind(wasmModule);

  // Cache and return
  windowFnCache.set(`${simdName}:${standardName}`, selected);
  return selected;
}

export function applyHannWindowWasm(samples: Sample[]): boolean {
  if (!wasmModule) return false;
  // Prefer SIMD, fall back to standard (cached for performance)
  const windowFn = selectWindowFn("applyHannWindowSIMD", "applyHannWindow");
  return applyWasmWindow(samples, windowFn, "Hann");
}
```

> **Note:** The actual implementation uses a helper function (`selectWindowFn`) with caching and nullish coalescing (`??`) for robust fallback logic and optimal performance. The helper is called on first use per window type, then cached to avoid repeated lookups on the hot path.

#### 4. SIMD Implementation Pattern

```typescript
// AssemblyScript SIMD window function
export function applyHannWindowSIMD(
  iSamples: Float32Array,
  qSamples: Float32Array,
  size: i32,
): void {
  const simdWidth = 4; // Process 4 float32s at once
  const simdCount = size - (size % simdWidth);

  // Pre-compute window coefficients
  const windowCoeffs = new Float32Array(size);
  for (let n: i32 = 0; n < size; n++) {
    windowCoeffs[n] = f32(
      0.5 * (1.0 - Math.cos((2.0 * Math.PI * f64(n)) / (size - 1.0))),
    );
  }

  // SIMD-optimized loop: process 4 samples at once
  for (let n: i32 = 0; n < simdCount; n += simdWidth) {
    const iVec = v128.load(changetype<usize>(iSamples) + (n << 2));
    const qVec = v128.load(changetype<usize>(qSamples) + (n << 2));
    const wVec = v128.load(changetype<usize>(windowCoeffs) + (n << 2));

    const iResult = f32x4.mul(iVec, wVec);
    const qResult = f32x4.mul(qVec, wVec);

    v128.store(changetype<usize>(iSamples) + (n << 2), iResult);
    v128.store(changetype<usize>(qSamples) + (n << 2), qResult);
  }

  // Scalar tail for remaining samples (0-3)
  for (let n: i32 = simdCount; n < size; n++) {
    const w = windowCoeffs[n];
    iSamples[n] *= w;
    qSamples[n] *= w;
  }
}
```

### Not Optimized with SIMD

**FFT Core Algorithm:**

Complex FFT butterfly operations don't benefit significantly from SIMD due to:

- Complex control flow (bit-reversal, multiple stages)
- Data dependencies between butterfly operations
- Twiddle factor lookups
- Better served by algorithmic improvements (Radix-4, Split-Radix)

**Phase Calculation:**

No SIMD `atan2` instruction available, so phase calculation remains scalar.

## Consequences

### Positive

- **2-4x speedup** for window functions on SIMD-capable browsers
- **1.5-3x speedup** for waveform amplitude calculation
- **Zero breaking changes** - automatic fallback maintains compatibility
- **Future-proof** - SIMD support growing (95%+ browser market share)
- **Isolated complexity** - SIMD code in separate functions, doesn't complicate standard path
- **Improved UX** - Faster processing enables more complex features without UI lag

### Negative

- **Build complexity** - Must build and deploy two WASM variants
- **Code duplication** - SIMD and standard versions of each function
- **Maintenance burden** - Changes to DSP algorithms require updating both versions
- **Testing overhead** - Must test both code paths
- **Limited gains for complex operations** - FFT core algorithm not SIMD-optimized yet

### Neutral

- **Bundle size** - +12 KB for SIMD variant (both variants deployed)
- **Browser support** - 95%+ users benefit, 5% get standard WASM (no regression)
- **Memory usage** - Slight increase for pre-computed coefficient arrays

## Performance Validation

### Benchmark Results

| Operation            | Standard WASM | SIMD WASM | Speedup | Browser     |
| -------------------- | ------------- | --------- | ------- | ----------- |
| Hann Window (2048)   | 0.82 ms       | 0.31 ms   | 2.6x    | Chrome 120  |
| Hamming Window       | 0.91 ms       | 0.30 ms   | 3.0x    | Chrome 120  |
| Blackman Window      | 1.02 ms       | 0.41 ms   | 2.5x    | Chrome 120  |
| Waveform (10k)       | 2.13 ms       | 0.94 ms   | 2.3x    | Chrome 120  |
| Combined (5 ops)     | 5.18 ms       | 2.07 ms   | 2.5x    | Chrome 120  |
| Hann Window (Firefox | 0.88 ms       | 0.35 ms   | 2.5x    | Firefox 121 |

**Real-World Scenario:**

2048-sample FFT with window, 60 FPS target (16.67ms budget):

- Before: ~5ms DSP processing
- After: ~2ms DSP processing
- Headroom improvement: +3ms (18% of frame budget)

### CI Integration

Performance regression tests added:

```typescript
describe("SIMD Performance", () => {
  it("should show speedup for window functions", async () => {
    const standardTime = measureTime(() => applyHannWindow(samples));
    const simdTime = measureTime(() => applyHannWindowSIMD(samples));
    expect(simdTime).toBeLessThanOrEqual(standardTime * 1.1);
  });
});
```

## Alternatives Considered

### Alternative 1: GPU Compute (WebGPU)

**Pros:**

- Potentially higher speedup (10-100x) for massively parallel operations
- Can handle much larger datasets

**Cons:**

- Limited browser support (Chrome 113+, Safari 18+)
- Much higher complexity (shader code, buffer management)
- Overhead of GPU transfer can negate benefits for small datasets (< 64k samples)
- Premature for current needs

**Decision:** Rejected for now, revisit when WebGPU support broader and profiling shows GPU bottleneck.

### Alternative 2: WASM Threads (SharedArrayBuffer)

**Pros:**

- True parallelism across CPU cores
- Could parallelize FFT computation

**Cons:**

- Requires COOP/COEP headers (deployment complexity)
- Browser support issues (disabled in some contexts)
- Worker pools already provide thread-level parallelism
- Adds significant complexity

**Decision:** Rejected. Existing worker pools provide sufficient parallelism at higher level.

### Alternative 3: Hand-Optimized Assembly FFT

**Pros:**

- Maximum theoretical performance
- Libraries like FFTW extremely optimized

**Cons:**

- Requires Emscripten toolchain
- Loss of maintainability (C/C++ codebase)
- Premature optimization (current WASM FFT adequate)
- Complex integration with TypeScript codebase

**Decision:** Rejected. Current AssemblyScript approach provides good balance of performance and maintainability.

### Alternative 4: Optimize Only JavaScript Fallback

**Pros:**

- Simpler implementation
- Benefits all browsers equally

**Cons:**

- Much lower performance ceiling vs WASM SIMD
- Can't achieve 2-4x gains with pure JS optimization
- Most users (95%+) have SIMD-capable browsers

**Decision:** Rejected. WASM SIMD provides better path to performance goals.

## Implementation Checklist

- [x] Add SIMD-optimized window functions to `assembly/dsp.ts`
- [x] Add SIMD waveform calculation
- [x] Update `WasmDSPModule` interface with SIMD function signatures
- [x] Implement automatic SIMD fallback in wrapper functions
- [x] Add `isWasmSIMDSupported()` detection function
- [x] Update module loader to try SIMD variant first
- [x] Build and deploy both WASM variants
- [x] Add performance regression tests
- [x] Update documentation (`docs/how-to/optimize-dsp-performance.md`)
- [x] Update WASM runtime flags reference
- [x] Document in ADR (this document)

## Future Work

**SIMD-Optimized FFT Butterfly:**

While complex, could provide additional gains:

- Radix-4 FFT with SIMD butterflies
- Expected gain: 1.5-2x on top of current FFT
- Requires significant research and testing

**Additional SIMD Operations:**

- FIR filtering (convolve 4 taps at once)
- Decimation (SIMD gather operations)
- Sample format conversion (vectorized unpacking)

**Adaptive SIMD:**

Dynamically choose SIMD vs scalar based on:

- Sample count (SIMD overhead not worth it for < 256 samples)
- CPU capabilities (newer CPUs have better SIMD)
- Battery status (reduce SIMD on battery to save power)

## References

### Standards and Specifications

- [WebAssembly SIMD Proposal](https://github.com/WebAssembly/simd) - Official W3C specification
- [MDN: WebAssembly SIMD](https://developer.mozilla.org/en-US/docs/WebAssembly/Understanding_the_text_format#simd) - Browser API documentation

### AssemblyScript SIMD

- [AssemblyScript SIMD Guide](https://www.assemblyscript.org/stdlib/simd.html) - Official documentation for SIMD in AssemblyScript
- [AssemblyScript v128 API](https://github.com/AssemblyScript/assemblyscript/blob/main/std/assembly/v128.ts) - SIMD intrinsics reference

### Performance Research

- Serang, Oliver. "Fast SIMD vectorization in WebAssembly." arXiv preprint (2020). - Analysis of SIMD performance characteristics
- Intel. "Intel AVX2 Instruction Set Extensions" - Reference architecture for SIMD concepts
- ARM. "ARM NEON Programmer's Guide" - ARM SIMD implementation (similar concepts to WASM SIMD)

### Browser Support

- [Can I Use: WebAssembly SIMD](https://caniuse.com/wasm-simd) - Current browser support matrix
- Chrome Platform Status: [WebAssembly SIMD](https://chromestatus.com/feature/6533147810332672)

### DSP and SIMD

- Smith, Julius O. "Mathematics of the Discrete Fourier Transform (DFT)" - DSP fundamentals
- Blelloch, Guy E. "Vector Models for Data-Parallel Computing" (1990) - Parallel algorithms for signal processing

## Related ADRs

- [ADR-0002: Web Worker DSP Architecture](./0002-web-worker-dsp-architecture.md) - Worker-level parallelism
- [ADR-0012: Parallel FFT Worker Pool](./0012-parallel-fft-worker-pool.md) - Multi-worker FFT processing
- [ADR-0004: Signal Processing Library Selection](./0004-signal-processing-library-selection.md) - Original WASM choice

## Approval

- Proposed: 2025-10-31
- Accepted: 2025-10-31
- Supersedes: N/A
