# DC Offset Correction Implementation

## Overview
Comprehensive DC correction system for rad.io SDR application implementing industry-standard algorithms to remove DC offset/spike from IQ samples.

## Key Files
- `src/utils/dspProcessing.ts`: JavaScript implementations + pipeline integration
- `assembly/dsp.ts`: WASM implementations with SIMD
- `src/utils/dspWasm.ts`: WASM bindings
- `src/utils/__tests__/dcCorrection.test.ts`: Test suite (19 tests)
- `docs/reference/dc-offset-correction.md`: Complete documentation

## Three Correction Modes

### 1. Static (`removeDCOffsetStatic`)
- Simple mean subtraction: DC = Σ(samples) / N
- Best for: Batch processing, constant offsets
- Performance: O(n), fast
- WASM: Yes (SIMD available)

### 2. IIR (`removeDCOffsetIIR`)
- Transfer function: H(z) = (1 - z^-1) / (1 - α*z^-1)
- Best for: Real-time streaming, time-varying DC
- Parameters: α (0.95-0.999), state (4 floats)
- Cutoff: fc ≈ fs * (1-α) / 2π
- WASM: Yes

### 3. Combined (`removeDCOffsetCombined`)
- Two-stage: static + IIR
- Best for: Production use, best overall
- WASM: Yes

## Integration Points

### DSP Pipeline
`processIQSampling()` accepts:
```typescript
{
  dcCorrection: boolean,
  dcCorrectionMode?: 'none' | 'static' | 'iir' | 'combined',
  dcBlockerState?: DCBlockerState, // For IIR/combined
}
```

### Usage Pattern
```typescript
// Initialize once
const state = { prevInputI: 0, prevInputQ: 0, prevOutputI: 0, prevOutputQ: 0 };

// Process each block
const result = processIQSampling(samples, {
  sampleRate: 2048000,
  dcCorrection: true,
  dcCorrectionMode: 'combined',
  dcBlockerState: state,
  iqBalance: true,
});
```

## Performance
- JavaScript: ~5-10ms for 16K samples
- WASM scalar: 2x faster
- WASM SIMD: 4x faster
- Negligible CPU impact in production

## Testing
- 19 comprehensive tests covering all modes
- Validation with synthetic DC offsets
- State continuity tests
- Performance benchmarks
- All existing tests pass (496 total)

## Best Practices
1. Use 'combined' mode for production
2. α = 0.99 is good default
3. Preserve state between blocks
4. Reset state on frequency/device change
5. WASM enabled by default

## Future Enhancements
- Adaptive α based on DC drift rate
- Hardware-specific calibration profiles
- UI controls and visualization
- Real-time DC monitoring
- Calibration wizard

## References
- GNU Radio dc_blocker_cc
- Julius O. Smith III DSP guide
- SDR# DC removal implementation
