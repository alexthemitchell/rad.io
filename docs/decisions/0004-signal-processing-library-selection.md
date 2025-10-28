# ADR-0004: Signal Processing Library Selection

## Status

Accepted

## Context

SDR applications require comprehensive digital signal processing capabilities:

**Core DSP Operations**:

- Fast Fourier Transform (FFT) and inverse FFT
- Windowing functions (Hamming, Hann, Blackman-Harris, etc.)
- Digital filters (FIR, IIR, Butterworth, Chebyshev)
- Hilbert transform for SSB demodulation
- Decimation and interpolation for sample rate conversion
- AGC (Automatic Gain Control)
- Frequency translation (mixing/heterodyning)

**Demodulation Algorithms**:

- AM (Amplitude Modulation)
- FM (Frequency Modulation) with de-emphasis
- SSB (Single Sideband) - USB/LSB
- CW (Morse Code) with audio filtering
- Digital modes preparation (PSK, FSK, etc.)

**Analysis Functions**:

- Power spectral density estimation
- Signal-to-noise ratio calculation
- Peak detection and tracking
- Bandwidth measurement

We need JavaScript libraries that:

- Run efficiently in Web Workers
- Handle complex (IQ) sample data natively
- Have minimal dependencies
- Support typed arrays for performance
- Are actively maintained

## Decision

We will use a **hybrid approach** combining multiple specialized libraries:

### Primary Libraries

#### 1. **fft.js** (FFT/IFFT)

- **Repository**: https://github.com/indutny/fft.js
- **License**: MIT
- **Why**: Pure JavaScript, highly optimized, complex number support, no dependencies
- **Usage**: All FFT operations in workers

#### 2. **dsp.js (fork/vendor)** (DSP Primitives)

- **Repository**: https://github.com/corbanbrook/dsp.js
- **License**: MIT
- **Why**: Comprehensive DSP toolkit, windowing, filters
- **Note**: Unmaintained, will vendor and modernize for TypeScript

#### 3. **Custom DSP Module** (SDR-Specific)

- Demodulation algorithms
- IQ sample manipulation
- SDR-specific filtering
- Sample rate conversion

### Architecture

```typescript
// Core DSP Module Structure
export namespace DSP {
  // From fft.js
  export class FFT {
    forward(input: Float32Array): ComplexArray;
    inverse(input: ComplexArray): Float32Array;
  }

  // From dsp.js (modernized)
  export class Window {
    hamming(length: number): Float32Array;
    hann(length: number): Float32Array;
    blackmanHarris(length: number): Float32Array;
  }

  export class Filter {
    lowPass(cutoff: number, sampleRate: number): FIRFilter;
    highPass(cutoff: number, sampleRate: number): FIRFilter;
    bandPass(low: number, high: number, sampleRate: number): FIRFilter;
  }

  // Custom implementations
  export class Demodulator {
    am(samples: IQSamples): Float32Array;
    fm(samples: IQSamples, deviation: number): Float32Array;
    ssb(samples: IQSamples, mode: "USB" | "LSB"): Float32Array;
  }

  export class IQProcessor {
    decimate(samples: IQSamples, factor: number): IQSamples;
    translate(samples: IQSamples, offset: number): IQSamples;
    agc(samples: IQSamples, target: number): IQSamples;
  }
}
```

### Type Definitions

```typescript
interface IQSamples {
  i: Float32Array; // In-phase component
  q: Float32Array; // Quadrature component
  sampleRate: number;
}

interface ComplexArray {
  real: Float32Array;
  imag: Float32Array;
}

interface FIRFilter {
  coefficients: Float32Array;
  process(input: Float32Array): Float32Array;
}
```

## Consequences

### Positive

- **Performance**: Native TypedArray usage, optimized algorithms
- **Type Safety**: Full TypeScript definitions for all DSP operations
- **Control**: Can optimize and extend for SDR-specific needs
- **No Native Dependencies**: Pure JavaScript runs in any browser
- **Testability**: Each DSP function independently unit-testable
- **Bundle Size**: Only include what we use (~50KB gzipped)

### Negative

- **Maintenance**: Vendoring dsp.js means we maintain it
- **No SIMD**: JavaScript lacks explicit SIMD, relies on JIT optimization
- **Slower than Native**: 5-10x slower than C/Rust implementations
- **Memory Allocation**: More GC pressure than native code
- **Limited Optimization**: Can't leverage CPU-specific instructions

### Neutral

- WebAssembly migration path exists if performance insufficient
- Can benchmark and replace individual functions with WASM later
- Most SDR applications are IO-bound (USB/network), not CPU-bound

## Implementation Strategy

### Phase 1: Vendor and Modernize

1. Fork dsp.js into `/src/lib/dsp/`
2. Convert to TypeScript with strict types
3. Replace prototype-based classes with ES6 classes
4. Add comprehensive JSDoc comments
5. Optimize for TypedArray usage

### Phase 2: Custom Implementations

1. Implement demodulators in `/src/lib/dsp/demodulators.ts`
2. Implement IQ processing in `/src/lib/dsp/iq-processor.ts`
3. Add SDR-specific utilities in `/src/lib/dsp/sdr-utils.ts`

### Phase 3: Optimization

1. Profile hot paths with Chrome DevTools
2. Implement object pooling for sample buffers
3. Add SIMD.js as optional dependency if available
4. Consider WebAssembly for critical paths (FFT, filters)

### Testing Requirements

- **Unit Tests**: Every DSP function with known input/output pairs
- **Reference Tests**: Compare against GNU Radio or SciPy implementations
- **Performance Tests**: Benchmark against targets
- **Numerical Stability**: Test with edge cases (zeros, infinities, denormals)

### Performance Targets

| Operation  | Size                  | Target Latency | Notes             |
| ---------- | --------------------- | -------------- | ----------------- |
| FFT        | 2048 pts              | < 2ms          | Typical waterfall |
| FFT        | 8192 pts              | < 8ms          | High resolution   |
| AM Demod   | 1024 samples          | < 1ms          | Real-time audio   |
| FM Demod   | 1024 samples          | < 2ms          | More complex      |
| FIR Filter | 64 taps, 1024 samples | < 1ms          | Audio filtering   |

## Alternatives Considered

### Alternative 1: WebAssembly from Day One

**Rejected**: Premature optimization, JS performance likely sufficient
**Future**: Can compile critical paths to WASM later

### Alternative 2: Use scipy.js or NumPy.js

**Rejected**: These don't exist as maintained libraries, too heavyweight

### Alternative 3: TensorFlow.js for FFT

**Rejected**: Massive dependency (>1MB), designed for ML not DSP

### Alternative 4: Port GNU Radio to Web

**Rejected**: Too complex, large codebase, C++ compilation challenges

### Alternative 5: Rely on Web Audio API

**Rejected**: Limited DSP primitives, designed for audio not RF, no FFT access

### Alternative 6: DSP.js as-is (no modernization)

**Rejected**: Lacks types, uses outdated patterns, harder to maintain

## WebAssembly Migration Path

If profiling reveals performance issues:

1. **Identify Bottleneck**: Profile to find slowest 20% of code
2. **Benchmark Threshold**: Only migrate if >10ms on target hardware
3. **Migration Candidates**:
   - FFT (most likely candidate)
   - FIR filtering with long tap counts
   - Demodulation inner loops
4. **Tools**:
   - Emscripten for C/C++ libraries (FFTW, liquid-dsp)
   - Rust + wasm-pack for custom implementations
   - AssemblyScript for TypeScript-like syntax

## References

#### JavaScript FFT Libraries

- [fft.js - Fast Fourier Transform](https://github.com/indutny/fft.js) - Fastest JavaScript FFT implementation: 47,511 ops/sec at 2048 points, 35,153 ops/sec at 2048 complex FFT
- [dsp.js - Digital Signal Processing](https://github.com/corbanbrook/dsp.js) - Digital signal processing primitives: 23,143 ops/sec at 2048 points
- Mozilla Kraken Benchmark. "Fast Fourier Transform Benchmark." [Kraken FFT](https://mozilla.github.io/krakenbenchmark.mozilla.org/explanations/fft.html) - JavaScript FFT performance comparison
- "FFTs in JavaScript." The Breakfast Post (2015). [Technical Article](https://thebreakfastpost.com/2015/10/18/ffts-in-javascript/) - Comparison of JavaScript FFT implementations

#### Digital Signal Processing References

- [GNU Radio - DSP Reference Implementation](https://www.gnuradio.org/) - Industry-standard open-source SDR framework for algorithm validation
- [LiquidSDR - Software Defined Radio Library](https://liquidsdr.org/) - Comprehensive DSP library for SDR applications in C
- Lyons, Richard G. "Understanding Digital Signal Processing" (3rd Edition). Prentice Hall, 2010. ISBN: 978-0137027415 - Standard DSP textbook

#### Web Technologies

- [WebAssembly SIMD Proposal](https://github.com/WebAssembly/simd) - SIMD operations for performance optimization
- [Emscripten Wasm Audio Worklets](https://emscripten.org/docs/api_reference/wasm_audio_worklets.html) - C/C++ DSP compilation to WebAssembly

#### Conference Papers

- "Digital Signal Processing in JavaScript" - AES Web Audio Conference - Real-time audio DSP in browsers

#### Related ADRs

- ADR-0002: Web Worker DSP Architecture (where these libraries run)
- ADR-0012: Parallel FFT Worker Pool (FFT optimization strategies)
