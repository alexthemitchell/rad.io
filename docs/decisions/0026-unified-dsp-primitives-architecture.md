# ADR-0026: Unified DSP Primitives Architecture

## Status

Accepted

## Context and Problem Statement

The rad.io codebase currently has DSP primitives (FFT, DC correction, windowing functions) implemented in multiple locations:

1. **Generic DSP Pipeline**: `src/utils/dspProcessing.ts` (TypeScript/JavaScript) and `assembly/dsp.ts` (AssemblyScript/WASM)
2. **ATSC Demodulator**: `src/plugins/demodulators/ATSC8VSBDemodulator.ts` with inline DSP operations
3. **Worker Integration**: Various DSP workers that duplicate primitive operations

This duplication creates several problems:

- **Bug Risk**: Fixes to DC correction or windowing in one location may not propagate to others
- **Performance Inconsistency**: Optimizations (e.g., SIMD) applied to one implementation don't benefit all users
- **Maintenance Burden**: Similar algorithms must be tested, documented, and maintained separately
- **API Fragmentation**: Different modules use different function signatures for the same operations
- **Tech Debt**: Growing codebase complexity as new demodulators and processors are added

How do we consolidate DSP primitives into a single, shared, well-tested layer while maintaining performance and allowing for legitimate specialization when needed?

## Decision Drivers

- **DRY Principle**: Eliminate duplicate implementations of core DSP algorithms
- **Performance**: Maintain or improve WASM/SIMD optimization benefits across all use cases
- **Type Safety**: Preserve strict TypeScript typing while supporting both Sample[] and Float32Array interfaces
- **Testability**: Enable comprehensive testing of DSP primitives in isolation
- **Extensibility**: Support future demodulators and signal processors without code duplication
- **API Clarity**: Provide clear boundaries between shared primitives and module-specific logic
- **Documentation**: Make DSP architecture understandable for new contributors
- **Backward Compatibility**: Minimize breaking changes to existing code

## Considered Options

### Option 1: Unified DSP Primitives Layer (Chosen)

Create a shared `src/lib/dsp/` directory structure:

```
src/lib/dsp/
├── primitives.ts        # Core DSP primitives (windowing, DC correction)
├── fft.ts              # FFT operations (delegates to WASM)
├── filters.ts          # Digital filters (FIR, IIR)
├── analysis.ts         # Spectrum analysis, signal metrics
├── conversions.ts      # Sample format conversions
└── __tests__/          # Comprehensive primitive tests
```

**Approach**:

- Move all window functions to `primitives.ts` with unified API
- Move all DC correction functions to `primitives.ts`
- Provide both `Sample[]` and `Float32Array` interfaces via adapter functions
- ATSC and other demodulators import and use shared primitives
- WASM implementations remain in `assembly/dsp.ts` but accessed through shared TypeScript layer

### Option 2: Keep Duplication with Documentation

Document why duplication exists and mark it as "intentional for performance isolation."

**Approach**:

- Add comments explaining duplication rationale
- Create test suites ensuring implementations stay in sync
- Update architecture docs to acknowledge parallel implementations

### Option 3: WASM-Only Approach

Force all DSP operations through WASM, removing TypeScript implementations entirely.

**Approach**:

- Delete JavaScript/TypeScript DSP implementations
- Make WASM loading mandatory
- Fallback to no-op or error if WASM unavailable

### Option 4: Module-Specific DSP

Allow each demodulator/processor to implement its own DSP operations.

**Approach**:

- Remove shared DSP utilities
- Each plugin implements needed primitives
- Optimize for plugin-specific use cases

## Decision Outcome

Chosen option: **"Option 1: Unified DSP Primitives Layer"** because it provides the best balance of code reuse, maintainability, and performance while preserving TypeScript/JavaScript fallbacks for environments where WASM is unavailable.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                    │
│  (Demodulators, Visualizations, Analysis Plugins)      │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────┐
│              Unified DSP Primitives Layer               │
│  src/lib/dsp/                                           │
│  ├── primitives.ts  (windowing, DC, AGC)               │
│  ├── fft.ts        (FFT, IFFT, spectrum)               │
│  ├── filters.ts    (FIR, IIR, resampling)              │
│  └── conversions.ts (Sample[] ↔ Float32Array)          │
└─────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ↓                         ↓
┌──────────────────────┐   ┌──────────────────────┐
│   TypeScript/JS      │   │   WASM (assembly/)   │
│   Implementations    │   │   SIMD-optimized     │
│   (Fallback)         │   │   (Preferred)        │
└──────────────────────┘   └──────────────────────┘
```

### Shared vs. Module-Specific Logic

**Shared Primitives** (in `src/lib/dsp/`):

- Window functions: Hann, Hamming, Blackman, Kaiser
- DC offset correction: Static, IIR, Combined
- FFT/IFFT: Forward/inverse transforms with configurable sizes
- Basic filters: Low-pass, high-pass, band-pass
- Sample conversions: Format transformations
- AGC: Automatic gain control
- Signal metrics: RMS, peak, SNR calculation

**Module-Specific Logic** (in plugins/demodulators):

- Demodulation algorithms (AM, FM, SSB, 8-VSB, etc.)
- Specialized equalization (ATSC adaptive equalizer)
- Timing recovery (Gardner detector, symbol sync)
- Protocol-specific sync detection (segment sync, field sync)
- Carrier/phase recovery (PLL, Costas loop)
- Forward error correction (Reed-Solomon, convolutional)

**Rationale for Separation**:

- **Primitives are reusable** across multiple demodulators and processors
- **Module logic is specialized** to specific modulation schemes or protocols
- **Primitives have standard implementations** with well-known optimal algorithms
- **Module logic requires domain expertise** specific to the protocol being decoded

### Implementation Plan

#### Phase 1: Create Shared Layer

1. Create `src/lib/dsp/` directory structure
2. Move window functions from `dspProcessing.ts` to `primitives.ts`
3. Move DC correction functions to `primitives.ts`
4. Provide unified API supporting both `Sample[]` and `Float32Array`
5. Maintain WASM integration through existing `dspWasm.ts` facade

#### Phase 2: Update Consumers

1. Update ATSC demodulator to import from shared primitives
2. Update visualization pipeline to use new imports
3. Update workers to use shared primitives
4. Remove duplicate implementations

#### Phase 3: Testing & Documentation

1. Move/consolidate tests to `src/lib/dsp/__tests__/`
2. Update architecture documentation
3. Add inline JSDoc with references to shared implementations
4. Performance benchmarking to ensure no regressions

### API Design

```typescript
// src/lib/dsp/primitives.ts

/**
 * Window function types supported by the DSP library
 */
export type WindowFunction =
  | "rectangular"
  | "hann"
  | "hamming"
  | "blackman"
  | "kaiser";

/**
 * DC correction algorithm modes
 */
export type DCCorrectionMode = "none" | "static" | "iir" | "combined";

/**
 * Apply window function to samples
 * Supports both Sample[] and Float32Array via overloads
 */
export function applyWindow(
  samples: Sample[],
  windowType: WindowFunction,
  useWasm?: boolean,
): Sample[];

export function applyWindow(
  iSamples: Float32Array,
  qSamples: Float32Array,
  windowType: WindowFunction,
  useWasm?: boolean,
): void;

/**
 * Remove DC offset from samples
 */
export function removeDCOffset(
  samples: Sample[],
  mode: DCCorrectionMode,
  state?: DCBlockerState,
  useWasm?: boolean,
): Sample[];

export function removeDCOffset(
  iSamples: Float32Array,
  qSamples: Float32Array,
  mode: DCCorrectionMode,
  state?: DCBlockerState,
  useWasm?: boolean,
): void;

/**
 * AGC with configurable attack/release
 */
export function applyAGC(
  samples: Sample[],
  targetLevel?: number,
  attackRate?: number,
  releaseRate?: number,
): Sample[];
```

### Migration Strategy

**Backward Compatibility**:

- Existing `src/utils/dspProcessing.ts` functions remain as thin wrappers calling `src/lib/dsp/primitives.ts`
- Deprecation warnings added via JSDoc `@deprecated` tags
- Full removal of wrappers in next major version

**Import Migration**:

```typescript
// OLD (deprecated but still works)
import { applyHannWindow } from "@/utils/dspProcessing";

// NEW (recommended)
import { applyWindow } from "@/lib/dsp/primitives";
applyWindow(samples, "hann");
```

### Consequences

#### Positive

- **Single Source of Truth**: One implementation of each primitive, tested comprehensively
- **Bug Fixes Propagate**: Fix once, benefits all consumers
- **Performance Optimizations Universal**: SIMD/WASM improvements benefit entire codebase
- **Easier Testing**: Isolated primitives with clear contracts
- **Better Documentation**: Central location for DSP algorithm documentation
- **Future-Proof**: New demodulators reuse primitives without reimplementation
- **Reduced Code Size**: Eliminate duplicate implementations (~200-300 lines saved)
- **API Consistency**: Uniform function signatures across codebase

#### Negative

- **Migration Effort**: Requires updating imports in ~10-15 files
- **API Changes**: Some function signatures may need adjustment
- **Testing Burden**: Must ensure all use cases covered in consolidated tests
- **Initial Complexity**: Developers must learn new import paths

#### Neutral

- **Performance**: Should be identical (same WASM backend)
- **Bundle Size**: Minimal change (tree-shaking removes unused code)
- **Type Safety**: Maintained through TypeScript strict mode

### Validation

**Success Criteria**:

1. All existing tests pass with no functional regressions
2. ATSC demodulator functions identically with shared primitives
3. No performance degradation in benchmark tests
4. Code coverage maintained or improved
5. Documentation updated to reflect new architecture

**Performance Benchmarks**:

- FFT 8192-point: < 8ms (unchanged)
- DC correction 1024 samples: < 1ms (unchanged)
- Window application 1024 samples: < 0.5ms (unchanged)

## Alternatives Considered

### Alternative 1: Option 2 - Keep Duplication

**Rejected** because:

- Doesn't solve maintenance burden
- Bug fixes won't propagate automatically
- Violates DRY principle without compelling performance justification
- Tests must be duplicated and kept in sync manually

### Alternative 2: Option 3 - WASM-Only

**Rejected** because:

- Breaks graceful degradation for browsers without WASM
- Increases load time (WASM initialization required)
- Reduces debuggability (harder to step through WASM)
- Removes ability to verify WASM correctness against JS reference

### Alternative 3: Option 4 - Module-Specific DSP

**Rejected** because:

- Maximizes code duplication
- Each plugin would reimplement FFT, windowing, etc.
- No shared testing or optimization
- Inconsistent behavior across plugins
- Violates established architecture (ADR-0004, ADR-0002)

## Related Decisions

- **ADR-0002: Web Worker DSP Architecture** - Defines where DSP operations run (workers)
- **ADR-0004: Signal Processing Library Selection** - Chose hybrid JS/WASM approach
- **ADR-0015: SIMD DSP Optimization** - SIMD acceleration strategy for primitives
- **ADR-0024: Plugin System Architecture** - Demodulators as plugins using shared DSP

## References

### Internal Documentation

- `docs/reference/dsp-fundamentals.md` - DSP concepts and algorithms
- `docs/reference/dc-offset-correction.md` - DC correction algorithms explained
- `docs/reference/fft-implementation.md` - FFT implementation details

### Academic References

- Lyons, Richard G. "Understanding Digital Signal Processing" (3rd Edition). Prentice Hall, 2010. - Standard DSP reference
- Smith, Julius O. III. "Spectral Audio Signal Processing." W3K Publishing, 2011. - Window functions and FFT
- Oppenheim, Alan V., and Ronald W. Schafer. "Discrete-Time Signal Processing." Pearson, 2009. - IIR/FIR filters

### Implementation References

- [GNU Radio - gr::blocks::dc_blocker_cc](https://www.gnuradio.org/doc/doxygen/classgr_1_1blocks_1_1dc__blocker__cc.html) - Reference IIR DC blocker implementation
- [LiquidDSP - Windowing Functions](https://liquidsdr.org/doc/window/) - Standard window function implementations
- [fft.js](https://github.com/indutny/fft.js) - JavaScript FFT library used in rad.io

## Implementation Notes

### File Locations After Migration

**Removed/Deprecated**:

- Individual window function exports from `dspProcessing.ts` (use `applyWindow` instead)
- Individual DC correction exports (use `removeDCOffset` instead)

**New Shared Layer**:

```
src/lib/dsp/
├── index.ts                    # Public API exports
├── primitives.ts               # Window, DC, AGC functions
├── fft.ts                      # FFT operations
├── filters.ts                  # Digital filters
├── analysis.ts                 # Spectrum analysis
├── conversions.ts              # Format conversions
├── types.ts                    # Shared types
└── __tests__/
    ├── primitives.test.ts
    ├── fft.test.ts
    ├── filters.test.ts
    └── performance.test.ts
```

**Maintained Compatibility Layer**:

- `src/utils/dspProcessing.ts` - Re-exports from `src/lib/dsp/` with deprecation warnings
- `src/utils/dspWasm.ts` - WASM loader, unchanged
- `assembly/dsp.ts` - WASM implementations, unchanged

### Intentional Non-Duplication

Some apparent duplication is actually legitimate specialization:

1. **ATSC Equalizer**: The adaptive equalizer in ATSC8VSBDemodulator is protocol-specific, not a general filter
2. **Timing Recovery**: Gardner detector is modulation-specific, not a general resampler
3. **Carrier Recovery**: PLL in ATSC is specific to VSB pilot tone tracking

These remain in the demodulator as they are not reusable primitives.

## Decision Timeline

- **Proposed**: 2024-11-13 (this ADR)
- **Accepted**: 2024-11-13
- **Implementation Target**: Current PR

## Future Considerations

### Potential Enhancements

1. **WebGPU Compute Shaders**: For massive parallel FFT operations (>16k points)
2. **Rust WASM**: Migrate critical primitives to Rust for better SIMD codegen
3. **Lazy Loading**: Load WASM modules on-demand to reduce initial bundle size
4. **Primitive Benchmarking**: Automated performance regression tests in CI

### Extension Points

New primitives can be added to `src/lib/dsp/` without breaking existing code:

- Wavelet transforms
- Polyphase filterbanks
- Adaptive noise cancellation
- Automatic modulation classification

All should follow the established pattern: TypeScript reference implementation with optional WASM acceleration.
