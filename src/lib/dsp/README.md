# DSP Primitives Library

Unified digital signal processing primitives for rad.io. Provides core DSP operations with TypeScript and WASM implementations.

## Overview

The `src/lib/dsp/` module consolidates DSP primitives that were previously duplicated across the codebase. This provides:

- **Single source of truth** for core DSP algorithms
- **Automatic WASM acceleration** with JavaScript fallback
- **Type safety** through strict TypeScript
- **Comprehensive testing** of all primitives
- **Consistent API** across the application

## Architecture

```
┌─────────────────────────────────────────────┐
│   Application Layer                        │
│   (Demodulators, Visualizations, etc.)    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   Unified DSP Primitives (src/lib/dsp/)    │
│   - Window functions                        │
│   - DC offset correction                    │
│   - AGC (Automatic Gain Control)           │
└─────────────────────────────────────────────┘
         ↓                           ↓
┌──────────────────┐      ┌──────────────────┐
│ TypeScript/JS    │      │ WASM (assembly/) │
│ (Fallback)       │      │ (SIMD-optimized) │
└──────────────────┘      └──────────────────┘
```

## Usage

> **Note on Sample Type**: The `Sample` type is currently imported from `@/utils/dsp` rather than `@/lib/dsp` because it's used extensively throughout the codebase in FFT and signal processing functions. While `Sample` is re-exported from `@/lib/dsp/types`, the canonical location remains `@/utils/dsp` for now to avoid breaking changes. Future versions may consolidate this.

### Window Functions

Apply window functions to reduce spectral leakage in FFT analysis:

```typescript
import { applyWindow } from "@/lib/dsp";
import type { Sample } from "@/utils/dsp";

const samples: Sample[] = [
  { I: 0.5, Q: 0.3 },
  { I: 0.7, Q: -0.2 },
  // ...
];

// Apply Hann window (recommended for general use)
const windowed = applyWindow(samples, "hann");

// Other window types
const hamming = applyWindow(samples, "hamming"); // Better sidelobe suppression
const blackman = applyWindow(samples, "blackman"); // Excellent sidelobe suppression
const kaiser = applyWindow(samples, "kaiser"); // Adjustable (uses default beta=5)
const rect = applyWindow(samples, "rectangular"); // No windowing
```

### DC Offset Correction

Remove DC offset caused by hardware imperfections:

```typescript
import { removeDCOffset, createDCBlockerState } from "@/lib/dsp";
import type { DCBlockerState } from "@/lib/dsp";
import type { Sample } from "@/utils/dsp";

const samples: Sample[] = /* ... */;

// Simple static DC removal (one-time correction)
const corrected = removeDCOffset(samples, "static");

// IIR DC blocker (tracks time-varying DC offset)
const state = createDCBlockerState();
const corrected1 = removeDCOffset(samples1, "iir", state);
const corrected2 = removeDCOffset(samples2, "iir", state); // State preserved

// Combined approach (best quality)
const corrected = removeDCOffset(samples, "combined", state);
```

### Automatic Gain Control

Maintain consistent signal amplitude:

```typescript
import { applyAGC } from "@/lib/dsp";
import type { AGCParameters } from "@/lib/dsp";
import type { Sample } from "@/utils/dsp";

const samples: Sample[] = /* ... */;

// Default parameters
const normalized = applyAGC(samples);

// Custom parameters
const params: AGCParameters = {
  targetLevel: 0.8,
  attackRate: 0.02,   // Faster gain reduction
  releaseRate: 0.001, // Slower gain increase
  minGain: 0.01,
  maxGain: 10.0,
};
const normalized = applyAGC(samples, params);
```

## Available Primitives

### Window Functions

| Function    | Sidelobe Level | Main Lobe Width | Use Case                              |
| ----------- | -------------- | --------------- | ------------------------------------- |
| Hann        | -31 dB         | 4 bins          | General purpose spectrum analysis     |
| Hamming     | -43 dB         | 4 bins          | Better sidelobe suppression           |
| Blackman    | -58 dB         | 6 bins          | Weak signal detection                 |
| Kaiser      | Variable       | Variable        | Adjustable trade-off (beta parameter) |
| Rectangular | 0 dB           | 2 bins          | No windowing (maximum leakage)        |

### DC Correction Modes

| Mode     | Complexity | Tracks Varying DC | Use Case                           |
| -------- | ---------- | ----------------- | ---------------------------------- |
| static   | O(n)       | No                | Large blocks with stable DC offset |
| iir      | O(n)       | Yes               | Time-varying DC offset             |
| combined | O(n)       | Yes               | Best quality (static + IIR)        |
| none     | O(1)       | N/A               | No correction needed               |

### AGC Parameters

| Parameter   | Default | Range | Description              |
| ----------- | ------- | ----- | ------------------------ |
| targetLevel | 0.7     | 0-1   | Desired output amplitude |
| attackRate  | 0.01    | 0-1   | Rate of gain reduction   |
| releaseRate | 0.001   | 0-1   | Rate of gain increase    |
| minGain     | 0.01    | >0    | Minimum allowed gain     |
| maxGain     | 10.0    | >0    | Maximum allowed gain     |

## Performance

All primitives support both JavaScript and WASM implementations:

| Operation   | Size         | JS Performance | WASM Performance | Speedup |
| ----------- | ------------ | -------------- | ---------------- | ------- |
| Hann Window | 1024 samples | ~0.2ms         | ~0.05ms          | 4x      |
| DC Static   | 1024 samples | ~0.3ms         | ~0.1ms           | 3x      |
| DC IIR      | 1024 samples | ~0.5ms         | ~0.2ms           | 2.5x    |

WASM acceleration is automatically enabled when available. To disable:

```typescript
const windowed = applyWindow(samples, "hann", false); // useWasm = false
const corrected = removeDCOffset(samples, "static", undefined, 0.99, false);
```

## Migration from Legacy API

The old `src/utils/dspProcessing.ts` API is deprecated but still works as a compatibility layer:

```typescript
// OLD (deprecated)
import { applyHannWindow, removeDCOffsetStatic } from "@/utils/dspProcessing";
const windowed = applyHannWindow(samples);
const corrected = removeDCOffsetStatic(samples);

// NEW (recommended)
import { applyWindow, removeDCOffset } from "@/lib/dsp";
const windowed = applyWindow(samples, "hann");
const corrected = removeDCOffset(samples, "static");
```

## Implementation Notes

### Shared vs. Module-Specific DSP

**Shared Primitives** (in `src/lib/dsp/`):

- Window functions, DC correction, AGC, filters
- Have standard optimal implementations
- Reusable across multiple use cases

**Module-Specific DSP** (in `src/plugins/demodulators/`, etc.):

- Demodulation algorithms (AM, FM, SSB, 8-VSB)
- Timing recovery, carrier recovery, equalization
- Protocol-specific sync detection
- Require domain expertise for specific modulation schemes

### WASM Integration

The WASM implementations in `assembly/dsp.ts` provide:

- SIMD-optimized operations (when browser supports SIMD)
- 2-4x performance improvement
- Automatic fallback to JavaScript when unavailable
- Same API and results as JavaScript implementations

## Testing

All primitives have comprehensive test coverage:

```bash
npm test -- src/lib/dsp/__tests__/
npm test -- src/utils/__tests__/dcCorrection.test.ts
npm test -- src/utils/__tests__/dspProcessing.test.ts
```

Tests verify:

- Correctness of algorithms
- WASM/JavaScript equivalence
- Edge case handling
- Performance characteristics

## References

- **ADR-0026**: Unified DSP Primitives Architecture
- **docs/reference/dsp-fundamentals.md**: DSP concepts and theory
- **docs/reference/dc-offset-correction.md**: DC correction algorithms
- **docs/reference/fft-implementation.md**: FFT implementation details

## Future Enhancements

Planned additions to the DSP primitives library:

- **FFT operations** (currently in `src/utils/dsp.ts`)
- **Digital filters** (FIR, IIR, Butterworth, Chebyshev)
- **Sample rate conversion** (decimation, interpolation)
- **Signal analysis** (RMS, peak, SNR calculation)
- **Format conversions** (Sample[] ↔ Float32Array)

These will be added incrementally while maintaining backward compatibility.
