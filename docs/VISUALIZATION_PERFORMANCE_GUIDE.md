# Visualization Performance Optimization Guide

## Overview

This guide documents performance optimization patterns and best practices for the rad.io visualization architecture, targeting 60 FPS rendering with minimal GC pressure.

## Performance Goals

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Frame Rate | 60 FPS | < 30 FPS |
| Frame Time | < 16ms | > 33ms |
| GC Frequency | < 1/sec | > 5/sec |
| Memory Growth | < 10MB/min | > 50MB/min |
| CPU Usage | < 50% | > 80% |

## Optimization Techniques

### 1. TypedArray Pooling

**Problem**: Creating new TypedArrays in hot paths causes frequent GC pauses.

**Solution**: Reuse buffers via object pooling.

```typescript
// ❌ Bad: Allocates on every frame
function processFrame(samples: Sample[]): Float32Array {
  const output = new Float32Array(samples.length); // Allocation!
  // ... process
  return output;
}

// ✅ Good: Reuse buffer
class OptimizedProcessor {
  private buffer: Float32Array;

  constructor(size: number) {
    this.buffer = new Float32Array(size);
  }

  processFrame(samples: Sample[]): Float32Array {
    // Reuse existing buffer
    for (let i = 0; i < samples.length; i++) {
      this.buffer[i] = /* ... */;
    }
    return this.buffer;
  }
}
```

**Buffer Pool Pattern**:

```typescript
class BufferPool {
  private buffers: Map<number, Float32Array[]> = new Map();

  acquire(size: number): Float32Array {
    const pool = this.buffers.get(size) ?? [];
    return pool.pop() ?? new Float32Array(size);
  }

  release(buffer: Float32Array): void {
    const size = buffer.length;
    const pool = this.buffers.get(size) ?? [];
    
    if (pool.length < 10) { // Max pool size
      pool.push(buffer);
      this.buffers.set(size, pool);
    }
  }
}

// Usage in processor
class PooledProcessor {
  private pool = new BufferPool();

  process(samples: Sample[]): Float32Array {
    const output = this.pool.acquire(samples.length);
    
    // ... process into output
    
    // Note: Consumer must release buffer when done
    return output;
  }
}
```

**Existing Implementation**: See `src/lib/utils/buffer-pool.ts`

### 2. WASM Acceleration

**Problem**: JavaScript DSP operations are slow for large datasets.

**Solution**: Use WebAssembly for compute-intensive operations.

```typescript
import { calculateFFTSync } from '../../utils/dsp';

// Automatically uses WASM when available
const fft = calculateFFTSync(samples, fftSize);
```

**WASM Functions Available**:
- `calculateFFTSync` - FFT computation
- `applyWindow` (Hann, Hamming, Blackman) - Window functions
- `calculateSpectrogram` - Multi-frame FFT

**Performance Improvement**: 3-5x faster than JavaScript implementation.

**Feature Detection**:

```typescript
import { isWasmAvailable, isWasmRuntimeEnabled } from '../../utils/dspWasm';

if (isWasmAvailable() && isWasmRuntimeEnabled()) {
  // Use WASM path
} else {
  // Use JavaScript fallback
}
```

### 3. Web Workers for Offscreen Processing

**Problem**: Heavy processing blocks the main thread, causing frame drops.

**Solution**: Move processing to Web Workers.

```typescript
// worker.ts
import { FFTProcessor } from './visualization/processors';

const processor = new FFTProcessor({
  type: 'fft',
  fftSize: 2048,
  windowFunction: 'hann',
  useWasm: true,
  sampleRate: 2048000,
});

self.onmessage = (e) => {
  const { samples } = e.data;
  const output = processor.process(samples);
  
  // Transfer ownership for zero-copy
  self.postMessage(
    { magnitudes: output.magnitudes },
    [output.magnitudes.buffer]
  );
};
```

```typescript
// main.ts
const worker = new Worker(new URL('./worker.ts', import.meta.url));

worker.onmessage = (e) => {
  const { magnitudes } = e.data;
  renderSpectrum(magnitudes);
};

// Send samples with transfer
worker.postMessage(
  { samples },
  [samples.buffer] // Transfer ownership
);
```

**Existing Implementation**: See `src/utils/dspWorker.ts` and `src/lib/dsp/fft-worker-pool.ts`

### 4. OffscreenCanvas Rendering

**Problem**: Canvas rendering on main thread competes with UI updates.

**Solution**: Use OffscreenCanvas in Web Worker.

```typescript
// worker.ts
let offscreen: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;

self.onmessage = (e) => {
  if (e.data.canvas) {
    offscreen = e.data.canvas;
    ctx = offscreen.getContext('2d')!;
  } else if (e.data.data) {
    // Render in worker
    drawSpectrum(ctx, e.data.data);
  }
};
```

```typescript
// main.ts
const canvas = document.getElementById('spectrum') as HTMLCanvasElement;
const offscreen = canvas.transferControlToOffscreen();

worker.postMessage({ canvas: offscreen }, [offscreen]);
```

**Fallback Pattern** (see IQConstellation, WaveformVisualizer):

```typescript
try {
  // Try OffscreenCanvas
  if (typeof OffscreenCanvas !== 'undefined') {
    useOffscreenCanvas();
    return;
  }
} catch (err) {
  console.warn('OffscreenCanvas failed', err);
}

// Fallback to main thread Canvas2D
useMainThreadCanvas();
```

### 5. WebGL Rendering

**Problem**: Canvas2D is too slow for high-frequency updates.

**Solution**: Use WebGL for GPU-accelerated rendering.

```typescript
import { WebGLSpectrum } from './visualization/renderers';

const renderer = new WebGLSpectrum();
await renderer.initialize(canvas);

// Render at 60 FPS
function renderLoop() {
  const data = { magnitudes, freqMin: 0, freqMax: 1024 };
  renderer.render(data);
  requestAnimationFrame(renderLoop);
}
```

**Performance Characteristics**:
- **WebGL**: 60+ FPS for 8192 bins
- **Canvas2D**: 30 FPS for 2048 bins

**Renderer Selection** (automatic in Spectrum/Waterfall components):

```typescript
// Try WebGL first
try {
  const webgl = new WebGLSpectrum();
  if (await webgl.initialize(canvas)) {
    return webgl;
  }
} catch (err) {
  console.warn('WebGL failed', err);
}

// Fallback to Canvas2D
const canvas2d = new CanvasSpectrum();
await canvas2d.initialize(canvas);
return canvas2d;
```

### 6. Batch Processing

**Problem**: Processing single samples is inefficient.

**Solution**: Accumulate and process in batches.

```typescript
class BatchProcessor {
  private batch: Sample[] = [];
  private batchSize = 2048;

  addSamples(samples: Sample[]): Float32Array | null {
    this.batch.push(...samples);

    if (this.batch.length >= this.batchSize) {
      const output = this.processBatch(this.batch.slice(0, this.batchSize));
      this.batch = this.batch.slice(this.batchSize);
      return output;
    }

    return null; // Wait for full batch
  }

  private processBatch(samples: Sample[]): Float32Array {
    // Process full batch at once
    return calculateFFTSync(samples, this.batchSize);
  }
}
```

### 7. Adaptive Quality

**Problem**: Maintaining high quality at all times wastes resources.

**Solution**: Reduce quality when performance drops.

```typescript
class AdaptiveProcessor {
  private targetFPS = 60;
  private currentFPS = 60;
  private quality: 'high' | 'medium' | 'low' = 'high';

  updateFPS(fps: number): void {
    this.currentFPS = fps;

    if (fps < 30) {
      this.quality = 'low';
    } else if (fps < 50) {
      this.quality = 'medium';
    } else {
      this.quality = 'high';
    }
  }

  process(samples: Sample[]): Output {
    const fftSize = this.getFftSize();
    return calculateFFTSync(samples, fftSize);
  }

  private getFftSize(): number {
    switch (this.quality) {
      case 'high': return 4096;
      case 'medium': return 2048;
      case 'low': return 1024;
    }
  }
}
```

**Existing Implementation**: See `src/lib/render/RenderTierManager.ts`

### 8. Request Animation Frame Scheduling

**Problem**: Processing at arbitrary intervals causes frame drops.

**Solution**: Synchronize with browser's rendering schedule.

```typescript
class SynchronizedProcessor {
  private requestId: number | null = null;

  start(callback: (data: Output) => void): void {
    const process = (): void => {
      const output = this.processFrame();
      callback(output);
      this.requestId = requestAnimationFrame(process);
    };

    this.requestId = requestAnimationFrame(process);
  }

  stop(): void {
    if (this.requestId !== null) {
      cancelAnimationFrame(this.requestId);
      this.requestId = null;
    }
  }
}
```

### 9. Data Decimation

**Problem**: Too many samples overwhelm rendering.

**Solution**: Downsample data for visualization.

```typescript
function decimate(samples: Sample[], targetSize: number): Sample[] {
  if (samples.length <= targetSize) {
    return samples;
  }

  const step = Math.floor(samples.length / targetSize);
  const decimated: Sample[] = [];

  for (let i = 0; i < samples.length; i += step) {
    decimated.push(samples[i]);
  }

  return decimated.slice(0, targetSize);
}
```

**Smart Decimation** (preserve peaks):

```typescript
function decimateWithPeaks(samples: Sample[], targetSize: number): Sample[] {
  const step = Math.floor(samples.length / targetSize);
  const decimated: Sample[] = [];

  for (let i = 0; i < samples.length; i += step) {
    // Find max in this window
    let maxSample = samples[i];
    let maxMagnitude = Math.sqrt(maxSample.I ** 2 + maxSample.Q ** 2);

    for (let j = i; j < Math.min(i + step, samples.length); j++) {
      const sample = samples[j];
      const magnitude = Math.sqrt(sample.I ** 2 + sample.Q ** 2);
      
      if (magnitude > maxMagnitude) {
        maxSample = sample;
        maxMagnitude = magnitude;
      }
    }

    decimated.push(maxSample);
  }

  return decimated;
}
```

**Existing Implementation**: See `src/utils/dspProcessing.ts` `decimate()` function

### 10. Memoization

**Problem**: Recomputing same values repeatedly.

**Solution**: Cache expensive calculations.

```typescript
class MemoizedProcessor {
  private windowCache = new Map<string, Float32Array>();

  private getWindow(type: WindowFunction, size: number): Float32Array {
    const key = `${type}-${size}`;
    
    let window = this.windowCache.get(key);
    if (!window) {
      window = this.computeWindow(type, size);
      this.windowCache.set(key, window);
    }
    
    return window;
  }

  private computeWindow(type: WindowFunction, size: number): Float32Array {
    // Expensive window computation
    const window = new Float32Array(size);
    // ... compute window coefficients
    return window;
  }
}
```

## Profiling and Monitoring

### Browser DevTools Performance Tab

1. Open DevTools → Performance
2. Start recording
3. Interact with visualization
4. Stop recording
5. Analyze:
   - Frame rate (aim for 60 FPS)
   - Long tasks (> 50ms)
   - Garbage collection pauses
   - Memory allocations

### Performance Marks

```typescript
import { performanceMonitor } from './utils/performanceMonitor';

function processData(samples: Sample[]): Output {
  const mark = 'process-start';
  performanceMonitor.mark(mark);

  // ... processing

  performanceMonitor.measure('process-duration', mark);
  
  return output;
}
```

**Existing Implementation**: See `src/utils/performanceMonitor.ts` and `src/utils/dsp.ts` for examples.

### FPS Monitoring

```typescript
class FPSMonitor {
  private frames: number[] = [];
  private lastTime = performance.now();

  recordFrame(): void {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.frames.push(1000 / delta); // FPS

    if (this.frames.length > 60) {
      this.frames.shift();
    }

    this.lastTime = now;
  }

  getAverageFPS(): number {
    return this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
  }
}
```

### Memory Monitoring

```typescript
if (performance.memory) {
  setInterval(() => {
    console.log({
      used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
      total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
      limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB',
    });
  }, 5000);
}
```

## Performance Checklist

When implementing new processors or visualizations:

- [ ] Use TypedArrays instead of regular arrays
- [ ] Reuse buffers when possible (object pooling)
- [ ] Enable WASM acceleration for DSP operations
- [ ] Consider Web Workers for heavy processing
- [ ] Use WebGL for high-frequency rendering
- [ ] Batch process samples instead of one-by-one
- [ ] Implement adaptive quality for graceful degradation
- [ ] Synchronize with requestAnimationFrame
- [ ] Decimate data if sample count is excessive
- [ ] Memoize expensive repeated calculations
- [ ] Add performance marks for profiling
- [ ] Monitor FPS and memory usage
- [ ] Test on low-end devices

## Common Performance Issues

### Issue: Frame Rate Drops Below 30 FPS

**Diagnosis**:
1. Open DevTools Performance tab
2. Record while issue occurs
3. Look for long tasks > 50ms

**Solutions**:
- Move processing to Web Worker
- Reduce FFT size or sample rate
- Enable WASM acceleration
- Use WebGL instead of Canvas2D

### Issue: High Memory Usage

**Diagnosis**:
1. Check performance.memory metrics
2. Look for continuous growth
3. Take heap snapshots

**Solutions**:
- Implement buffer pooling
- Limit spectrogram buffer size
- Clear buffers in cleanup methods
- Use Transferable objects with workers

### Issue: GC Pauses

**Diagnosis**:
1. DevTools shows frequent GC events
2. Frame drops correlate with GC

**Solutions**:
- Avoid allocations in hot paths
- Reuse TypedArrays
- Reduce object creation
- Use primitive values when possible

### Issue: Slow Initial Load

**Diagnosis**:
1. Network tab shows large bundle
2. Main thread blocked during parse

**Solutions**:
- Code split visualization modules
- Lazy load components
- Use dynamic imports
- Enable tree shaking

## Resources

- **Buffer Pool**: `src/lib/utils/buffer-pool.ts`
- **WASM DSP**: `src/utils/dspWasm.ts`
- **Worker Pool**: `src/lib/dsp/fft-worker-pool.ts`
- **Render Tiers**: `src/lib/render/RenderTierManager.ts`
- **Performance Monitor**: `src/utils/performanceMonitor.ts`
- **WebGL Utilities**: `src/utils/webgl.ts`

## Performance Testing

Run performance tests with:

```bash
npm run test:perf
```

This enables `TRACK_PERFORMANCE=1` environment variable which activates performance logging in tests.

## Further Reading

- [WebGL Fundamentals](https://webgl2fundamentals.org/)
- [High Performance JavaScript](https://www.oreilly.com/library/view/high-performance-javascript/9781449382308/)
- [JavaScript Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
