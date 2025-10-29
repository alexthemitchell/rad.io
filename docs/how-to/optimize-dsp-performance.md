# How-To: Optimize DSP Performance

This guide shows you how to profile and optimize signal processing performance in rad.io. You'll learn to identify bottlenecks and apply proven optimization techniques.

**Time to complete**: 1-2 hours  
**Prerequisites**: Basic DSP knowledge, familiarity with browser DevTools  
**Difficulty**: Intermediate

## Overview

DSP operations can be computationally expensive. This guide covers:
1. Profiling to find bottlenecks
2. Web Worker optimization
3. WebAssembly acceleration
4. Memory optimization
5. Algorithm selection

## Step 1: Profile Current Performance

### Use Chrome DevTools Performance Profiler

1. Open DevTools (F12) → Performance tab
2. Click Record (●)
3. Run your DSP operation for a few seconds
4. Stop recording

**Look for:**
- Long tasks (yellow blocks)
- JavaScript execution time
- Layout thrashing
- Memory allocations

### Use Performance API

Add timing code to measure specific operations:

```typescript
// Measure FFT performance
performance.mark('fft-start');

const spectrum = calculateFFT(samples, 2048);

performance.mark('fft-end');
performance.measure('fft-duration', 'fft-start', 'fft-end');

const measure = performance.getEntriesByName('fft-duration')[0];
console.log(`FFT took ${measure.duration.toFixed(2)} ms`);
```

### Identify Bottlenecks

Common bottlenecks:
- **FFT computation**: Most CPU-intensive
- **Data copying**: ArrayBuffer conversions
- **Format conversion**: I/Q sample parsing
- **Worker messaging**: postMessage overhead

## Step 2: Optimize Web Workers

### Use Transferable Objects

Don't copy data - transfer ownership:

```typescript
// ❌ Bad - copies data
worker.postMessage({ samples: samplesArray });

// ✅ Good - transfers ownership (zero-copy)
worker.postMessage(
  { samples: samplesArray },
  [samplesArray.buffer] // Transfer list
);
```

**Benefits:**
- Zero-copy operation
- 10-100x faster for large arrays
- Reduces memory pressure

### Batch Processing

Process multiple chunks together:

```typescript
// ❌ Bad - process each chunk separately
for (const chunk of chunks) {
  await processChunk(chunk); // Lots of messaging overhead
}

// ✅ Good - batch process
await processBatch(chunks); // Single message
```

### Use SharedArrayBuffer

For real-time streaming, share memory between threads:

```typescript
// Main thread
const sharedBuffer = new SharedArrayBuffer(1024 * 1024); // 1 MB
const samples = new Float32Array(sharedBuffer);

worker.postMessage({ buffer: sharedBuffer });

// Worker thread
let offset = 0;
onmessage = (e) => {
  const samples = new Float32Array(e.data.buffer);
  // Read from shared buffer at offset
  processFFT(samples.subarray(offset, offset + 2048));
};
```

**Note:** Requires COOP/COEP headers for security.

## Step 3: Use WebAssembly

### Why WASM?

- 2-10x faster than JavaScript for DSP
- Near-native performance
- Predictable execution time

### Convert Critical Paths to WASM

**Example: FFT in AssemblyScript**

Create `assembly/fft.ts`:

```typescript
// AssemblyScript (compiles to WASM)
export function fft(
  real: Float32Array,
  imag: Float32Array,
  size: i32
): void {
  // Cooley-Tukey FFT algorithm
  const n = size;
  const logN = i32(Math.log2(n));
  
  // Bit-reversal permutation
  for (let i = 0; i < n; i++) {
    const j = reverseBits(i, logN);
    if (j > i) {
      // Swap real[i] with real[j]
      const tempR = real[i];
      real[i] = real[j];
      real[j] = tempR;
      
      // Swap imag[i] with imag[j]
      const tempI = imag[i];
      imag[i] = imag[j];
      imag[j] = tempI;
    }
  }
  
  // FFT computation
  for (let len = 2; len <= n; len *= 2) {
    const halfLen = len / 2;
    const angle = -2.0 * Math.PI / f64(len);
    
    for (let i = 0; i < n; i += len) {
      for (let j = 0; j < halfLen; j++) {
        const idx1 = i + j;
        const idx2 = i + j + halfLen;
        
        const wr = Math.cos(angle * f64(j));
        const wi = Math.sin(angle * f64(j));
        
        const tr = wr * real[idx2] - wi * imag[idx2];
        const ti = wr * imag[idx2] + wi * real[idx2];
        
        real[idx2] = real[idx1] - tr;
        imag[idx2] = imag[idx1] - ti;
        real[idx1] += tr;
        imag[idx1] += ti;
      }
    }
  }
}

function reverseBits(x: i32, bits: i32): i32 {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}
```

### Use from JavaScript

```typescript
// Load WASM module
const wasmModule = await WebAssembly.instantiateStreaming(
  fetch('/dsp.wasm')
);

const { fft } = wasmModule.instance.exports;

// Use WASM FFT
const real = new Float32Array(2048);
const imag = new Float32Array(2048);

// Convert I/Q to real/imag
for (let i = 0; i < samples.length; i++) {
  real[i] = samples[i].i;
  imag[i] = samples[i].q;
}

// Call WASM FFT (very fast!)
fft(real, imag, 2048);
```

### Runtime Flags

rad.io supports runtime toggles:

```typescript
// Enable/disable WASM at runtime
localStorage.setItem('radio.wasm.enabled', 'true');

// Enable validation (dev mode)
localStorage.setItem('radio.wasm.validate', 'true');
```

See [WASM Runtime Flags](../reference/wasm-runtime-flags.md) for details.

## Step 4: Memory Optimization

### Object Pooling

Reuse objects instead of creating new ones:

```typescript
class SamplePool {
  private pool: IQSample[][] = [];
  
  acquire(size: number): IQSample[] {
    if (this.pool.length > 0) {
      const samples = this.pool.pop()!;
      samples.length = size; // Resize
      return samples;
    }
    return new Array(size);
  }
  
  release(samples: IQSample[]): void {
    this.pool.push(samples);
  }
}

// Usage
const pool = new SamplePool();

function processSamples() {
  const samples = pool.acquire(2048);
  
  // ... use samples ...
  
  pool.release(samples); // Return to pool
}
```

### TypedArray Instead of Arrays

Use TypedArrays for numeric data:

```typescript
// ❌ Slow - generic array
const samples: number[] = new Array(2048);

// ✅ Fast - typed array
const samples = new Float32Array(2048);
```

**Benefits:**
- Contiguous memory
- No boxing/unboxing
- WASM interop
- 2-5x faster access

### Avoid Allocations in Hot Paths

```typescript
// ❌ Bad - allocates every frame
function processFrame(samples: Float32Array) {
  const output = new Float32Array(samples.length); // Allocation!
  // ... process ...
  return output;
}

// ✅ Good - reuse buffer
class Processor {
  private outputBuffer = new Float32Array(2048);
  
  processFrame(samples: Float32Array) {
    // Reuse existing buffer
    // ... process into outputBuffer ...
    return this.outputBuffer;
  }
}
```

## Step 5: Algorithm Selection

### Choose the Right FFT Size

Larger FFTs → Better frequency resolution, worse time resolution:

```typescript
// Quick monitoring - small FFT
const quickSpectrum = calculateFFT(samples, 512); // Fast, rough

// Precise analysis - large FFT
const preciseSpectrum = calculateFFT(samples, 4096); // Slow, detailed
```

**Typical sizes:**
- **512**: Real-time monitoring (60 FPS)
- **2048**: Good balance
- **4096+**: High precision analysis

### Decimation Before Processing

Reduce sample rate if you don't need full bandwidth:

```typescript
// Original: 20 MS/s → FFT 4096 = expensive
// Decimated: 2 MS/s → FFT 4096 = 10x faster

function decimate(samples: IQSample[], factor: number): IQSample[] {
  const output: IQSample[] = [];
  for (let i = 0; i < samples.length; i += factor) {
    output.push(samples[i]);
  }
  return output;
}

// Decimate by 10x before FFT
const decimated = decimate(samples, 10);
const spectrum = calculateFFT(decimated, 4096);
```

### Windowing Functions

Use appropriate window for your use case:

```typescript
// Rectangular window - maximum frequency resolution, high sidelobes
const rectangular = samples.slice();

// Hamming window - good balance
const hamming = samples.map((s, i) => {
  const window = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / samples.length);
  return { i: s.i * window, q: s.q * window };
});

// Blackman-Harris - low sidelobes, poor resolution
const blackman = samples.map((s, i) => {
  const n = i / samples.length;
  const window = 
    0.35875 - 
    0.48829 * Math.cos(2 * Math.PI * n) +
    0.14128 * Math.cos(4 * Math.PI * n) -
    0.01168 * Math.cos(6 * Math.PI * n);
  return { i: s.i * window, q: s.q * window };
});
```

## Step 6: Measure Improvements

### Before and After

Document baseline performance:

```typescript
// Before optimization
console.time('fft-js');
const spectrum1 = calculateFFT_JS(samples, 2048);
console.timeEnd('fft-js'); // 15.2 ms

// After optimization
console.time('fft-wasm');
const spectrum2 = calculateFFT_WASM(samples, 2048);
console.timeEnd('fft-wasm'); // 2.1 ms

console.log(`Speedup: ${(15.2 / 2.1).toFixed(1)}x`);
```

### Regression Testing

Add performance tests:

```typescript
describe('FFT Performance', () => {
  it('should compute 2048-point FFT in < 5ms', () => {
    const samples = generateTestSamples(2048);
    
    const start = performance.now();
    calculateFFT(samples, 2048);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(5);
  });
});
```

## Common Optimization Patterns

### Pattern 1: Lazy Computation

Don't compute what you don't display:

```typescript
// Only compute visible frequency range
function computeVisibleSpectrum(
  samples: IQSample[],
  minFreq: number,
  maxFreq: number
): Float32Array {
  // Only compute bins in visible range
  const startBin = Math.floor(minFreq * samples.length);
  const endBin = Math.ceil(maxFreq * samples.length);
  
  return computePartialFFT(samples, startBin, endBin);
}
```

### Pattern 2: Progressive Rendering

Show rough result fast, refine later:

```typescript
// Quick pass - small FFT
const quickSpectrum = calculateFFT(samples, 512);
renderSpectrum(quickSpectrum);

// Detailed pass - large FFT (when CPU available)
requestIdleCallback(() => {
  const detailedSpectrum = calculateFFT(samples, 4096);
  renderSpectrum(detailedSpectrum);
});
```

### Pattern 3: Caching

Cache expensive computations:

```typescript
// Simple hash function for sample data
function hashSamples(samples: IQSample[]): string {
  // Hash based on first, middle, and last samples for speed
  // 
  // WARNING: This simple sampling approach may have collisions if many buffers
  // have similar start/middle/end values. For production use, consider:
  // - MurmurHash3 for fast, good distribution
  // - XXHash for extreme performance
  // - CityHash for quality hashing of larger datasets
  const len = samples.length;
  if (len === 0) return '0';
  
  const first = samples[0];
  const mid = samples[Math.floor(len / 2)];
  const last = samples[len - 1];
  
  return `${len}-${first.i.toFixed(3)},${first.q.toFixed(3)}-${mid.i.toFixed(3)},${mid.q.toFixed(3)}-${last.i.toFixed(3)},${last.q.toFixed(3)}`;
}

class CachedFFT {
  private cache = new Map<string, Float32Array>();
  
  compute(samples: IQSample[], size: number): Float32Array {
    const key = hashSamples(samples);
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    const result = calculateFFT(samples, size);
    this.cache.set(key, result);
    
    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    return result;
  }
}
```

## Performance Targets

### Acceptable Performance

| Operation | Target | Good | Excellent |
|-----------|--------|------|-----------|
| 2048 FFT | < 10ms | < 5ms | < 2ms |
| Sample parsing | < 5ms/1000 | < 2ms | < 1ms |
| Worker message | < 1ms | < 0.5ms | < 0.1ms |
| Frame render | < 16ms (60 FPS) | < 8ms | < 4ms |

### Monitoring in Production

```typescript
// Add performance monitoring
class PerformanceMonitor {
  private metrics: { [key: string]: number[] } = {};
  
  measure(name: string, fn: () => void) {
    const start = performance.now();
    fn();
    const duration = performance.now() - start;
    
    if (!this.metrics[name]) {
      this.metrics[name] = [];
    }
    this.metrics[name].push(duration);
  }
  
  report() {
    for (const [name, values] of Object.entries(this.metrics)) {
      const avg = values.reduce((a, b) => a + b) / values.length;
      const max = Math.max(...values);
      console.log(`${name}: avg=${avg.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
    }
  }
}
```

## Troubleshooting

### FFT is Slow

- ✅ Use WASM implementation
- ✅ Reduce FFT size
- ✅ Use Web Workers
- ✅ Check window function overhead

### Worker Communication is Slow

- ✅ Use Transferable Objects
- ✅ Batch multiple operations
- ✅ Consider SharedArrayBuffer

### Memory Usage is High

- ✅ Implement object pooling
- ✅ Use TypedArrays
- ✅ Limit buffer history
- ✅ Clear unused buffers

## Learn More

- [DSP Fundamentals](../reference/dsp-fundamentals.md)
- [FFT Implementation](../reference/fft-implementation.md)
- [Performance Optimization](../reference/performance-optimization.md)
- [WASM Runtime Flags](../reference/wasm-runtime-flags.md)

## Need Help?

- [GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)
- [Performance Issues](https://github.com/alexthemitchell/rad.io/labels/performance)
