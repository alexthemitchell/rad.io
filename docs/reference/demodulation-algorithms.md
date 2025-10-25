# Demodulation Algorithms

## Overview

Demodulation extracts information from modulated carrier signals. This guide covers practical implementation of common demodulation algorithms for browser-based SDR.

## Prerequisites

All demodulators assume:

- **Input**: I/Q samples (complex baseband)
- **Sample rate**: Known and constant
- **Center frequency**: Signal already centered at 0 Hz

## AM (Amplitude Modulation)

### Envelope Detection

**Principle**: Audio is the magnitude of complex signal.

**Implementation**:

```javascript
function demodulateAM(iSamples, qSamples) {
  const audio = new Float32Array(iSamples.length);

  for (let i = 0; i < iSamples.length; i++) {
    // Magnitude = √(I² + Q²)
    audio[i] = Math.sqrt(iSamples[i] * iSamples[i] + qSamples[i] * qSamples[i]);
  }

  return audio;
}
```

**Optimization** (avoid sqrt):

```javascript
function demodulateAM_Fast(iSamples, qSamples) {
  const audio = new Float32Array(iSamples.length);

  for (let i = 0; i < iSamples.length; i++) {
    const I = iSamples[i];
    const Q = qSamples[i];

    // Fast approximation: max(|I|, |Q|) + 0.4*min(|I|, |Q|)
    const absI = Math.abs(I);
    const absQ = Math.abs(Q);
    const maxVal = Math.max(absI, absQ);
    const minVal = Math.min(absI, absQ);

    audio[i] = maxVal + 0.4 * minVal;
  }

  return audio;
}
```

**Post-processing**:

```javascript
// Remove DC component
function removeDC(audio) {
  let sum = 0;
  for (const sample of audio) sum += sample;
  const dc = sum / audio.length;

  for (let i = 0; i < audio.length; i++) {
    audio[i] -= dc;
  }

  return audio;
}

// Complete AM demodulator
const rawAudio = demodulateAM(I, Q);
const audio = removeDC(rawAudio);
```

## FM (Frequency Modulation)

### Phase Discriminator

**Principle**: Frequency is rate of phase change.

**Implementation**:

```javascript
function demodulateFM(iSamples, qSamples) {
  const audio = new Float32Array(iSamples.length - 1);

  for (let i = 1; i < iSamples.length; i++) {
    // Current sample
    const I1 = iSamples[i];
    const Q1 = qSamples[i];

    // Previous sample
    const I0 = iSamples[i - 1];
    const Q0 = qSamples[i - 1];

    // Conjugate multiplication: Z1 * conj(Z0)
    // (I1 + jQ1) * (I0 - jQ0)
    const diffI = I1 * I0 + Q1 * Q0;
    const diffQ = Q1 * I0 - I1 * Q0;

    // Phase difference (instantaneous frequency)
    audio[i - 1] = Math.atan2(diffQ, diffI);
  }

  return audio;
}
```

**With de-emphasis filter** (75 µs for broadcast FM):

```javascript
class FMDemodulator {
  constructor(sampleRate, deviation = 75000) {
    this.sampleRate = sampleRate;
    this.deviation = deviation;

    // De-emphasis filter (75 µs time constant)
    const tau = 75e-6;
    this.alpha = 1 - Math.exp(-1 / (tau * sampleRate));
    this.lastOutput = 0;
  }

  process(iSamples, qSamples) {
    const audio = new Float32Array(iSamples.length - 1);

    for (let i = 1; i < iSamples.length; i++) {
      const I1 = iSamples[i];
      const Q1 = qSamples[i];
      const I0 = iSamples[i - 1];
      const Q0 = qSamples[i - 1];

      const diffI = I1 * I0 + Q1 * Q0;
      const diffQ = Q1 * I0 - I1 * Q0;

      let sample = Math.atan2(diffQ, diffI);

      // Scale to audio range
      sample = ((sample / Math.PI) * this.deviation) / this.sampleRate;

      // De-emphasis
      this.lastOutput += this.alpha * (sample - this.lastOutput);
      audio[i - 1] = this.lastOutput;
    }

    return audio;
  }
}
```

### Polar Discriminator (Alternative)

```javascript
function demodulateFM_Polar(iSamples, qSamples) {
  const audio = new Float32Array(iSamples.length - 1);
  let lastPhase = Math.atan2(qSamples[0], iSamples[0]);

  for (let i = 1; i < iSamples.length; i++) {
    const phase = Math.atan2(qSamples[i], iSamples[i]);
    let diff = phase - lastPhase;

    // Unwrap phase (handle -π to π wrapping)
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    audio[i - 1] = diff;
    lastPhase = phase;
  }

  return audio;
}
```

## SSB (Single Sideband)

### Product Detector

**Principle**: Mix with BFO (Beat Frequency Oscillator) to shift signal to audio.

**Implementation**:

```javascript
class SSBDemodulator {
  constructor(sampleRate, bfoFreq = 0) {
    this.sampleRate = sampleRate;
    this.bfoFreq = bfoFreq;
    this.phase = 0;
  }

  setBFO(frequency) {
    this.bfoFreq = frequency;
  }

  process(iSamples, qSamples) {
    const audio = new Float32Array(iSamples.length);
    const phaseIncrement = (2 * Math.PI * this.bfoFreq) / this.sampleRate;

    for (let i = 0; i < iSamples.length; i++) {
      // Generate BFO signal
      const bfoI = Math.cos(this.phase);
      const bfoQ = Math.sin(this.phase);

      // Complex multiply: (I + jQ) * (bfoI + j*bfoQ)
      const outI = iSamples[i] * bfoI - qSamples[i] * bfoQ;
      const outQ = iSamples[i] * bfoQ + qSamples[i] * bfoI;

      // Take real part for audio
      audio[i] = outI;

      // Advance phase
      this.phase += phaseIncrement;
      if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
    }

    return audio;
  }
}

// Usage
const ssb = new SSBDemodulator(48000, 0); // 0 Hz for centered signal
const audio = ssb.process(I, Q);
// Then apply low-pass filter at ~3 kHz
```

### Hilbert Transform Method

**For USB/LSB selection**:

```javascript
function demodulateUSB(iSamples, qSamples) {
  // Upper sideband: I + Q
  const audio = new Float32Array(iSamples.length);
  for (let i = 0; i < iSamples.length; i++) {
    audio[i] = iSamples[i] + qSamples[i];
  }
  return audio;
}

function demodulateLSB(iSamples, qSamples) {
  // Lower sideband: I - Q
  const audio = new Float32Array(iSamples.length);
  for (let i = 0; i < iSamples.length; i++) {
    audio[i] = iSamples[i] - qSamples[i];
  }
  return audio;
}
```

## CW (Morse Code)

### BFO with Bandpass Filter

```javascript
class CWDemodulator {
  constructor(sampleRate, pitch = 700) {
    this.sampleRate = sampleRate;
    this.pitch = pitch;
    this.phase = 0;

    // Narrow bandpass filter around pitch
    this.filter = new BandpassFilter(sampleRate, pitch, 50);
  }

  process(iSamples, qSamples) {
    // Mix with BFO
    const audio = new Float32Array(iSamples.length);
    const phaseIncrement = (2 * Math.PI * this.pitch) / this.sampleRate;

    for (let i = 0; i < iSamples.length; i++) {
      const bfoI = Math.cos(this.phase);
      const bfoQ = Math.sin(this.phase);

      audio[i] = iSamples[i] * bfoI - qSamples[i] * bfoQ;

      this.phase += phaseIncrement;
      if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
    }

    // Apply narrow filter
    return this.filter.process(audio);
  }
}
```

## FSK (Frequency Shift Keying)

### Dual Tone Detection (RTTY, Packet)

```javascript
class FSKDemodulator {
  constructor(sampleRate, markFreq, spaceFreq) {
    this.sampleRate = sampleRate;
    this.markFreq = markFreq;
    this.spaceFreq = spaceFreq;

    // Goertzel filters for mark and space
    this.markDetector = new GoertzelDetector(sampleRate, markFreq);
    this.spaceDetector = new GoertzelDetector(sampleRate, spaceFreq);
  }

  process(audio, samplesPerBit) {
    const bits = [];

    for (let i = 0; i < audio.length; i += samplesPerBit) {
      const segment = audio.slice(i, i + samplesPerBit);

      const markPower = this.markDetector.detect(segment);
      const spacePower = this.spaceDetector.detect(segment);

      bits.push(markPower > spacePower ? 1 : 0);
    }

    return bits;
  }
}

// Goertzel algorithm for single frequency detection
class GoertzelDetector {
  constructor(sampleRate, targetFreq) {
    const k = Math.round(0.5 + (targetFreq * samplesPerBit) / sampleRate);
    const omega = (2 * Math.PI * k) / samplesPerBit;
    this.coeff = 2 * Math.cos(omega);
  }

  detect(samples) {
    let s1 = 0,
      s2 = 0;

    for (const sample of samples) {
      const s0 = sample + this.coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }

    // Power at target frequency
    return s1 * s1 + s2 * s2 - this.coeff * s1 * s2;
  }
}
```

## PSK (Phase Shift Keying)

### BPSK Demodulator

```javascript
class BPSKDemodulator {
  constructor(sampleRate, baudRate) {
    this.sampleRate = sampleRate;
    this.baudRate = baudRate;
    this.samplesPerSymbol = Math.floor(sampleRate / baudRate);

    // Costas loop for carrier recovery
    this.costasLoop = new CostasLoop(sampleRate, baudRate);
  }

  process(iSamples, qSamples) {
    const symbols = [];

    // Carrier recovery
    const { I: correctedI, Q: correctedQ } = this.costasLoop.process(
      iSamples,
      qSamples,
    );

    // Symbol sampling
    for (let i = 0; i < correctedI.length; i += this.samplesPerSymbol) {
      const symbol = correctedI[i]; // BPSK uses only I channel
      symbols.push(symbol > 0 ? 1 : 0);
    }

    return symbols;
  }
}

// Simplified Costas loop for carrier recovery
class CostasLoop {
  constructor(sampleRate, symbolRate) {
    this.sampleRate = sampleRate;
    this.phase = 0;
    this.frequency = 0;

    // Loop gains
    this.loopBW = symbolRate * 0.01;
    const damp = 0.707; // Damping factor
    const theta = this.loopBW / sampleRate;
    const denom = 1 + 2 * damp * theta + theta * theta;
    this.alpha = (4 * damp * theta) / denom;
    this.beta = (4 * theta * theta) / denom;
  }

  process(iSamples, qSamples) {
    const I = new Float32Array(iSamples.length);
    const Q = new Float32Array(qSamples.length);

    for (let i = 0; i < iSamples.length; i++) {
      // Rotate by current phase estimate
      const cos = Math.cos(-this.phase);
      const sin = Math.sin(-this.phase);

      I[i] = iSamples[i] * cos - qSamples[i] * sin;
      Q[i] = iSamples[i] * sin + qSamples[i] * cos;

      // Phase error (for BPSK: sign(I) * Q)
      const error = Math.sign(I[i]) * Q[i];

      // Update frequency and phase
      this.frequency += this.beta * error;
      this.phase += this.frequency + this.alpha * error;

      // Wrap phase
      while (this.phase > Math.PI) this.phase -= 2 * Math.PI;
      while (this.phase < -Math.PI) this.phase += 2 * Math.PI;
    }

    return { I, Q };
  }
}
```

### QPSK Demodulator

```javascript
class QPSKDemodulator extends BPSKDemodulator {
  process(iSamples, qSamples) {
    const bits = [];

    // Carrier recovery
    const { I: correctedI, Q: correctedQ } = this.costasLoop.process(
      iSamples,
      qSamples,
    );

    // Symbol sampling
    for (let i = 0; i < correctedI.length; i += this.samplesPerSymbol) {
      const I = correctedI[i];
      const Q = correctedQ[i];

      // QPSK: 2 bits per symbol
      bits.push(I > 0 ? 1 : 0); // MSB from I
      bits.push(Q > 0 ? 1 : 0); // LSB from Q
    }

    return bits;
  }
}
```

## AGC (Automatic Gain Control)

**Apply to demodulated audio**:

```javascript
class AGC {
  constructor(attackTime, decayTime, sampleRate, targetLevel = 0.5) {
    this.targetLevel = targetLevel;
    this.envelope = 0;
    this.gain = 1;

    this.attackRate = 1 - Math.exp(-1 / (attackTime * sampleRate));
    this.decayRate = 1 - Math.exp(-1 / (decayTime * sampleRate));
  }

  process(audio) {
    const output = new Float32Array(audio.length);

    for (let i = 0; i < audio.length; i++) {
      const input = audio[i];
      const absVal = Math.abs(input);

      // Envelope follower
      if (absVal > this.envelope) {
        this.envelope += this.attackRate * (absVal - this.envelope);
      } else {
        this.envelope += this.decayRate * (absVal - this.envelope);
      }

      // Calculate gain
      if (this.envelope > 0.001) {
        this.gain = this.targetLevel / this.envelope;
      }

      // Limit gain range
      this.gain = Math.max(0.1, Math.min(10, this.gain));

      output[i] = input * this.gain;
    }

    return output;
  }
}

// Usage
const agc = new AGC(0.01, 0.1, 48000); // 10ms attack, 100ms decay
const audio = demodulateSSB(I, Q);
const audioWithAGC = agc.process(audio);
```

## Squelch

**Silence output when signal too weak**:

```javascript
class Squelch {
  constructor(threshold = 0.01, hysteresis = 0.005) {
    this.threshold = threshold;
    this.hysteresis = hysteresis;
    this.isOpen = false;
  }

  process(iSamples, qSamples, audio) {
    // Calculate signal strength
    let power = 0;
    for (let i = 0; i < iSamples.length; i++) {
      power += iSamples[i] * iSamples[i] + qSamples[i] * qSamples[i];
    }
    power /= iSamples.length;
    const strength = Math.sqrt(power);

    // Hysteresis logic
    if (this.isOpen) {
      if (strength < this.threshold - this.hysteresis) {
        this.isOpen = false;
      }
    } else {
      if (strength > this.threshold + this.hysteresis) {
        this.isOpen = true;
      }
    }

    // Apply squelch
    if (!this.isOpen) {
      audio.fill(0);
    }

    return audio;
  }
}
```

## Complete Receiver Example

```javascript
class SDRReceiver {
  constructor(mode, sampleRate) {
    this.mode = mode;
    this.sampleRate = sampleRate;
    this.agc = new AGC(0.01, 0.1, sampleRate);
    this.squelch = new Squelch(0.01);

    // Select demodulator
    switch (mode) {
      case "AM":
        this.demod = (I, Q) => demodulateAM(I, Q);
        break;
      case "FM":
        this.demod = new FMDemodulator(sampleRate);
        break;
      case "USB":
      case "LSB":
        this.demod = new SSBDemodulator(sampleRate, 0);
        break;
      case "CW":
        this.demod = new CWDemodulator(sampleRate, 700);
        break;
    }
  }

  process(iSamples, qSamples) {
    // Demodulate
    let audio = this.demod.process
      ? this.demod.process(iSamples, qSamples)
      : this.demod(iSamples, qSamples);

    // Apply squelch
    audio = this.squelch.process(iSamples, qSamples, audio);

    // Apply AGC
    audio = this.agc.process(audio);

    return audio;
  }
}

// Usage
const receiver = new SDRReceiver("USB", 48000);
const audioOutput = receiver.process(iqData.I, iqData.Q);
```

## Performance Optimization

1. **Use typed arrays**: Float32Array for all buffers
2. **Pre-allocate**: Reuse buffers, don't create in loop
3. **Batch process**: Process larger chunks less frequently
4. **Web Workers**: Offload to background thread
5. **SIMD**: Use WebAssembly for parallel operations

## Testing

```javascript
// Generate test signal
function generateAMSignal(audioFreq, carrierFreq, sampleRate, duration) {
  const samples = Math.floor(duration * sampleRate);
  const I = new Float32Array(samples);
  const Q = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const audio = Math.sin(2 * Math.PI * audioFreq * t);
    const carrier = 2 * Math.PI * carrierFreq * t;
    const modulated = 1 + 0.5 * audio; // 50% modulation

    I[i] = modulated * Math.cos(carrier);
    Q[i] = modulated * Math.sin(carrier);
  }

  return { I, Q };
}

// Test demodulator
const { I, Q } = generateAMSignal(1000, 0, 48000, 1.0);
const audio = demodulateAM(I, Q);
// Verify 1 kHz tone in audio
```

## Resources

- **SDR tutorials**: www.trondeau.com
- **GNU Radio**: gnuradio.org (reference implementations)
- **DSP StackExchange**: dsp.stackexchange.com
- **Liquid DSP**: liquidsdr.org
