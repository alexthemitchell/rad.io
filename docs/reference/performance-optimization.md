# Performance Optimization for Browser-Based SDR

## Overview

Real-time signal processing in browsers presents unique challenges. This guide covers optimization strategies for maintaining high performance.

## Performance Targets

### Minimum Requirements
- **FFT computation**: <16ms per frame (60 FPS)
- **Audio processing**: <2ms latency for real-time
- **Waterfall update**: 30-60 FPS smooth scrolling
- **UI responsiveness**: <100ms for user interactions

### Optimization Goals
- Maintain 60 FPS spectrum/waterfall updates
- Process 2+ MS/s sample rate in real-time
- Keep CPU usage <50% on target hardware
- Minimize memory allocations/garbage collection

## Web Worker Architecture

### Why Web Workers

**Problem**: JavaScript is single-threaded. Heavy DSP blocks UI.

**Solution**: Offload processing to background threads.

### Worker Structure

```javascript
// main.js - UI thread
const dspWorker = new Worker('dsp-worker.js');

// Send samples to worker
dspWorker.postMessage({
  type: 'process',
  samples: audioBuffer,
  sampleRate: 48000
}, [audioBuffer.buffer]); // Transfer ownership

// Receive results
dspWorker.onmessage = (e) => {
  const { spectrum, audio } = e.data;
  updateDisplay(spectrum);
  playAudio(audio);
};
```

```javascript
// dsp-worker.js - Worker thread
self.onmessage = (e) => {
  const { type, samples, sampleRate } = e.data;
  
  if (type === 'process') {
    const spectrum = computeFFT(samples);
    const audio = demodulate(samples);
    
    self.postMessage({
      spectrum,
      audio
    }, [spectrum.buffer, audio.buffer]); // Transfer back
  }
};
```

### Multiple Workers

**Strategy**: Parallel processing pipeline

```javascript
const fftWorker = new Worker('fft-worker.js');
const demodWorker = new Worker('demod-worker.js');
const audioWorker = new Worker('audio-worker.js');

// Pipeline
rawSamples → fftWorker → spectrum display
           ↘ demodWorker → audioWorker → audio output
```

### Transferable Objects

**Critical**: Use transferable objects to avoid copying.

```javascript
// ❌ SLOW - Copies data
worker.postMessage({ buffer: myFloat32Array });

// ✅ FAST - Transfers ownership
worker.postMessage(
  { buffer: myFloat32Array },
  [myFloat32Array.buffer]
);
```

**Note**: After transfer, original is neutered (length = 0).

## Memory Management

### Typed Arrays

**Always use typed arrays for numerical data**:

```javascript
// ✅ GOOD
const samples = new Float32Array(1024);
const spectrum = new Float32Array(512);

// ❌ BAD
const samples = [];
const spectrum = [];
```

### Pre-allocation

**Avoid allocations in hot paths**:

```javascript
// ✅ GOOD - Allocate once
class FFTProcessor {
  constructor(size) {
    this.buffer = new Float32Array(size);
    this.window = this.createWindow(size);
    this.fftReal = new Float32Array(size);
    this.fftImag = new Float32Array(size);
  }
  
  process(input) {
    // Reuse buffers
    for (let i = 0; i < input.length; i++) {
      this.buffer[i] = input[i] * this.window[i];
    }
    // ... process
  }
}

// ❌ BAD - Allocates every call
function process(input) {
  const buffer = new Float32Array(input.length);
  const window = createWindow(input.length);
  // ...
}
```

### Object Pooling

**Reuse objects instead of creating new ones**:

```javascript
class BufferPool {
  constructor(size, count) {
    this.size = size;
    this.available = [];
    this.inUse = new Set();
    
    for (let i = 0; i < count; i++) {
      this.available.push(new Float32Array(size));
    }
  }
  
  acquire() {
    if (this.available.length === 0) {
      console.warn('Pool exhausted');
      return new Float32Array(this.size);
    }
    const buffer = this.available.pop();
    this.inUse.add(buffer);
    return buffer;
  }
  
  release(buffer) {
    this.inUse.delete(buffer);
    this.available.push(buffer);
  }
}

// Usage
const pool = new BufferPool(4096, 10);
const buffer = pool.acquire();
// ... use buffer
pool.release(buffer);
```

### Garbage Collection

**Minimize GC pressure**:

1. Avoid allocations in loops
2. Reuse buffers
3. Use object pools
4. Clear large arrays when done: `array.fill(0)`

## FFT Optimization

### Library Selection

**Options**:
1. **fft.js**: Pure JS, fast, well-tested
2. **kiss-fft.js**: Port of KISS FFT
3. **dsp.js**: Full DSP suite
4. **Web Audio FFT**: Built-in, but limited

**Recommendation**: fft.js for flexibility, Web Audio for simplicity

### FFT Size Selection

**Trade-offs**:
- Larger FFT = Better frequency resolution, more CPU
- Power of 2 sizes are much faster
- Common: 256, 512, 1024, 2048, 4096

**Adaptive sizing**:
```javascript
function selectFFTSize(sampleRate, desiredResolution) {
  const minSize = Math.ceil(sampleRate / desiredResolution);
  return Math.pow(2, Math.ceil(Math.log2(minSize)));
}
```

### Overlap Processing

**Technique**: Process overlapping windows for smoother display.

```javascript
class OverlapProcessor {
  constructor(fftSize, overlap = 0.5) {
    this.fftSize = fftSize;
    this.hopSize = Math.floor(fftSize * (1 - overlap));
    this.buffer = new Float32Array(fftSize);
    this.position = 0;
  }
  
  process(newSamples) {
    const results = [];
    
    for (let i = 0; i < newSamples.length; i++) {
      this.buffer[this.position++] = newSamples[i];
      
      if (this.position >= this.fftSize) {
        results.push(this.computeFFT(this.buffer));
        
        // Shift buffer by hop size
        this.buffer.copyWithin(0, this.hopSize);
        this.position -= this.hopSize;
      }
    }
    
    return results;
  }
}
```

### Window Function Caching

**Pre-compute window once**:

```javascript
class WindowCache {
  constructor() {
    this.cache = new Map();
  }
  
  getWindow(type, size) {
    const key = `${type}-${size}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, this.computeWindow(type, size));
    }
    return this.cache.get(key);
  }
  
  computeWindow(type, size) {
    const window = new Float32Array(size);
    // ... compute window
    return window;
  }
}
```

## WebGL Acceleration

### Waterfall Display

**Use GPU for rendering large waterfall displays**:

```javascript
class WebGLWaterfall {
  constructor(canvas, width, height) {
    this.gl = canvas.getContext('webgl2');
    this.width = width;
    this.height = height;
    this.texture = this.createTexture();
    this.setupShaders();
  }
  
  updateLine(spectrumData) {
    // Scroll texture up
    this.gl.copyTexSubImage2D(
      this.gl.TEXTURE_2D,
      0, 0, 1, 0, 0,
      this.width, this.height - 1
    );
    
    // Add new line at bottom
    this.gl.texSubImage2D(
      this.gl.TEXTURE_2D,
      0, 0, 0,
      this.width, 1,
      this.gl.LUMINANCE,
      this.gl.UNSIGNED_BYTE,
      spectrumData
    );
    
    this.render();
  }
}
```

### Spectrum Display

**GPU-accelerated line rendering**:

```javascript
// Upload spectrum data as texture
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texImage2D(
  gl.TEXTURE_2D, 0,
  gl.R32F,
  spectrumLength, 1, 0,
  gl.RED, gl.FLOAT,
  spectrumData
);

// Vertex shader samples texture, renders line
```

## Audio Processing Optimization

### Web Audio API

**Use native audio graph for efficiency**:

```javascript
const audioContext = new AudioContext();

// Create processing chain
const source = audioContext.createMediaStreamSource(stream);
const filter = audioContext.createBiquadFilter();
const analyser = audioContext.createAnalyser();
const gain = audioContext.createGain();

// Connect
source.connect(filter);
filter.connect(analyser);
analyser.connect(gain);
gain.connect(audioContext.destination);

// Configure
filter.type = 'lowpass';
filter.frequency.value = 3000;
analyser.fftSize = 2048;
```

### AudioWorklet

**For custom DSP, use AudioWorklet (not ScriptProcessor)**:

```javascript
// main.js
await audioContext.audioWorklet.addModule('demodulator.js');
const demodNode = new AudioWorkletNode(context, 'demodulator');

// demodulator.js
class DemodulatorProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0][0];
    const output = outputs[0][0];
    
    for (let i = 0; i < input.length; i++) {
      output[i] = this.demodulate(input[i]);
    }
    
    return true;
  }
}

registerProcessor('demodulator', DemodulatorProcessor);
```

### Sample Rate Conversion

**Use OfflineAudioContext for resampling**:

```javascript
async function resample(buffer, targetRate) {
  const ctx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.duration * targetRate,
    targetRate
  );
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  
  return await ctx.startRendering();
}
```

## Decimation for Display

**Don't render every sample**:

```javascript
function decimateForDisplay(data, targetPoints) {
  if (data.length <= targetPoints) return data;
  
  const result = new Float32Array(targetPoints);
  const step = data.length / targetPoints;
  
  for (let i = 0; i < targetPoints; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    
    // Min-max decimation preserves peaks
    let min = Infinity, max = -Infinity;
    for (let j = start; j < end; j++) {
      if (data[j] < min) min = data[j];
      if (data[j] > max) max = data[j];
    }
    
    result[i] = (i % 2 === 0) ? min : max;
  }
  
  return result;
}
```

## Rendering Optimization

### Canvas vs WebGL

**Canvas 2D**:
- ✅ Simple API
- ✅ Good for <1000 points
- ❌ Slow for complex scenes

**WebGL**:
- ✅ Very fast for large data
- ✅ GPU accelerated
- ❌ More complex

**Use Canvas for UI, WebGL for spectrum/waterfall**

### requestAnimationFrame

**Sync updates with display refresh**:

```javascript
class DisplayManager {
  constructor() {
    this.needsUpdate = false;
    this.isAnimating = false;
  }
  
  requestUpdate() {
    this.needsUpdate = true;
    if (!this.isAnimating) {
      this.isAnimating = true;
      requestAnimationFrame(() => this.render());
    }
  }
  
  render() {
    if (this.needsUpdate) {
      this.updateDisplay();
      this.needsUpdate = false;
    }
    
    this.isAnimating = false;
  }
}
```

### Batch Updates

**Group DOM operations**:

```javascript
// ❌ BAD - Multiple reflows
for (let i = 0; i < 100; i++) {
  element.style.top = positions[i] + 'px';
}

// ✅ GOOD - Single update
const updates = positions.map(p => `top: ${p}px`).join(';');
element.style.cssText = updates;

// ✅ BETTER - Use transform (GPU accelerated)
element.style.transform = `translateY(${position}px)`;
```

## Profiling and Debugging

### Performance API

**Measure critical paths**:

```javascript
performance.mark('fft-start');
const spectrum = computeFFT(samples);
performance.mark('fft-end');
performance.measure('fft', 'fft-start', 'fft-end');

const measure = performance.getEntriesByName('fft')[0];
console.log(`FFT took ${measure.duration.toFixed(2)}ms`);
```

### Chrome DevTools

**Profile CPU usage**:
1. Open DevTools > Performance
2. Record during operation
3. Look for:
   - Long tasks (>50ms)
   - GC pauses
   - Layout thrashing

### Memory Profiling

**Check for leaks**:
1. DevTools > Memory
2. Take heap snapshot
3. Compare before/after
4. Look for detached objects

## Platform-Specific Optimization

### Mobile Devices

**Considerations**:
- Lower CPU/GPU power
- Battery constraints
- Smaller screens

**Strategies**:
- Reduce FFT size (512-1024)
- Lower update rate (30 FPS)
- Simplify visualizations
- Use more aggressive decimation

### Desktop

**Take advantage of**:
- Multiple cores (more workers)
- Larger FFT sizes (4096-8192)
- Higher resolution displays
- WebGL 2.0 features

## Common Pitfalls

### ❌ Don't: Allocate in hot loops
```javascript
for (let i = 0; i < 1000; i++) {
  const temp = new Float32Array(1024);
  process(temp);
}
```

### ✅ Do: Reuse buffers
```javascript
const temp = new Float32Array(1024);
for (let i = 0; i < 1000; i++) {
  process(temp);
}
```

### ❌ Don't: Block main thread
```javascript
const spectrum = heavyFFT(largeSamples); // Freezes UI
updateDisplay(spectrum);
```

### ✅ Do: Use workers
```javascript
worker.postMessage({ samples: largeSamples });
worker.onmessage = (e) => updateDisplay(e.data.spectrum);
```

### ❌ Don't: Update every sample
```javascript
samples.forEach(s => updateDisplay(s));
```

### ✅ Do: Batch updates
```javascript
let buffer = [];
samples.forEach(s => {
  buffer.push(s);
  if (buffer.length >= BATCH_SIZE) {
    updateDisplay(buffer);
    buffer = [];
  }
});
```

## Benchmarking

### Test Suite

```javascript
class PerformanceTest {
  async runTests() {
    const sizes = [256, 512, 1024, 2048, 4096];
    
    for (const size of sizes) {
      const samples = new Float32Array(size);
      const iterations = 1000;
      
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeFFT(samples);
      }
      const end = performance.now();
      
      const avg = (end - start) / iterations;
      console.log(`FFT ${size}: ${avg.toFixed(2)}ms avg`);
    }
  }
}
```

## Target Performance Metrics

### Acceptable Performance
- FFT 2048: <5ms
- FFT 4096: <10ms
- Spectrum render: <16ms (60 FPS)
- Waterfall update: <16ms
- Total processing: <50% CPU

### Excellent Performance
- FFT 2048: <2ms
- FFT 4096: <5ms
- Spectrum render: <8ms (120 FPS capable)
- Waterfall update: <8ms
- Total processing: <30% CPU

## Resources

- **Web Workers**: MDN documentation
- **WebGL**: webglfundamentals.org
- **Audio Worklet**: W3C specification
- **Performance**: web.dev/performance
