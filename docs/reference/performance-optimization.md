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
const dspWorker = new Worker("dsp-worker.js");

// Send samples to worker
dspWorker.postMessage(
  {
    type: "process",
    samples: audioBuffer,
    sampleRate: 48000,
  },
  [audioBuffer.buffer],
); // Transfer ownership

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

  if (type === "process") {
    const spectrum = computeFFT(samples);
    const audio = demodulate(samples);

    self.postMessage(
      {
        spectrum,
        audio,
      },
      [spectrum.buffer, audio.buffer],
    ); // Transfer back
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
worker.postMessage({ buffer: myFloat32Array }, [myFloat32Array.buffer]);
```

**Note**: After transfer, original is neutered (length = 0).

### SharedArrayBuffer for Zero-Copy

**Advanced technique for maximum performance** (requires HTTPS + security headers):

SharedArrayBuffer allows multiple workers and main thread to access the same memory without copying, eliminating transfer overhead entirely.

**Browser Requirements**:

- HTTPS deployment
- `Cross-Origin-Opener-Policy: same-origin` header
- `Cross-Origin-Embedder-Policy: require-corp` header
- Chrome 92+, Firefox 79+, Safari 15.2+

**Zero-Copy Pattern**:

```javascript
// Create shared buffer
const sharedBuffer = new SharedArrayBuffer(1024 * 4); // 1024 floats
const sharedArray = new Float32Array(sharedBuffer);

// Pass to worker (no copy!)
worker.postMessage({ sharedBuffer });

// Worker receives same memory
// worker.js
self.onmessage = (e) => {
  const samples = new Float32Array(e.data.sharedBuffer);

  // Process directly - no copy needed
  for (let i = 0; i < samples.length; i++) {
    samples[i] = processFFT(samples[i]);
  }

  // Signal completion
  Atomics.notify(samples, 0, 1);
};

// Main thread reads results immediately
Atomics.wait(sharedArray, 0, 0);
const processedData = sharedArray; // Already updated!
```

**Synchronization with Atomics**:

```javascript
// Ring buffer for continuous streaming
class SharedRingBuffer {
  constructor(size) {
    this.buffer = new SharedArrayBuffer((size + 2) * 4);
    this.data = new Float32Array(this.buffer, 8); // Skip header
    this.header = new Int32Array(this.buffer, 0, 2);
    this.size = size;
  }

  write(samples) {
    const writePos = Atomics.load(this.header, 0);

    for (let i = 0; i < samples.length; i++) {
      this.data[(writePos + i) % this.size] = samples[i];
    }

    Atomics.store(this.header, 0, (writePos + samples.length) % this.size);
    Atomics.notify(this.header, 0, 1);
  }

  read(count) {
    const readPos = Atomics.load(this.header, 1);
    const samples = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      samples[i] = this.data[(readPos + i) % this.size];
    }

    Atomics.store(this.header, 1, (readPos + count) % this.size);
    return samples;
  }
}
```

**Performance Benefits**:

| Transfer Method    | Latency   | Throughput (1MB) |
| ------------------ | --------- | ---------------- |
| postMessage (copy) | 1-5ms     | ~200 MB/s        |
| Transferable       | 0.1-0.5ms | ~2 GB/s          |
| SharedArrayBuffer  | <0.01ms   | ~10+ GB/s        |

**Use Cases**:

- Real-time SDR sample streaming (20+ MS/s)
- Multi-worker parallel processing
- Low-latency audio pipelines
- High-frequency data visualization

**Security Considerations**:

- Requires cross-origin isolation (Spectre mitigation)
- May not work in embedded contexts (iframes)
- Server configuration needed

**Resources**:

- [MDN SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- [Signal Analyzer Implementation](https://cprimozic.net/blog/building-a-signal-analyzer-with-modern-web-tech/)

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
      console.warn("Pool exhausted");
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

### WebAssembly SIMD Acceleration

**Advanced optimization for modern browsers** (2024+):

WebAssembly SIMD (Single Instruction, Multiple Data) provides 2-4x additional speedup on top of regular WASM by performing operations on multiple data points simultaneously.

**Browser Support**:

- Chrome 91+ ✅
- Firefox 89+ ✅
- Safari 16.4+ ✅
- Edge 91+ ✅

**Feature Detection**:

```javascript
// Example function - actual implementation uses isWasmSIMDSupported()
function detectWasmSIMD() {
  try {
    // Minimal WASM module with SIMD instruction
    return WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 127, 3, 2, 1, 0, 10, 10,
        1, 8, 0, 65, 0, 253, 12, 253, 98, 11,
      ]),
    );
  } catch {
    return false;
  }
}

if (detectWasmSIMD()) {
  // Load SIMD-optimized WASM module
  import("./dsp-simd.wasm");
} else {
  // Fallback to regular WASM
  import("./dsp.wasm");
}
```

**Implementation Strategies**:

1. **Vector Operations**: Process 4 float32 values per instruction
2. **Butterfly FFT**: SIMD-optimized complex multiply-add
3. **Parallel Windowing**: Apply window to 4+ samples simultaneously
4. **SIMD Intrinsics**: Use v128 types in AssemblyScript/Rust

**Example - SIMD FFT (AssemblyScript)**:

```typescript
// Load 4 samples at once
let samples = v128.load(samplesPtr);

// Multiply by twiddle factors (4 parallel operations)
let real = f32x4.mul(samples, twiddleReal);
let imag = f32x4.mul(samples, twiddleImag);

// Complex rotation
let result = f32x4.add(real, imag);

// Store result
v128.store(outputPtr, result);
```

**Performance Gains**:

| Operation | Regular WASM | WASM + SIMD | Total Speedup |
| --------- | ------------ | ----------- | ------------- |
| FFT 2048  | 6-8ms        | 2-3ms       | 8-10x vs JS   |
| FFT 4096  | 25-30ms      | 8-12ms      | 7-9x vs JS    |
| Windowing | 0.1-0.15ms   | 0.03-0.05ms | 4-7x vs JS    |

**Limitations**:

- No runtime detection in WASM itself (must build separate modules)
- Alignment requirements (16-byte boundaries)
- Limited to 128-bit wide vectors
- Trap on unsupported platforms (careful fallback needed)

**Resources**:

- [RustFFT WASM SIMD](https://deepwiki.com/ejmahler/RustFFT/4.4-wasm-simd-implementation)
- [V8 SIMD Blog Post](https://v8.dev/features/simd)
- [WebAssembly SIMD Proposal](https://github.com/WebAssembly/simd)

## WebGL Acceleration

### Waterfall Display

**Use GPU for rendering large waterfall displays**:

```javascript
class WebGLWaterfall {
  constructor(canvas, width, height) {
    this.gl = canvas.getContext("webgl2");
    this.width = width;
    this.height = height;
    this.texture = this.createTexture();
    this.setupShaders();
  }

  updateLine(spectrumData) {
    // Scroll texture up
    this.gl.copyTexSubImage2D(
      this.gl.TEXTURE_2D,
      0,
      0,
      1,
      0,
      0,
      this.width,
      this.height - 1,
    );

    // Add new line at bottom
    this.gl.texSubImage2D(
      this.gl.TEXTURE_2D,
      0,
      0,
      0,
      this.width,
      1,
      this.gl.LUMINANCE,
      this.gl.UNSIGNED_BYTE,
      spectrumData,
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
  gl.TEXTURE_2D,
  0,
  gl.R32F,
  spectrumLength,
  1,
  0,
  gl.RED,
  gl.FLOAT,
  spectrumData,
);

// Vertex shader samples texture, renders line
```

## WebGPU Compute Acceleration

**Next-generation GPU computing** (2024+ browsers):

WebGPU provides direct access to GPU compute capabilities, enabling 5-10x speedup for large FFTs and parallel DSP operations compared to WASM.

**Browser Support**:

- Chrome 113+ ✅
- Edge 113+ ✅
- Safari 18+ ✅
- Firefox: In development 🔄

**Feature Detection**:

```javascript
async function initWebGPU() {
  if (!navigator.gpu) {
    console.warn("WebGPU not supported");
    return null;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.warn("No GPU adapter found");
    return null;
  }

  const device = await adapter.requestDevice();
  return device;
}
```

**Compute Shader FFT Example**:

```wgsl
// WGSL compute shader for FFT butterfly operation
@group(0) @binding(0) var<storage, read_write> data: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read> twiddles: array<vec2<f32>>;

@compute @workgroup_size(64)
fn fft_butterfly(@builtin(global_invocation_id) id: vec3<u32>) {
    let idx = id.x;
    let half_size = arrayLength(&data) / 2u;

    if (idx >= half_size) {
        return;
    }

    // Butterfly operation
    let even = data[idx];
    let odd = data[idx + half_size];
    let twiddle = twiddles[idx];

    // Complex multiplication: odd * twiddle
    let odd_mul = vec2<f32>(
        odd.x * twiddle.x - odd.y * twiddle.y,
        odd.x * twiddle.y + odd.y * twiddle.x
    );

    // Combine
    data[idx] = even + odd_mul;
    data[idx + half_size] = even - odd_mul;
}
```

**JavaScript Integration**:

```javascript
class WebGPUFFT {
  async initialize(device, fftSize) {
    this.device = device;
    this.fftSize = fftSize;

    // Create buffers
    this.dataBuffer = device.createBuffer({
      size: fftSize * 8, // vec2<f32> = 8 bytes
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    // Load compute shader
    const module = device.createShaderModule({
      code: fftShaderCode,
    });

    // Create compute pipeline
    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module,
        entryPoint: "fft_butterfly",
      },
    });

    // Create bind group
    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.dataBuffer } },
        { binding: 1, resource: { buffer: this.twiddleBuffer } },
      ],
    });
  }

  async compute(samples) {
    // Upload data
    this.device.queue.writeBuffer(this.dataBuffer, 0, samples);

    // Create command encoder
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();

    // Dispatch compute shader
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.fftSize / 64));
    pass.end();

    // Submit
    this.device.queue.submit([encoder.finish()]);

    // Read results
    const resultBuffer = this.device.createBuffer({
      size: this.dataBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const copyEncoder = this.device.createCommandEncoder();
    copyEncoder.copyBufferToBuffer(
      this.dataBuffer,
      0,
      resultBuffer,
      0,
      this.dataBuffer.size,
    );
    this.device.queue.submit([copyEncoder.finish()]);

    await resultBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(resultBuffer.getMappedRange());
    resultBuffer.unmap();

    return result;
  }
}
```

**Performance Characteristics**:

| Operation | WASM (ms) | WebGPU (ms) | Speedup |
| --------- | --------- | ----------- | ------- |
| FFT 2048  | 6-8       | 0.5-1.0     | 8-12x   |
| FFT 4096  | 25-30     | 2-4         | 8-12x   |
| FFT 8192  | 100-120   | 8-12        | 10-12x  |
| FFT 16384 | 400-500   | 25-35       | 12-15x  |

**Best Practices**:

1. **Batch Operations**: Process multiple FFTs in one shader invocation
2. **Workgroup Size**: Tune for target GPU (typically 64-256)
3. **Memory Management**: Reuse buffers, avoid allocations
4. **Async Patterns**: Use timestamps for profiling
5. **Fallback Path**: Always provide WASM/JS fallback

**Direct Rendering Pipeline**:

```javascript
// Compute FFT and render in single GPU pass
class WebGPUSpectrumAnalyzer {
  async renderFrame(samples) {
    const encoder = this.device.createCommandEncoder();

    // 1. Compute pass: FFT
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(this.fftPipeline);
    computePass.setBindGroup(0, this.fftBindGroup);
    computePass.dispatchWorkgroups(this.workgroupCount);
    computePass.end();

    // 2. Render pass: Visualize
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup); // Uses FFT output
    renderPass.draw(vertexCount);
    renderPass.end();

    // Submit both passes together
    this.device.queue.submit([encoder.finish()]);
  }
}
```

**Optimization Tips**:

- Use timestamp queries for profiling GPU work
- Minimize CPU-GPU synchronization
- Leverage shared memory within workgroups
- Consider relaxed memory ordering for non-critical data
- Profile with browser GPU debuggers (Chrome DevTools, Safari Web Inspector)

**Resources**:

- [WebGPU Fundamentals](https://webgpufundamentals.org/)
- [Compute Shader Optimization](https://github.com/gfx-rs/wgpu/discussions/6688)
- [WebGPU Best Practices](https://toji.github.io/webgpu-best-practices/)

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
filter.type = "lowpass";
filter.frequency.value = 3000;
analyser.fftSize = 2048;
```

### AudioWorklet

**For custom DSP, use AudioWorklet (not ScriptProcessor)**:

```javascript
// main.js
await audioContext.audioWorklet.addModule("demodulator.js");
const demodNode = new AudioWorkletNode(context, "demodulator");

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

registerProcessor("demodulator", DemodulatorProcessor);
```

### Sample Rate Conversion

**Use OfflineAudioContext for resampling**:

```javascript
async function resample(buffer, targetRate) {
  const ctx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.duration * targetRate,
    targetRate,
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
    let min = Infinity,
      max = -Infinity;
    for (let j = start; j < end; j++) {
      if (data[j] < min) min = data[j];
      if (data[j] > max) max = data[j];
    }

    result[i] = i % 2 === 0 ? min : max;
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
  element.style.top = positions[i] + "px";
}

// ✅ GOOD - Single update
const updates = positions.map((p) => `top: ${p}px`).join(";");
element.style.cssText = updates;

// ✅ BETTER - Use transform (GPU accelerated)
element.style.transform = `translateY(${position}px)`;
```

## Profiling and Debugging

### Performance API

**Measure critical paths**:

```javascript
performance.mark("fft-start");
const spectrum = computeFFT(samples);
performance.mark("fft-end");
performance.measure("fft", "fft-start", "fft-end");

const measure = performance.getEntriesByName("fft")[0];
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
samples.forEach((s) => updateDisplay(s));
```

### ✅ Do: Batch updates

```javascript
let buffer = [];
samples.forEach((s) => {
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

### Official Documentation

- **Web Workers**: [MDN Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- **SharedArrayBuffer**: [MDN SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- **WebGL**: [WebGL Fundamentals](https://webglfundamentals.org/)
- **WebGPU**: [WebGPU Fundamentals](https://webgpufundamentals.org/)
- **Audio Worklet**: [MDN AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet)
- **Performance API**: [MDN Performance](https://developer.mozilla.org/en-US/docs/Web/API/Performance)

### WebAssembly and SIMD

- **WebAssembly**: [Official Specification](https://webassembly.github.io/spec/)
- **WASM SIMD**: [V8 SIMD Features](https://v8.dev/features/simd)
- **RustFFT WASM**: [WASM SIMD Implementation](https://deepwiki.com/ejmahler/RustFFT/4.4-wasm-simd-implementation)
- **pffft.wasm**: [Fast FFT Library](https://github.com/JorenSix/pffft.wasm)
- **WebFFT**: [Meta-Library for FFT](https://webfft.com/)
- **AssemblyScript**: [TypeScript to WASM](https://www.assemblyscript.org/)

### Performance Optimization Guides

- **Web.dev Performance**: [web.dev/performance](https://web.dev/performance/)
- **High-Performance JS**: [Off-Main-Thread](https://web.dev/off-main-thread/)
- **Signal Analyzer Example**: [Building with Modern Web Tech](https://cprimozic.net/blog/building-a-signal-analyzer-with-modern-web-tech/)
- **WebGPU Optimization**: [Compute Shader Performance](https://github.com/gfx-rs/wgpu/discussions/6688)

### Internal Documentation

- **[Performance Benchmarks](./performance-benchmarks.md)**: Detailed measurements and optimization results
- **[WASM Runtime Flags](./wasm-runtime-flags.md)**: WebAssembly configuration
- **[FFT Implementation](./fft-implementation.md)**: FFT algorithm details
- **[WebGL Visualization](./webgl-visualization.md)**: GPU rendering techniques

## See Also

- [Performance Benchmarks Documentation](./performance-benchmarks.md) - Comprehensive benchmark results and optimization roadmap
- [Visualization Performance Guide](../VISUALIZATION_PERFORMANCE_GUIDE.md) - Detailed visualization optimization patterns
