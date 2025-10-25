# DSP Fundamentals

## Overview

Digital Signal Processing (DSP) is the mathematical manipulation of signals to extract information, improve quality, or prepare for further processing. This guide covers essential DSP concepts for SDR development.

## Core Concepts

### Sampling

**Definition**: Converting continuous analog signals to discrete digital samples.

**Nyquist Theorem**: Sample rate must be at least 2× the highest frequency component.

```
fs ≥ 2 × fmax
```

**Example**: To capture 10 MHz bandwidth, sample rate ≥ 20 MS/s

**Aliasing**: When sampling below Nyquist rate, high frequencies appear as false low frequencies.

**Implementation**:

```javascript
// In browser, receive samples from SDR hardware or API
// Samples typically arrive as I/Q pairs (complex samples)
const samples = new Float32Array(bufferSize * 2); // I and Q interleaved
```

### Complex Numbers and I/Q Data

**Why Complex**: Radio signals have amplitude AND phase information.

**I/Q Representation**:

- **I (In-phase)**: Real component, 0° reference
- **Q (Quadrature)**: Imaginary component, 90° phase shift
- Together: Fully describes signal amplitude and phase

**Complex Sample**: `z = I + jQ`

**Magnitude**: `|z| = √(I² + Q²)`

**Phase**: `φ = atan2(Q, I)`

**JavaScript**:

```javascript
function magnitude(i, q) {
  return Math.sqrt(i * i + q * q);
}

function phase(i, q) {
  return Math.atan2(q, i);
}
```

**Advantages**:

- No image frequency problem
- Easier filtering
- Direct frequency information
- Simpler demodulation

### Frequency Domain vs Time Domain

**Time Domain**: Signal amplitude over time (oscilloscope view)

- Good for: Timing, pulse detection, modulation visualization

**Frequency Domain**: Signal power at each frequency (spectrum view)

- Good for: Finding signals, measuring bandwidth, identifying interference

**Conversion**: FFT (Fast Fourier Transform)

## Fast Fourier Transform (FFT)

### Purpose

Convert time-domain samples to frequency-domain spectrum.

### Theory

Decomposes signal into sum of sinusoids at different frequencies.

**DFT Formula**:

```
X[k] = Σ(n=0 to N-1) x[n] × e^(-j2πkn/N)
```

Where:

- x[n] = time domain samples
- X[k] = frequency domain bins
- N = number of samples (FFT size)
- k = frequency bin index

### FFT Size Selection

**Common sizes**: 256, 512, 1024, 2048, 4096, 8192 (powers of 2 for efficiency)

**Trade-offs**:

| FFT Size | Frequency Resolution | Time Resolution | CPU Load |
| -------- | -------------------- | --------------- | -------- |
| 512      | Low                  | High            | Low      |
| 2048     | Medium               | Medium          | Medium   |
| 8192     | High                 | Low             | High     |

**Frequency Resolution**:

```
Δf = SampleRate / FFT_Size
```

**Example**: 2.048 MS/s ÷ 4096 = 500 Hz per bin

### Window Functions

**Problem**: FFT assumes periodic signal. Discontinuities at edges create spectral leakage.

**Solution**: Window functions that taper signal at edges.

**Common Windows**:

1. **Rectangular** (no window)
   - Best frequency resolution
   - Worst spectral leakage
   - Use: Transient signals

2. **Hann** (Hanning)
   - Good general purpose
   - Moderate leakage, resolution
   - Use: Most common choice
3. **Hamming**
   - Similar to Hann
   - Slightly better sidelobe rejection
4. **Blackman**
   - Excellent sidelobe rejection
   - Lower frequency resolution
   - Use: When dynamic range critical

5. **Kaiser**
   - Adjustable parameter
   - Optimal trade-off
   - Use: When you need control

**JavaScript Implementation**:

```javascript
function hannWindow(size) {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

function applyWindow(samples, window) {
  const windowed = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    windowed[i] = samples[i] * window[i];
  }
  return windowed;
}
```

### FFT in JavaScript

**Using Web Audio API** (for audio-rate signals):

```javascript
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;
const dataArray = new Float32Array(analyser.frequencyBinCount);
analyser.getFloatFrequencyData(dataArray); // Returns dB values
```

**Using External Libraries**:

- **fft.js**: Fast, pure JavaScript
- **dsp.js**: Comprehensive DSP library
- **jsfft**: Another FFT implementation

**Custom Implementation** (Cooley-Tukey):

```javascript
function fft(re, im) {
  const n = re.length;
  if (n <= 1) return;

  // Divide
  const evenRe = new Float32Array(n / 2);
  const evenIm = new Float32Array(n / 2);
  const oddRe = new Float32Array(n / 2);
  const oddIm = new Float32Array(n / 2);

  for (let i = 0; i < n / 2; i++) {
    evenRe[i] = re[2 * i];
    evenIm[i] = im[2 * i];
    oddRe[i] = re[2 * i + 1];
    oddIm[i] = im[2 * i + 1];
  }

  // Conquer
  fft(evenRe, evenIm);
  fft(oddRe, oddIm);

  // Combine
  for (let k = 0; k < n / 2; k++) {
    const angle = (-2 * Math.PI * k) / n;
    const twiddleRe = Math.cos(angle);
    const twiddleIm = Math.sin(angle);

    const tRe = twiddleRe * oddRe[k] - twiddleIm * oddIm[k];
    const tIm = twiddleRe * oddIm[k] + twiddleIm * oddRe[k];

    re[k] = evenRe[k] + tRe;
    im[k] = evenIm[k] + tIm;
    re[k + n / 2] = evenRe[k] - tRe;
    im[k + n / 2] = evenIm[k] - tIm;
  }
}
```

### Power Spectrum

Convert FFT output to power:

```javascript
function powerSpectrum(fftRe, fftIm) {
  const power = new Float32Array(fftRe.length);
  for (let i = 0; i < fftRe.length; i++) {
    power[i] = fftRe[i] * fftRe[i] + fftIm[i] * fftIm[i];
  }
  return power;
}
```

Convert to dB:

```javascript
function toDecibels(power, referenceLevel = 1.0) {
  const dB = new Float32Array(power.length);
  for (let i = 0; i < power.length; i++) {
    dB[i] = 10 * Math.log10(power[i] / referenceLevel);
  }
  return dB;
}
```

## Filtering

### Purpose

- Remove unwanted frequency components
- Reduce noise
- Select specific signals
- Prevent aliasing

### Filter Types

**By Frequency Response**:

1. **Low-pass**: Pass frequencies below cutoff
2. **High-pass**: Pass frequencies above cutoff
3. **Band-pass**: Pass frequencies in range
4. **Band-stop (notch)**: Block frequencies in range

**By Implementation**:

1. **FIR (Finite Impulse Response)**
   - Linear phase (no distortion)
   - Stable
   - More computationally expensive
   - Use: High quality audio, precise filtering

2. **IIR (Infinite Impulse Response)**
   - Efficient (less computation)
   - Can be unstable
   - Non-linear phase
   - Use: Real-time when CPU limited

### FIR Filter

**Convolution**:

```javascript
function firFilter(input, coefficients) {
  const output = new Float32Array(input.length);
  const filterLength = coefficients.length;

  for (let i = 0; i < input.length; i++) {
    let sum = 0;
    for (let j = 0; j < filterLength; j++) {
      if (i - j >= 0) {
        sum += input[i - j] * coefficients[j];
      }
    }
    output[i] = sum;
  }

  return output;
}
```

**Coefficient Generation** (simple low-pass):

```javascript
function generateLowPassFIR(cutoffFreq, sampleRate, length) {
  const coeffs = new Float32Array(length);
  const fc = cutoffFreq / sampleRate;
  const mid = (length - 1) / 2;

  for (let i = 0; i < length; i++) {
    const x = i - mid;
    if (x === 0) {
      coeffs[i] = 2 * fc;
    } else {
      coeffs[i] = Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
    }
    // Apply Hamming window
    coeffs[i] *= 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (length - 1));
  }

  // Normalize
  const sum = coeffs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < length; i++) {
    coeffs[i] /= sum;
  }

  return coeffs;
}
```

### IIR Filter

**Biquad Filter** (common building block):

```javascript
class BiquadFilter {
  constructor(b0, b1, b2, a1, a2) {
    this.b0 = b0;
    this.b1 = b1;
    this.b2 = b2;
    this.a1 = a1;
    this.a2 = a2;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  process(input) {
    const output =
      this.b0 * input +
      this.b1 * this.x1 +
      this.b2 * this.x2 -
      this.a1 * this.y1 -
      this.a2 * this.y2;

    this.x2 = this.x1;
    this.x1 = input;
    this.y2 = this.y1;
    this.y1 = output;

    return output;
  }
}
```

**Web Audio Biquad**:

```javascript
const filter = audioContext.createBiquadFilter();
filter.type = "lowpass";
filter.frequency.value = 1000; // Hz
filter.Q.value = 1.0;
```

## Decimation and Interpolation

### Decimation (Downsampling)

**Purpose**: Reduce sample rate to save processing/bandwidth.

**Process**:

1. Low-pass filter (anti-aliasing)
2. Keep every Nth sample

```javascript
function decimate(input, factor) {
  // First, low-pass filter at Fs/(2*factor)
  const filtered = lowPassFilter(input, sampleRate / (2 * factor));

  // Then downsample
  const output = new Float32Array(Math.floor(input.length / factor));
  for (let i = 0; i < output.length; i++) {
    output[i] = filtered[i * factor];
  }

  return output;
}
```

### Interpolation (Upsampling)

**Purpose**: Increase sample rate for processing or output.

**Process**:

1. Insert zeros between samples
2. Low-pass filter (reconstruction)

## Demodulation

### AM Demodulation

**Envelope Detection**:

```javascript
function demodulateAM(iSamples, qSamples) {
  const audio = new Float32Array(iSamples.length);
  for (let i = 0; i < iSamples.length; i++) {
    audio[i] = Math.sqrt(iSamples[i] ** 2 + qSamples[i] ** 2);
  }
  return audio;
}
```

### FM Demodulation

**Phase Discriminator**:

```javascript
function demodulateFM(iSamples, qSamples) {
  const audio = new Float32Array(iSamples.length - 1);

  for (let i = 1; i < iSamples.length; i++) {
    // Current and previous complex samples
    const i1 = iSamples[i],
      q1 = qSamples[i];
    const i0 = iSamples[i - 1],
      q0 = qSamples[i - 1];

    // Conjugate multiply: z1 * conj(z0)
    const diffI = i1 * i0 + q1 * q0;
    const diffQ = q1 * i0 - i1 * q0;

    // Phase difference (frequency)
    audio[i - 1] = Math.atan2(diffQ, diffI);
  }

  return audio;
}
```

### SSB Demodulation

**Product Detector** (mix with BFO):

```javascript
function demodulateSSB(iSamples, qSamples, bfoFreq, sampleRate) {
  const audio = new Float32Array(iSamples.length);

  for (let i = 0; i < iSamples.length; i++) {
    const t = i / sampleRate;
    const bfoI = Math.cos(2 * Math.PI * bfoFreq * t);
    const bfoQ = Math.sin(2 * Math.PI * bfoFreq * t);

    // Complex multiply and take real part
    audio[i] = iSamples[i] * bfoI - qSamples[i] * bfoQ;
  }

  // Low-pass filter to remove sum frequency
  return lowPassFilter(audio, 3000); // 3 kHz audio bandwidth
}
```

## AGC (Automatic Gain Control)

**Purpose**: Maintain constant output level despite varying input strength.

**Simple AGC**:

```javascript
class AGC {
  constructor(attackTime, decayTime, sampleRate) {
    this.attack = 1.0 - Math.exp(-1.0 / (attackTime * sampleRate));
    this.decay = 1.0 - Math.exp(-1.0 / (decayTime * sampleRate));
    this.envelope = 0.0;
    this.gain = 1.0;
  }

  process(sample, targetLevel = 0.5) {
    const absVal = Math.abs(sample);

    // Track envelope
    if (absVal > this.envelope) {
      this.envelope += this.attack * (absVal - this.envelope);
    } else {
      this.envelope += this.decay * (absVal - this.envelope);
    }

    // Calculate gain
    if (this.envelope > 0) {
      this.gain = targetLevel / this.envelope;
    }

    // Limit gain range
    this.gain = Math.min(Math.max(this.gain, 0.1), 10.0);

    return sample * this.gain;
  }
}
```

## Noise Reduction

### Moving Average

**Simple smoothing**:

```javascript
function movingAverage(signal, windowSize) {
  const output = new Float32Array(signal.length);
  let sum = 0;

  for (let i = 0; i < signal.length; i++) {
    sum += signal[i];
    if (i >= windowSize) {
      sum -= signal[i - windowSize];
      output[i] = sum / windowSize;
    } else {
      output[i] = sum / (i + 1);
    }
  }

  return output;
}
```

### Noise Blanker

**Remove impulse noise**:

```javascript
function noiseBlanker(signal, threshold) {
  const output = new Float32Array(signal.length);

  for (let i = 0; i < signal.length; i++) {
    if (Math.abs(signal[i]) > threshold) {
      // Interpolate from neighbors
      output[i] = i > 0 ? signal[i - 1] : 0;
    } else {
      output[i] = signal[i];
    }
  }

  return output;
}
```

## Performance Optimization

### Web Workers

**Offload DSP to background thread**:

```javascript
// main.js
const worker = new Worker("dsp-worker.js");
worker.postMessage({ samples: audioData, fftSize: 2048 });
worker.onmessage = (e) => {
  const spectrum = e.data.spectrum;
  updateDisplay(spectrum);
};

// dsp-worker.js
self.onmessage = (e) => {
  const { samples, fftSize } = e.data;
  const spectrum = computeFFT(samples, fftSize);
  self.postMessage({ spectrum });
};
```

### Typed Arrays

**Always use typed arrays for numerical data**:

- Float32Array for most DSP
- Float64Array when precision critical
- Int16Array for integer samples

### SIMD (Future)

**WebAssembly SIMD** for parallel processing of multiple samples.

## Testing and Validation

### Generate Test Signals

```javascript
function generateSinWave(freq, duration, sampleRate) {
  const samples = Math.floor(duration * sampleRate);
  const signal = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    signal[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }

  return signal;
}

function addNoise(signal, snrDB) {
  const signalPower = signal.reduce((sum, s) => sum + s * s, 0) / signal.length;
  const noisePower = signalPower / Math.pow(10, snrDB / 10);
  const noiseStd = Math.sqrt(noisePower);

  const noisy = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    noisy[i] = signal[i] + noiseStd * (Math.random() - 0.5) * 2;
  }

  return noisy;
}
```

## Resources

- **The Scientist and Engineer's Guide to Digital Signal Processing** (free online book)
- **dspguide.com**: Comprehensive DSP tutorial
- **GNU Radio**: Open source SDR framework (Python)
- **WebAudio API**: Browser-native audio DSP
