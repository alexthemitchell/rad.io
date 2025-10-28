# Performance Optimization Implementation Plan

## Overview

This document provides a practical, step-by-step implementation guide for performance optimizations identified in the performance benchmarks and research.

**Priority**: High
**Status**: Planning Phase
**Target Completion**: Q1 2025

## Phase 1: WASM SIMD Optimization (Weeks 1-3)

### Objective

Add SIMD instructions to existing WASM FFT implementation for 2-4x speedup.

### Prerequisites

- AssemblyScript 0.28+ (current: ✅)
- Browser support check (Chrome 91+, Firefox 89+, Safari 16.4+)
- Separate build configuration for SIMD variant

### Implementation Steps

#### Step 1: Update Build Configuration

**File**: `asconfig.json`

Add SIMD target:

```json
{
  "targets": {
    "release": { /* existing config */ },
    "release-simd": {
      "outFile": "build/release-simd.wasm",
      "sourceMap": false,
      "optimizeLevel": 3,
      "shrinkLevel": 2,
      "converge": true,
      "noAssert": true,
      "feature": ["simd"]
    }
  }
}
```

Update `package.json`:

```json
{
  "scripts": {
    "asbuild:release-simd": "asc assembly/index.ts --target release-simd"
  }
}
```

#### Step 2: Implement SIMD FFT

**File**: `assembly/dsp-simd.ts`

```typescript
/**
 * SIMD-accelerated FFT using v128 vector operations
 */

// Complex butterfly with SIMD (4 parallel operations)
function butterflySimd(
  data: Float32Array,
  offset: i32,
  stride: i32,
  twiddleReal: f32,
  twiddleImag: f32
): void {
  // Load 4 complex numbers (8 floats) using SIMD
  const vec1 = v128.load(changetype<usize>(data) + (offset * 4));
  const vec2 = v128.load(changetype<usize>(data) + ((offset + stride) * 4));
  
  // Extract I/Q components
  const i1 = f32x4.extract_lane(vec1, 0);
  const q1 = f32x4.extract_lane(vec1, 1);
  const i2 = f32x4.extract_lane(vec2, 0);
  const q2 = f32x4.extract_lane(vec2, 1);
  
  // Complex multiplication: (i2 + jq2) * (twiddleReal + j*twiddleImag)
  const multReal = i2 * twiddleReal - q2 * twiddleImag;
  const multImag = i2 * twiddleImag + q2 * twiddleReal;
  
  // Butterfly addition/subtraction
  const outI1 = i1 + multReal;
  const outQ1 = q1 + multImag;
  const outI2 = i1 - multReal;
  const outQ2 = q1 - multImag;
  
  // Store results
  const result1 = f32x4.splat(0);
  result1 = f32x4.replace_lane(result1, 0, outI1);
  result1 = f32x4.replace_lane(result1, 1, outQ1);
  v128.store(changetype<usize>(data) + (offset * 4), result1);
  
  const result2 = f32x4.splat(0);
  result2 = f32x4.replace_lane(result2, 0, outI2);
  result2 = f32x4.replace_lane(result2, 1, outQ2);
  v128.store(changetype<usize>(data) + ((offset + stride) * 4), result2);
}

// Window function with SIMD (4 samples at once)
export function applyHannWindowSimd(
  iSamples: Float32Array,
  qSamples: Float32Array,
  size: i32
): void {
  const sizeMinusOne = f32(size - 1);
  
  for (let i = 0; i < size; i += 4) {
    // Compute window coefficients for 4 samples
    const indices = f32x4(f32(i), f32(i + 1), f32(i + 2), f32(i + 3));
    const normalized = f32x4.div(indices, f32x4.splat(sizeMinusOne));
    const angles = f32x4.mul(normalized, f32x4.splat(6.28318530718)); // 2π
    
    // Hann window: 0.5 * (1 - cos(2π*n/(N-1)))
    // Note: AssemblyScript SIMD doesn't have native cos, 
    // so we use scalar operations in loop
    const window0 = 0.5 * (1 - Mathf.cos(2 * 3.14159265359 * f32(i) / sizeMinusOne));
    const window1 = 0.5 * (1 - Mathf.cos(2 * 3.14159265359 * f32(i + 1) / sizeMinusOne));
    const window2 = 0.5 * (1 - Mathf.cos(2 * 3.14159265359 * f32(i + 2) / sizeMinusOne));
    const window3 = 0.5 * (1 - Mathf.cos(2 * 3.14159265359 * f32(i + 3) / sizeMinusOne));
    
    const windowVec = f32x4(window0, window1, window2, window3);
    
    // Load and apply window to I samples
    const iVec = v128.load(changetype<usize>(iSamples) + (i * 4));
    const iWindowed = f32x4.mul(iVec, windowVec);
    v128.store(changetype<usize>(iSamples) + (i * 4), iWindowed);
    
    // Load and apply window to Q samples
    const qVec = v128.load(changetype<usize>(qSamples) + (i * 4));
    const qWindowed = f32x4.mul(qVec, windowVec);
    v128.store(changetype<usize>(qSamples) + (i * 4), qWindowed);
  }
}
```

#### Step 3: Add SIMD Feature Detection

**File**: `src/utils/dspWasm.ts`

Add SIMD detection:

```typescript
/**
 * Check if WebAssembly SIMD is supported
 */
export function isWasmSIMDSupported(): boolean {
  try {
    // Minimal WASM module with SIMD instruction (v128.const)
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0,     // WASM header
      1, 5, 1, 96, 0, 1, 127,          // Type section
      3, 2, 1, 0,                       // Function section
      10, 10, 1, 8, 0,                  // Code section start
      65, 0,                            // i32.const 0
      253, 15,                          // v128.const (SIMD instruction)
      253, 98,                          // i8x16.popcnt
      11                                // end
    ]));
  } catch (e) {
    return false;
  }
}

/**
 * Load appropriate WASM module (SIMD or regular)
 */
export async function loadOptimalWasmModule(): Promise<WasmDSPModule | null> {
  try {
    if (isWasmSIMDSupported()) {
      console.info('Loading SIMD-optimized WASM module');
      const module = await import('../../build/release-simd.js');
      return module;
    } else {
      console.info('Loading standard WASM module (SIMD not supported)');
      const module = await import('../../build/release.js');
      return module;
    }
  } catch (err) {
    console.error('Failed to load WASM module:', err);
    return null;
  }
}
```

#### Step 4: Update Webpack Configuration

**File**: `webpack.config.ts`

Copy SIMD module:

```typescript
new CopyPlugin({
  patterns: [
    { from: 'build/release.wasm', to: 'dsp.wasm' },
    { from: 'build/release.js', to: 'dsp.js' },
    { from: 'build/release-simd.wasm', to: 'dsp-simd.wasm' },
    { from: 'build/release-simd.js', to: 'dsp-simd.js' },
  ],
}),
```

#### Step 5: Testing

Create test suite:

```typescript
// src/utils/__tests__/dspSIMD.test.ts
describe('WASM SIMD', () => {
  it('detects SIMD support', () => {
    const supported = isWasmSIMDSupported();
    expect(typeof supported).toBe('boolean');
  });
  
  it('loads correct module variant', async () => {
    const module = await loadOptimalWasmModule();
    expect(module).toBeTruthy();
  });
  
  it('produces same results as scalar WASM', async () => {
    const samples = generateTestSamples(1024);
    const resultScalar = await calculateFFT(samples, false); // Force scalar
    const resultSIMD = await calculateFFT(samples, true);    // Force SIMD
    
    expect(resultSIMD).toBeCloseToArray(resultScalar, 0.001);
  });
  
  it('achieves expected speedup', async () => {
    const samples = generateTestSamples(2048);
    
    const startScalar = performance.now();
    await calculateFFT(samples, false);
    const timeScalar = performance.now() - startScalar;
    
    const startSIMD = performance.now();
    await calculateFFT(samples, true);
    const timeSIMD = performance.now() - startSIMD;
    
    const speedup = timeScalar / timeSIMD;
    expect(speedup).toBeGreaterThan(1.5); // At least 1.5x speedup
  });
});
```

### Expected Outcomes

- 2-4x speedup for FFT operations on SIMD-capable browsers
- Graceful fallback to scalar WASM on older browsers
- No regression in accuracy
- Minimal code duplication

### Success Metrics

- FFT 2048: <3ms (down from 6-8ms)
- FFT 4096: <12ms (down from 25-30ms)
- Browser coverage: 95%+ (SIMD or fallback)
- Test coverage: >95%

## Phase 2: SharedArrayBuffer Integration (Weeks 4-6)

### Objective

Eliminate message passing overhead by using shared memory between workers.

### Prerequisites

- HTTPS deployment
- Server headers: `COOP: same-origin`, `COEP: require-corp`
- Browser support (Chrome 92+, Firefox 79+, Safari 15.2+)

### Implementation Steps

#### Step 1: Server Configuration

**File**: `webpack.config.ts` (dev server)

Add security headers:

```typescript
devServer: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
}
```

For production (nginx example):

```nginx
add_header Cross-Origin-Opener-Policy "same-origin";
add_header Cross-Origin-Embedder-Policy "require-corp";
```

#### Step 2: Shared Ring Buffer

**File**: `src/lib/utils/SharedRingBuffer.ts`

```typescript
/**
 * Lock-free ring buffer using SharedArrayBuffer
 * Allows zero-copy streaming between main thread and workers
 */
export class SharedRingBuffer {
  private buffer: SharedArrayBuffer;
  private data: Float32Array;
  private header: Int32Array;
  private size: number;
  
  // Header layout: [writePos, readPos, status]
  private static readonly WRITE_POS = 0;
  private static readonly READ_POS = 1;
  private static readonly STATUS = 2;
  
  constructor(size: number) {
    // Allocate: 3 int32 header + size float32 data
    this.buffer = new SharedArrayBuffer(12 + size * 4);
    this.header = new Int32Array(this.buffer, 0, 3);
    this.data = new Float32Array(this.buffer, 12);
    this.size = size;
    
    // Initialize
    Atomics.store(this.header, SharedRingBuffer.WRITE_POS, 0);
    Atomics.store(this.header, SharedRingBuffer.READ_POS, 0);
    Atomics.store(this.header, SharedRingBuffer.STATUS, 0);
  }
  
  /**
   * Write samples to ring buffer (producer)
   * Returns number of samples written
   */
  write(samples: Float32Array): number {
    const writePos = Atomics.load(this.header, SharedRingBuffer.WRITE_POS);
    const readPos = Atomics.load(this.header, SharedRingBuffer.READ_POS);
    
    // Calculate available space
    const available = readPos <= writePos
      ? this.size - (writePos - readPos) - 1
      : readPos - writePos - 1;
    
    const toWrite = Math.min(samples.length, available);
    if (toWrite === 0) return 0;
    
    // Write data
    for (let i = 0; i < toWrite; i++) {
      this.data[(writePos + i) % this.size] = samples[i];
    }
    
    // Update write position
    const newWritePos = (writePos + toWrite) % this.size;
    Atomics.store(this.header, SharedRingBuffer.WRITE_POS, newWritePos);
    
    // Notify readers
    Atomics.notify(this.header, SharedRingBuffer.STATUS, Infinity);
    
    return toWrite;
  }
  
  /**
   * Read samples from ring buffer (consumer)
   * Blocks until requested samples available
   */
  read(count: number, timeoutMs: number = 1000): Float32Array {
    const result = new Float32Array(count);
    let read = 0;
    
    const deadline = Date.now() + timeoutMs;
    
    while (read < count) {
      const writePos = Atomics.load(this.header, SharedRingBuffer.WRITE_POS);
      const readPos = Atomics.load(this.header, SharedRingBuffer.READ_POS);
      
      // Calculate available data
      const available = writePos >= readPos
        ? writePos - readPos
        : this.size - (readPos - writePos);
      
      if (available === 0) {
        // Wait for data
        if (Date.now() >= deadline) {
          throw new Error('Read timeout');
        }
        
        Atomics.wait(this.header, SharedRingBuffer.STATUS, 0, 100);
        continue;
      }
      
      const toRead = Math.min(count - read, available);
      
      // Read data
      for (let i = 0; i < toRead; i++) {
        result[read + i] = this.data[(readPos + i) % this.size];
      }
      
      // Update read position
      const newReadPos = (readPos + toRead) % this.size;
      Atomics.store(this.header, SharedRingBuffer.READ_POS, newReadPos);
      
      read += toRead;
    }
    
    return result;
  }
  
  /**
   * Try to read without blocking
   */
  tryRead(count: number): Float32Array | null {
    const writePos = Atomics.load(this.header, SharedRingBuffer.WRITE_POS);
    const readPos = Atomics.load(this.header, SharedRingBuffer.READ_POS);
    
    const available = writePos >= readPos
      ? writePos - readPos
      : this.size - (readPos - writePos);
    
    if (available < count) return null;
    
    const result = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      result[i] = this.data[(readPos + i) % this.size];
    }
    
    const newReadPos = (readPos + count) % this.size;
    Atomics.store(this.header, SharedRingBuffer.READ_POS, newReadPos);
    
    return result;
  }
  
  getBuffer(): SharedArrayBuffer {
    return this.buffer;
  }
}
```

#### Step 3: Update DSP Worker

**File**: `src/utils/dspWorker.ts`

Add shared buffer support:

```typescript
let sharedBuffer: SharedRingBuffer | null = null;

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;
  
  switch (type) {
    case 'init-shared-buffer':
      // Receive shared buffer from main thread
      sharedBuffer = new SharedRingBuffer(data.size);
      self.postMessage({ 
        type: 'shared-buffer-ready',
        buffer: sharedBuffer.getBuffer()
      });
      break;
      
    case 'start-streaming':
      if (!sharedBuffer) {
        throw new Error('Shared buffer not initialized');
      }
      startStreamingWithSharedBuffer(sharedBuffer, data.fftSize);
      break;
      
    case 'process':
      // Fallback: traditional message passing
      processWithCopy(data.samples, data.fftSize);
      break;
  }
};

function startStreamingWithSharedBuffer(
  buffer: SharedRingBuffer,
  fftSize: number
): void {
  const processLoop = (): void => {
    try {
      // Read samples from shared buffer (zero-copy!)
      const samples = buffer.tryRead(fftSize);
      
      if (samples) {
        // Process FFT
        const fft = calculateFFTSync(samples, fftSize);
        
        // Post results (small array, copying is OK)
        self.postMessage({ type: 'fft-result', fft });
      }
      
      // Schedule next iteration
      setTimeout(processLoop, 0);
    } catch (err) {
      console.error('Streaming error:', err);
    }
  };
  
  processLoop();
}
```

#### Step 4: Feature Detection

**File**: `src/utils/sharedArrayBufferSupport.ts`

```typescript
export function isSharedArrayBufferSupported(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}

export function isCrossOriginIsolated(): boolean {
  return (
    typeof crossOriginIsolated !== 'undefined' && 
    crossOriginIsolated === true
  );
}

export function canUseSharedArrayBuffer(): boolean {
  return isSharedArrayBufferSupported() && isCrossOriginIsolated();
}

export function getSharedBufferCapabilities(): {
  supported: boolean;
  isolated: boolean;
  error?: string;
} {
  const supported = isSharedArrayBufferSupported();
  const isolated = isCrossOriginIsolated();
  
  let error: string | undefined;
  
  if (!supported) {
    error = 'SharedArrayBuffer not available in this browser';
  } else if (!isolated) {
    error = 'Cross-origin isolation required. Check server headers.';
  }
  
  return { supported, isolated, error };
}
```

### Expected Outcomes

- Zero-copy data transfer (no serialization overhead)
- 10+ GB/s throughput vs 200 MB/s with postMessage
- Reduced latency: <0.01ms vs 1-5ms
- Suitable for real-time streaming (20+ MS/s)

### Success Metrics

- Latency: <0.1ms for data transfer
- Throughput: >1 GB/s measured
- Compatible fallback for non-isolated contexts
- No breaking changes for existing deployments

## Phase 3: WebGPU Compute Shaders (Weeks 7-10)

### Objective

Use GPU compute for massively parallel FFT processing.

### Prerequisites

- WebGPU browser support (Chrome 113+, Edge 113+, Safari 18+)
- GPU with compute shader support
- Fallback to WASM for unsupported browsers

### Implementation Steps

[Implementation details similar to above, with WebGPU shader code, pipeline setup, etc.]

### Expected Outcomes

- 8-15x speedup for FFT 4096+
- Direct compute-to-render pipeline
- GPU utilization 60-80%

### Success Metrics

- FFT 4096: <4ms (down from 25-30ms)
- FFT 8192: <10ms (down from 100-120ms)
- Fallback coverage: 100%

## Testing Strategy

### Unit Tests

- Each optimization has dedicated test suite
- Performance benchmarks with before/after comparison
- Accuracy verification (bit-exact or within tolerance)

### Integration Tests

- End-to-end SDR processing with optimizations enabled
- Cross-browser compatibility testing
- Fallback path verification

### Performance Tests

```bash
npm run test:perf -- --testNamePattern=optimization
```

## Rollout Plan

### Phase 1: Development

- Implement in feature branch
- Run benchmarks, verify improvements
- Code review

### Phase 2: Beta Testing

- Deploy to staging with feature flags
- Monitor performance metrics
- Gather user feedback

### Phase 3: Production Rollout

- Enable for 10% of users
- Monitor error rates, performance
- Gradual rollout to 100%

## Monitoring

### Performance Metrics

- FFT duration (p50, p95, p99)
- Frame rate (visualizations)
- Memory usage
- CPU/GPU utilization

### Error Tracking

- WASM load failures
- Worker errors
- GPU context loss
- Fallback activations

### Success Criteria

- 2x improvement in FFT performance
- No increase in error rate
- Positive user feedback
- <1% fallback activation rate

## Documentation Updates

After each phase, update:

- [Performance Benchmarks](./performance-benchmarks.md) - Add measured results
- [Performance Optimization](./performance-optimization.md) - Update implementation status
- [WASM Runtime Flags](./wasm-runtime-flags.md) - Add new configuration options
- User-facing documentation - Explain new features/requirements

## Risks and Mitigation

### Risk: Browser Compatibility

**Mitigation**: Comprehensive feature detection, graceful fallbacks

### Risk: Security Headers

**Mitigation**: Documentation, configuration examples, fallback mode

### Risk: Performance Regression

**Mitigation**: Extensive benchmarking, A/B testing, rollback plan

### Risk: Increased Complexity

**Mitigation**: Good abstractions, thorough testing, clear documentation

## Related Documentation

- [Performance Benchmarks](./performance-benchmarks.md)
- [Performance Optimization Guide](./performance-optimization.md)
- [WASM Runtime Flags](./wasm-runtime-flags.md)

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-28 | 1.0 | Initial implementation plan |
