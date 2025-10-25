# Extended Audio & DSP Research Citations

Additional academic and technical citations supplementing REFERENCE_DOCS_RESEARCH_CITATIONS.

## Automatic Gain Control (AGC)

**Academic & Technical Sources:**
- GNU Radio AGC3 implementation (wiki.gnuradio.org/index.php/AGC3) - Fast linear acquisition + IIR-based tracking
- TI Engineering: "AGC- Automatic Gain Control" (e2e.ti.com) - Programmable attack/decay rates, parameter tuning
- Shure DSP: AGC in DFR22, P4800, DP11EQ (service.shure.com) - Commercial AGC implementations, noise floor pumping prevention
- Stack Overflow: Attack and Release times discussion (electronics.stackexchange.com/questions/269223)

**Key Algorithms:**
```
if (signal_level > reference):
    gain -= attack_rate * (signal_level - reference)
else:
    gain += decay_rate * (reference - signal_level)
```

**Trade-offs:**
- Fast attack: Prevents overload, may cause artifacts
- Slow decay: Smoother audio, slower adaptation
- Balance: Attack=0.01, Decay=0.1 (10ms/100ms) typical for voice

**Implementation:** src/lib/audio/audio-pipeline.ts, src/workers/audio-worklet.js

---

## Nyquist Theorem & Aliasing Prevention

**Academic Sources:**
- Wikipedia: "Nyquist–Shannon sampling theorem" (en.wikipedia.org)
- GeeksforGeeks: Nyquist Sampling Theorem tutorial
- ICO Optics: "Sampling Theory and Aliasing in SDRs" (ico-optics.org)
- LearnSDR: "Lesson 6 — Sampling" (gallicchio.github.io/learnSDR/lesson06.html)
- TI: "Why Use Oversampling when Undersampling Can Do the Job?" (ti.com/lit/an/slaa594a)

**Core Principle:**
- Sampling rate ≥ 2 × highest frequency (Nyquist rate)
- Alias prevention: Anti-aliasing filter before ADC
- Browser SDR optimal rate: 2.048 MSPS (balance CPU/quality)

**Practical SDR Application:**
- 20 MHz bandwidth → 40 MSPS minimum sample rate
- rad.io uses 2.048 MSPS for browser efficiency (±1 MHz bandwidth)
- HackRF supports up to 20 MSPS (configurable)

**Anti-Aliasing:**
- Analog low-pass filter before ADC
- Digital decimation filter after ADC
- src/lib/audio/sample-rate-converter.ts

---

## AudioWorklet & Low-Latency Processing

**Official Documentation:**
- MDN: AudioWorklet API (developer.mozilla.org/docs/Web/API/AudioWorklet)
- MDN: AudioWorkletProcessor interface
- W3C: Web Audio API specification (w3.org/TR/webaudio/)

**Technical Deep Dives:**
- PeerDH: "Understanding AudioWorklet: Deep Dive" (peerdh.com/blogs/programming-insights)
- GitHub: Real-Time Audio Worklet Recorder (github.com/alyssonbarrera/audio-worklet-recorder)
- Stack Overflow: AudioWorkletProcessor for scheduling (stackoverflow.com/questions/62505257)

**WebAssembly Integration:**
- Emscripten: Wasm Audio Worklets API (emscripten.org/docs/api_reference/wasm_audio_worklets.html)
- Enables C/C++ DSP code in AudioWorklet
- Eliminates JavaScript GC pauses

**Performance Characteristics:**
- Latency: <5ms typical (128 samples @ 48kHz = 2.67ms)
- Runs on dedicated audio rendering thread
- Message passing via MessagePort
- Browser support: Chrome 66+, Firefox 76+, Safari 14.1+

**rad.io Implementation:**
- src/workers/audio-worklet.js - Demodulation processing
- Supports AM, FM, SSB, CW modes
- Real-time AGC, squelch, noise blanking

---

## Sample Rate Conversion & Decimation

**Academic Theory:**
- Stanford CCRMA: "Sample Rate Conversion" (ccrma.stanford.edu/~jos/resample/)
- Julius O. Smith III: "Digital Audio Resampling Home Page"

**Practical Implementation:**
- ICO Optics: Quadrature sampling and I/Q demodulation
- Decimation: Filter + downsample
- Interpolation: Upsample + filter

**rad.io Pipeline:**
- Input: 2.048 MSPS (SDR device)
- Decimation: ~42:1 ratio
- Output: 48 kHz (audio)
- Filter: FIR low-pass, Hamming window
- src/lib/audio/sample-rate-converter.ts

**Polyphase Decimation:**
- Efficient FIR filtering + downsampling
- Avoids computing samples that are discarded
- Used in high-performance implementations

---

## De-emphasis Filtering (FM)

**Standards:**
- North America: 75 µs time constant
- Europe/Asia: 50 µs time constant
- Formula: α = 1 - exp(-1/(fs × τ))

**Implementation:**
- Single-pole IIR filter: y[n] = y[n-1] + α·(x[n] - y[n-1])
- Reverses pre-emphasis applied at transmitter
- Reduces high-frequency noise

**Code Location:**
- src/workers/audio-worklet.js - FM demodulator
- Configurable via enableDeEmphasis option

---

## Browser Performance Optimization

**Typed Arrays:**
- Float32Array for DSP (single precision adequate)
- Int8Array/Uint8Array for SDR samples
- Zero-copy transfers with Transferable objects

**Web Workers:**
- Offload DSP to background threads
- Main thread: UI, visualization
- Workers: FFT, demodulation, filtering
- Message passing overhead: ~1-2ms

**WebGL/WebGPU:**
- GPU acceleration for visualizations
- Texture streaming for waterfall
- Shader-based rendering
- 60 FPS at 8192 FFT bins

**Memory Management:**
- Pre-allocate buffers
- Buffer pools to minimize GC
- Clear references when done
- Monitor with Chrome DevTools

**Code Organization:**
- src/workers/fft-worker.ts - FFT processing
- src/workers/audio-worklet.js - Audio demodulation
- src/components/Spectrogram.tsx - WebGL visualization

---

## Signal Processing Libraries

**fft.js:**
- Fastest pure JavaScript FFT
- 47,511 ops/sec @ 2048 points (Mozilla Kraken)
- Radix-2 Cooley-Tukey algorithm
- github.com/indutny/fft.js

**dsp.js:**
- Comprehensive DSP toolkit
- FFT, filters, windowing, oscillators
- Modernized fork in rad.io
- src/utils/dsp.ts

**Web Audio API:**
- Built-in AnalyserNode for FFT
- AudioWorklet for custom processing
- BiquadFilter for filtering
- Hardware-accelerated

---

## Testing & Validation

**Signal Generators:**
- src/utils/signalGenerator.ts
- Test signals: sine, CW, AM, FM, noise
- Validation of demodulation algorithms

**Performance Testing:**
- Chrome DevTools Performance profiler
- Measure FFT latency (<5ms target)
- Monitor frame rate (60 FPS target)
- Memory leak detection

**Test Coverage:**
- Vitest for unit tests
- Playwright for E2E tests
- Memory: TEST_COVERAGE_ENFORCEMENT
- Memory: E2E_SPEECH_TEST_SUITE

---

## Future Research Directions

**Priority Topics:**
1. WebGPU compute shaders for GPU-side FFT
2. WebAssembly SIMD for parallel DSP
3. Machine learning for automatic modulation classification
4. Phase-locked loops (PLL) for carrier recovery
5. Digital mode decoders (PSK31, FT8, RTTY)

**Academic Databases:**
- IEEE Xplore: Signal processing, wireless communications
- ACM Digital Library: Web technologies, performance
- ScienceDirect: DSP algorithms, SDR architectures
- arXiv: Preprints on signal processing, ML

**Search Terms:**
- "browser-based software defined radio"
- "WebAssembly DSP performance"
- "automatic modulation classification"
- "phase-locked loop digital implementation"
- "GPU-accelerated FFT WebGL"

---

## Cross-References

**Documentation:**
- docs/reference/dsp-fundamentals.md - DSP theory
- docs/reference/audio-demodulation-pipeline.md - Audio architecture
- docs/reference/fft-implementation.md - FFT algorithms
- docs/reference/performance-optimization.md - Optimization guide

**Memories:**
- AUDIO_PLAYBACK_IMPLEMENTATION - Complete audio system
- SDR_DSP_FOUNDATIONS - IQ, mixing, decimation
- DEMODULATION_BASICS_FM_AM - FM/AM algorithms
- FFT_WIDEBAND_SCANNING_IMPLEMENTATION - Parallel FFT
- REFERENCE_DOCS_RESEARCH_CITATIONS - Primary citations

**Code:**
- src/lib/audio/ - Audio pipeline
- src/utils/dsp.ts - DSP utilities
- src/workers/ - Background processing
- src/components/ - Visualizations

---

## Citation Style

All citations follow format:
- Title - Brief description
- URL or DOI
- Key findings or metrics
- Cross-references to code/docs/memories

Update frequency: Quarterly review of links, annual citation refresh
