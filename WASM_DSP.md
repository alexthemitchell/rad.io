# WebAssembly DSP Acceleration

This document describes the WebAssembly (WASM) implementation for high-performance digital signal processing in rad.io.

## Overview

The WASM DSP module provides near-native performance for computationally intensive operations:

- **FFT Calculation**: Cooley-Tukey radix-2 algorithm (O(N log N) vs O(N²) JavaScript DFT)
- **Waveform Analysis**: SIMD-optimized amplitude and phase calculation
- **Spectrogram Generation**: Batch processing of multiple FFT windows

### Performance Characteristics

Expected performance improvements with WASM:
- **FFT (2048 samples)**: 5-10x faster
- **Waveform (10k samples)**: 3-5x faster
- **Spectrogram**: Proportional to FFT improvement

## Architecture

### Component Overview

```
src/
├── assembly/                # AssemblyScript WASM sources
│   ├── dsp.ts              # Core DSP implementations
│   └── index.ts            # Module exports
├── utils/
│   ├── dsp.ts              # Enhanced with WASM adapter
│   ├── dspWasm.ts          # WASM loader and feature detection
│   └── dspBenchmark.ts     # Performance benchmarking
└── build/
    ├── release.wasm        # Optimized WASM binary (12KB)
    └── release.js          # WASM loader/glue code
```

### Data Flow

```
Application
    ↓
dsp.ts (isWasmAvailable?)
    ↓
YES → dspWasm.ts → WASM Module → High-performance computation
    ↓
NO  → dsp.ts → JavaScript fallback → Compatible computation
```

## Implementation Details

### Feature Detection

The system automatically detects WASM support and falls back to JavaScript:

```typescript
import { isWasmAvailable } from './utils/dspWasm';

// WASM is used automatically when available
const result = calculateFFTSync(samples, fftSize);
```

No code changes needed - WASM acceleration is transparent to the caller.

### WASM Module Loading

The module is preloaded on app initialization for best performance:

```typescript
// In App.tsx
useEffect(() => {
  preloadWasmModule(); // Loads in background
}, []);
```

Loading is asynchronous and non-blocking. If loading fails, the system automatically falls back to JavaScript.

### FFT Algorithm

**JavaScript (DFT)**: O(N²) complexity
```typescript
for (let k = 0; k < N; k++) {
  for (let n = 0; n < N; n++) {
    // Complex multiplication
  }
}
```

**WASM (Cooley-Tukey FFT)**: O(N log N) complexity
```typescript
// Bit-reversal permutation
// Butterfly operations with twiddle factors
// Log N stages, each with N/2 operations
```

### Memory Management

WASM uses WebAssembly linear memory:
- **Shared memory**: Data is copied between JavaScript and WASM
- **I/Q separation**: Samples are separated into two Float32Arrays for SIMD efficiency
- **Pre-allocated buffers**: Output arrays are allocated in JavaScript
- **No garbage collection issues**: WASM memory is managed by the WebAssembly runtime

## Building and Development

### Prerequisites

```bash
npm install --save-dev assemblyscript @assemblyscript/loader
```

### Build Commands

```bash
# Build WASM module
npm run asbuild:release     # Optimized production build
npm run asbuild:debug       # Debug build with symbols

# Build entire application (includes WASM)
npm run build               # Automatically builds WASM first
npm run build:prod          # Production build
```

### Development Workflow

1. **Edit WASM source**: Modify `assembly/dsp.ts`
2. **Build WASM**: `npm run asbuild:release`
3. **Test**: `npm test`
4. **Verify integration**: Build and run the app

### Webpack Configuration

WASM files are automatically copied to the dist folder:

```javascript
// webpack.config.js
new CopyPlugin({
  patterns: [
    { from: "build/release.wasm", to: "dsp.wasm" },
    { from: "build/release.js", to: "dsp.js" },
  ],
}),
```

## Testing

### Unit Tests

WASM functionality is comprehensively tested:

```bash
npm test -- src/utils/__tests__/dspWasm.test.ts
```

Test coverage includes:
- Feature detection
- Module loading and caching
- Mathematical equivalence with JavaScript
- Fallback behavior
- Edge cases (empty arrays, extreme values, large datasets)

### Benchmarking

Performance benchmarking utilities are provided:

```typescript
import { runBenchmarkSuite, formatBenchmarkResults } from './utils/dspBenchmark';

// Run benchmarks
const results = await runBenchmarkSuite();
const markdown = formatBenchmarkResults(results);
console.log(markdown);
```

Results show operation timings, WASM vs JS comparison, and speedup factors.

## Browser Compatibility

### Supported Browsers

- ✅ Chrome 61+ (WebAssembly 1.0)
- ✅ Edge 79+ (Chromium-based)
- ✅ Firefox 52+
- ✅ Safari 11+
- ✅ Opera 48+

### Fallback Behavior

When WASM is not supported:
1. Feature detection returns `false`
2. JavaScript implementation is used automatically
3. User experience is unchanged (slightly slower performance)
4. No errors or warnings to the user

## Performance Tuning

### Optimization Levels

AssemblyScript compilation uses these optimization flags:

```json
{
  "optimizeLevel": 3,    // Maximum optimization
  "shrinkLevel": 0,      // No size optimization (prefer speed)
  "converge": false,     // Faster compilation
  "noAssert": false      // Keep assertions for safety
}
```

### Future Enhancements

Potential performance improvements:

1. **SIMD Instructions**: Use WebAssembly SIMD for vectorized operations
2. **Multi-threading**: SharedArrayBuffer + Web Workers for parallel FFT
3. **Streaming**: Process samples in chunks to reduce memory usage
4. **Decimation**: Hardware-accelerated sample rate conversion

## Troubleshooting

### WASM Module Fails to Load

**Symptoms**: Console warning "Failed to load WASM module, falling back to JavaScript"

**Possible Causes**:
- WASM file not found (check dist/dsp.wasm exists)
- CORS issues (ensure same-origin or proper CORS headers)
- Browser doesn't support WebAssembly

**Solution**: Verify build output and browser console. Fallback to JavaScript is automatic.

### Performance Not Improving

**Check**:
1. WASM is actually being used: `isWasmAvailable()` returns `true`
2. Sample sizes are large enough to see benefit (>1024 samples)
3. Browser DevTools shows dsp.wasm is loaded

**Note**: For small sample sizes (<256), JavaScript may be faster due to WASM call overhead.

### Build Errors

**Error**: "Cannot find module 'assemblyscript'"

**Solution**: 
```bash
npm install --save-dev assemblyscript @assemblyscript/loader
```

**Error**: Type errors in assembly/dsp.ts

**Solution**: AssemblyScript uses TypeScript-like syntax but with different types. Check AssemblyScript documentation for type compatibility.

## API Reference

### Public Functions (dspWasm.ts)

#### `isWasmSupported(): boolean`
Returns true if WebAssembly is supported in the current environment.

#### `loadWasmModule(): Promise<WasmDSPModule | null>`
Loads and initializes the WASM module. Returns null if loading fails.

#### `isWasmAvailable(): boolean`
Returns true if WASM module is currently loaded and ready to use.

#### `preloadWasmModule(): void`
Starts loading WASM module in the background. Called automatically on app initialization.

### WASM Module Functions (assembly/dsp.ts)

#### `calculateFFT(iSamples, qSamples, fftSize, output): void`
Calculates FFT using Cooley-Tukey algorithm.
- **Input**: Separate I and Q sample arrays, FFT size (must be power of 2)
- **Output**: Magnitude spectrum in dB, frequency-shifted

#### `calculateWaveform(iSamples, qSamples, amplitude, phase, count): void`
Calculates amplitude and phase from IQ samples.
- **Input**: I and Q sample arrays, sample count
- **Output**: Amplitude and phase arrays

#### `calculateSpectrogram(iSamples, qSamples, fftSize, output, rowCount): void`
Calculates multiple FFT rows for spectrogram.
- **Input**: I and Q sample arrays, FFT size, row count
- **Output**: Flattened array of FFT results

## Contributing

When modifying WASM code:

1. **Maintain compatibility**: Ensure JavaScript fallback produces identical results
2. **Add tests**: Update dspWasm.test.ts with new test cases
3. **Benchmark**: Verify performance improvements
4. **Document**: Update this file with any API changes

## References

- [AssemblyScript Documentation](https://www.assemblyscript.org/)
- [WebAssembly Specification](https://webassembly.github.io/spec/)
- [Cooley-Tukey FFT Algorithm](https://en.wikipedia.org/wiki/Cooley%E2%80%93Tukey_FFT_algorithm)
- [WebAssembly Browser Support](https://caniuse.com/wasm)

## License

Same as the main rad.io project.
