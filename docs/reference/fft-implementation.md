# FFT Implementation in Browser Environments

## Overview

Fast Fourier Transform (FFT) is the cornerstone of spectrum analysis in SDR applications. This guide covers practical implementation for browser-based SDR.

## FFT Fundamentals

### The Discrete Fourier Transform (DFT)

Converts N time-domain samples to N frequency-domain values:

```
X[k] = Σ(n=0 to N-1) x[n] × e^(-j2πkn/N)
```

Where:

- x[n] = input samples (time domain)
- X[k] = output bins (frequency domain)
- N = number of samples
- k = frequency bin index
- j = √(-1)

**Complexity**: O(N²) - too slow for real-time

### Fast Fourier Transform (FFT)

Efficient algorithm for computing DFT using divide-and-conquer:

**Complexity**: O(N log N) - practical for real-time

**Requirements**: N must be power of 2 (256, 512, 1024, 2048, 4096...)

## Implementation Options

### 1. Web Audio API (Simplest)

**Pros**:

- Built-in, no library needed
- Hardware accelerated
- Automatic window function

**Cons**:

- Limited to audio rates (48 kHz typical)
- Fixed window (Blackman)
- Less flexible

**Code**:

```javascript
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();

// Configure
analyser.fftSize = 2048; // Power of 2, max 32768
analyser.smoothingTimeConstant = 0; // No smoothing

// Get frequency data
const frequencyData = new Float32Array(analyser.frequencyBinCount);
analyser.getFloatFrequencyData(frequencyData); // Returns dB values

// Or get raw FFT magnitudes
const rawData = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(rawData); // 0-255 scale
```

**Bin Mapping**:

```javascript
const sampleRate = audioContext.sampleRate;
const binCount = analyser.frequencyBinCount; // fftSize / 2
const frequencyResolution = sampleRate / analyser.fftSize;

function binToFrequency(bin) {
  return bin * frequencyResolution;
}

function frequencyToBin(frequency) {
  return Math.round(frequency / frequencyResolution);
}
```

### 2. fft.js Library (Recommended)

**Pros**:

- Fast pure JavaScript
- Flexible (any sample rate)
- Well-tested
- Custom window functions

**Cons**:

- Requires library
- Manual power spectrum calculation

**Installation**:

```bash
npm install fft.js
```

**Code**:

```javascript
import FFT from "fft.js";

class FFTProcessor {
  constructor(size) {
    this.size = size;
    this.fft = new FFT(size);
    this.input = new Array(size);
    this.output = this.fft.createComplexArray();
    this.window = this.createHannWindow(size);
  }

  createHannWindow(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    return window;
  }

  process(samples) {
    // Apply window
    for (let i = 0; i < this.size; i++) {
      this.input[i] = samples[i] * this.window[i];
    }

    // Transform
    this.fft.realTransform(this.output, this.input);
    this.fft.completeSpectrum(this.output);

    // Calculate magnitude
    const magnitudes = new Float32Array(this.size / 2);
    for (let i = 0; i < magnitudes.length; i++) {
      const real = this.output[2 * i];
      const imag = this.output[2 * i + 1];
      magnitudes[i] = Math.sqrt(real * real + imag * imag);
    }

    return magnitudes;
  }

  powerSpectrum(samples) {
    const magnitudes = this.process(samples);
    const power = new Float32Array(magnitudes.length);

    for (let i = 0; i < magnitudes.length; i++) {
      power[i] = magnitudes[i] * magnitudes[i];
    }

    return power;
  }

  powerSpectrumDB(samples, reference = 1.0) {
    const power = this.powerSpectrum(samples);
    const dB = new Float32Array(power.length);

    for (let i = 0; i < power.length; i++) {
      dB[i] = 10 * Math.log10(power[i] / reference);
    }

    return dB;
  }
}

// Usage
const fftProc = new FFTProcessor(2048);
const samples = new Float32Array(2048); // Your input data
const spectrum = fftProc.powerSpectrumDB(samples);
```

### 3. Custom Radix-2 Implementation

**For educational purposes or specific needs**:

```javascript
class SimpleFFT {
  constructor(size) {
    if ((size & (size - 1)) !== 0) {
      throw new Error("Size must be power of 2");
    }
    this.size = size;
    this.bitReversalTable = this.createBitReversalTable(size);
    this.twiddleFactors = this.createTwiddleFactors(size);
  }

  createBitReversalTable(size) {
    const bits = Math.log2(size);
    const table = new Uint32Array(size);

    for (let i = 0; i < size; i++) {
      let reversed = 0;
      for (let b = 0; b < bits; b++) {
        reversed = (reversed << 1) | ((i >> b) & 1);
      }
      table[i] = reversed;
    }

    return table;
  }

  createTwiddleFactors(size) {
    const factors = new Float32Array(size * 2); // Real and imag pairs

    for (let k = 0; k < size; k++) {
      const angle = (-2 * Math.PI * k) / size;
      factors[2 * k] = Math.cos(angle); // Real
      factors[2 * k + 1] = Math.sin(angle); // Imaginary
    }

    return factors;
  }

  transform(real, imag) {
    const size = this.size;

    // Bit-reversal permutation
    for (let i = 0; i < size; i++) {
      const j = this.bitReversalTable[i];
      if (j > i) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }

    // Cooley-Tukey FFT
    for (let len = 2; len <= size; len *= 2) {
      const halfLen = len / 2;
      const step = size / len;

      for (let i = 0; i < size; i += len) {
        for (let k = 0; k < halfLen; k++) {
          const twiddleIdx = k * step;
          const tReal = this.twiddleFactors[2 * twiddleIdx];
          const tImag = this.twiddleFactors[2 * twiddleIdx + 1];

          const evenIdx = i + k;
          const oddIdx = i + k + halfLen;

          const tRe = tReal * real[oddIdx] - tImag * imag[oddIdx];
          const tIm = tReal * imag[oddIdx] + tImag * real[oddIdx];

          real[oddIdx] = real[evenIdx] - tRe;
          imag[oddIdx] = imag[evenIdx] - tIm;
          real[evenIdx] = real[evenIdx] + tRe;
          imag[evenIdx] = imag[evenIdx] + tIm;
        }
      }
    }
  }

  powerSpectrum(realInput) {
    const real = new Float32Array(realInput);
    const imag = new Float32Array(this.size);

    this.transform(real, imag);

    const power = new Float32Array(this.size / 2);
    for (let i = 0; i < power.length; i++) {
      power[i] = real[i] * real[i] + imag[i] * imag[i];
    }

    return power;
  }
}
```

## Window Functions

### Why Windows?

**Problem**: FFT assumes periodic signal. Abrupt edges create spectral leakage.

**Solution**: Taper signal at edges using window function.

### Common Windows

#### Rectangular (No Window)

```javascript
function rectangularWindow(size) {
  return new Float32Array(size).fill(1);
}
```

- Best frequency resolution
- Worst spectral leakage
- Use: Transient signals only

#### Hann (Hanning)

```javascript
function hannWindow(size) {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}
```

- Good general purpose
- Moderate leakage and resolution
- **Recommended default**

#### Hamming

```javascript
function hammingWindow(size) {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
  }
  return window;
}
```

- Similar to Hann
- Slightly better sidelobe rejection

#### Blackman

```javascript
function blackmanWindow(size) {
  const window = new Float32Array(size);
  const a0 = 0.42,
    a1 = 0.5,
    a2 = 0.08;

  for (let i = 0; i < size; i++) {
    const x = i / (size - 1);
    window[i] =
      a0 - a1 * Math.cos(2 * Math.PI * x) + a2 * Math.cos(4 * Math.PI * x);
  }
  return window;
}
```

- Excellent sidelobe rejection
- Wider main lobe (less resolution)
- Use: High dynamic range needed

#### Flat-Top

```javascript
function flatTopWindow(size) {
  const window = new Float32Array(size);
  const a0 = 1,
    a1 = 1.93,
    a2 = 1.29,
    a3 = 0.388,
    a4 = 0.028;

  for (let i = 0; i < size; i++) {
    const x = (2 * Math.PI * i) / (size - 1);
    window[i] =
      a0 -
      a1 * Math.cos(x) +
      a2 * Math.cos(2 * x) -
      a3 * Math.cos(3 * x) +
      a4 * Math.cos(4 * x);
  }

  // Normalize
  const max = Math.max(...window);
  for (let i = 0; i < size; i++) {
    window[i] /= max;
  }

  return window;
}
```

- Accurate amplitude measurement
- Poor frequency resolution
- Use: Precise signal measurement

### Applying Windows

```javascript
function applyWindow(samples, window) {
  const windowed = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    windowed[i] = samples[i] * window[i];
  }
  return windowed;
}

// Usage
const window = hannWindow(fftSize);
const windowed = applyWindow(rawSamples, window);
const spectrum = computeFFT(windowed);
```

## Optimizations

### Pre-compute Windows

```javascript
class WindowCache {
  constructor() {
    this.cache = new Map();
  }

  get(type, size) {
    const key = `${type}-${size}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, this.generate(type, size));
    }
    return this.cache.get(key);
  }

  generate(type, size) {
    switch (type) {
      case "hann":
        return hannWindow(size);
      case "hamming":
        return hammingWindow(size);
      case "blackman":
        return blackmanWindow(size);
      default:
        return rectangularWindow(size);
    }
  }
}

const windowCache = new WindowCache();
const window = windowCache.get("hann", 2048);
```

### Overlap-Add Processing

**For continuous streams**:

```javascript
class OverlapFFT {
  constructor(fftSize, overlapFactor = 0.5) {
    this.fftSize = fftSize;
    this.hopSize = Math.floor(fftSize * (1 - overlapFactor));
    this.buffer = new Float32Array(fftSize);
    this.position = 0;
    this.fft = new FFTProcessor(fftSize);
  }

  process(newSamples) {
    const results = [];

    for (const sample of newSamples) {
      this.buffer[this.position++] = sample;

      if (this.position >= this.fftSize) {
        // Process full buffer
        results.push(this.fft.process(this.buffer));

        // Shift buffer
        this.buffer.copyWithin(0, this.hopSize);
        this.position -= this.hopSize;
      }
    }

    return results;
  }
}
```

### Zero-Padding

**Increase FFT size for interpolation**:

```javascript
function zeroPad(samples, targetSize) {
  if (samples.length >= targetSize) return samples;

  const padded = new Float32Array(targetSize);
  padded.set(samples);
  // Rest are zeros

  return padded;
}

// Example: 1024 samples → 4096 FFT (4× interpolation)
const padded = zeroPad(samples, 4096);
const spectrum = computeFFT(padded);
```

## Frequency Mapping

### Bin to Frequency

```javascript
function binToFrequency(bin, sampleRate, fftSize) {
  return (bin * sampleRate) / fftSize;
}
```

### Frequency to Bin

```javascript
function frequencyToBin(frequency, sampleRate, fftSize) {
  return Math.round((frequency * fftSize) / sampleRate);
}
```

### FFT Shift (Center DC)

```javascript
function fftShift(spectrum) {
  const half = Math.floor(spectrum.length / 2);
  const shifted = new Float32Array(spectrum.length);

  // Move second half to beginning
  shifted.set(spectrum.subarray(half), 0);
  // Move first half to end
  shifted.set(spectrum.subarray(0, half), spectrum.length - half);

  return shifted;
}
```

## Spectrum Processing

### Averaging

**Exponential moving average** (smooth display):

```javascript
class SpectrumAverager {
  constructor(size, alpha = 0.1) {
    this.size = size;
    this.alpha = alpha;
    this.average = new Float32Array(size);
    this.initialized = false;
  }

  update(newSpectrum) {
    if (!this.initialized) {
      this.average.set(newSpectrum);
      this.initialized = true;
    } else {
      for (let i = 0; i < this.size; i++) {
        this.average[i] =
          this.alpha * newSpectrum[i] + (1 - this.alpha) * this.average[i];
      }
    }

    return this.average;
  }
}
```

### Peak Hold

```javascript
class PeakHold {
  constructor(size, decayRate = 0.01) {
    this.peaks = new Float32Array(size).fill(-Infinity);
    this.decayRate = decayRate;
  }

  update(spectrum) {
    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] > this.peaks[i]) {
        this.peaks[i] = spectrum[i];
      } else {
        this.peaks[i] -= this.decayRate;
      }
    }

    return this.peaks;
  }

  reset() {
    this.peaks.fill(-Infinity);
  }
}
```

## Complete Example

```javascript
class SDRSpectrum {
  constructor(fftSize, sampleRate) {
    this.fftSize = fftSize;
    this.sampleRate = sampleRate;
    this.fft = new FFTProcessor(fftSize);
    this.averager = new SpectrumAverager(fftSize / 2, 0.2);
    this.peakHold = new PeakHold(fftSize / 2);
  }

  process(samples) {
    // Compute spectrum
    const rawSpectrum = this.fft.powerSpectrumDB(samples);

    // Apply averaging
    const smoothSpectrum = this.averager.update(rawSpectrum);

    // Track peaks
    const peaks = this.peakHold.update(rawSpectrum);

    return {
      spectrum: smoothSpectrum,
      peaks: peaks,
      resolution: this.sampleRate / this.fftSize,
      bins: rawSpectrum.length,
    };
  }

  getBinFrequency(bin) {
    return binToFrequency(bin, this.sampleRate, this.fftSize);
  }
}

// Usage
const spectrum = new SDRSpectrum(4096, 2048000);
const result = spectrum.process(iqSamples);
console.log(`Resolution: ${result.resolution} Hz/bin`);
```

## Performance Tips

1. **Use power-of-2 sizes**: Much faster
2. **Pre-compute windows**: Don't recreate each time
3. **Reuse buffers**: Avoid allocation in hot path
4. **Use Web Workers**: Keep UI responsive
5. **Consider WebGL**: For large FFT sizes (8192+)
6. **Profile**: Measure before optimizing

## WebGPU Acceleration

For large FFT sizes (4096+), rad.io implements GPU-accelerated FFT using WebGPU compute shaders, achieving 5-15x speedup compared to WASM. This is critical for maintaining 60 FPS spectrum rendering at high resolutions.

**See**: [WebGPU FFT Implementation](./webgpu-fft-implementation.md) for detailed documentation.

**Key Features**:
- Cooley-Tukey radix-2 algorithm with compute shaders
- Multi-pass pipeline with ping-pong buffers
- 8-15x speedup for FFT 4096+ vs WASM
- Automatic fallback to WASM when WebGPU unavailable
- Browser support: Chrome 113+, Edge 113+, Safari 18+ (85%+ coverage)

**Usage**:
```javascript
import { WebGPUFFT } from './utils/webgpuCompute';

const fft = new WebGPUFFT();
await fft.initialize(4096);
const spectrum = await fft.compute(iSamples, qSamples);
```

## Resources

- **fft.js**: GitHub.com/indutny/fft.js
- **dsp.js**: GitHub.com/corbanbrook/dsp.js
- **Understanding DSP**: dspguide.com
- **FFT Tutorial**: jakevdp.GitHub.io/blog/2013/08/28/understanding-the-fft/
- **WebGPU FFT**: See [webgpu-fft-implementation.md](./webgpu-fft-implementation.md)
