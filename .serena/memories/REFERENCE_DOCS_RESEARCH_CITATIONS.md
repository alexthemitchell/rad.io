# Reference Documentation Research Citations

Comprehensive academic and technical citations for rad.io reference documentation.

## WebUSB & Browser SDR Implementation

**Academic Research:**

- "uSDR—Web-based SDR Platform Using WebUSB" (rs-ojict.pubpub.org/pub/esvkbk39) - Embedded SDR board optimized for browser use via WebUSB, Chrome/Opera/Edge support
- "Software-defined Radios: Architecture, state-of-the-art, and challenges" (ScienceDirect, 2018) - Comprehensive SDR architecture review

**Open Source Libraries:**

- rtlsdrjs (github.com/sandeepmistry/rtlsdrjs) - WebUSB library for Realtek RTL2832U receivers
- WebUSB API spec (w3.org/TR/webusb/) - Official W3C standard

**Key Findings:**

- WebUSB enables driver-free SDR in Chromium browsers
- Security requires HTTPS (except localhost)
- Firefox lacks WebUSB support (browser compatibility constraint)
- Educational potential: accessible SDR for collaborative research

**References:**

- A Novel Web-based SDR Board (rs-ojict.pubpub.org)
- RTL-SDR WebUSB implementations (rtl-sdr.com/tag/webusb/)
- MDN WebUSB API docs (developer.mozilla.org)

---

## FFT Implementation & Performance

**Web Audio API:**

- MDN Web Audio Visualizations (developer.mozilla.org/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API)
- AnalyserNode provides built-in FFT, hardware accelerated, max 32768 size

**JavaScript Libraries:**

- fft.js: 47,511 ops/sec at 2048 points (Mozilla Kraken benchmark) - fastest pure JS FFT
- browser-fft (github.com/Matt-Esch/browser-fft) - Lightweight Web Audio-based FFT

**Algorithm Research:**

- Cooley-Tukey FFT complexity: O(N log₂N) time, O(N) space
- Radix-2 divide-and-conquer, requires power-of-2 sizes
- Algowiki: Detailed operational aspects (algowiki-project.org/en/Cooley-Tukey)
- Brian McFee Digital Signals Theory (brianmcfee.net/dstbook-site) - comprehensive FFT theory

**Performance Best Practices:**

- Use typed arrays (Float32Array)
- Pre-compute windows
- Web Workers for background processing
- Powers-of-two for radix-2 optimization

---

## Window Functions & Spectral Leakage

**Research Papers:**

- Stanford FFT Windows Lecture (ccrma.stanford.edu/~jos/Windows/Windows.pdf) - Julius O. Smith III
- Springer: "Window Functions and Spectral Leakage" (link.springer.com/content/pdf/10.1007/978-3-031-01610-3_16.pdf)
- Brian McFee: "Spectral leakage and windowing" (brianmcfee.net/dstbook-site/content/ch06-dft-properties/Leakage.html)

**Comparison Studies:**

- Number Analytics: "Comparing Hanning, Hamming & Blackman Windows" (numberanalytics.com/blog)
- Eureka PatSnap: FFT Windowing Functions Explained

**Trade-offs:**

- Hann: Good balance, general purpose
- Hamming: Better first sidelobe suppression
- Blackman: Strongest leakage suppression, wider main lobe
- Main lobe width vs. side lobe level is key design trade-off

---

## FM Demodulation Algorithms

**Academic Sources:**

- Hyperdynelabs: "FM Demodulation Using Digital Radio and DSP" (hyperdynelabs.com/dspdude/papers/DigRadio_w_mathcad.pdf)
- Virginia Tech: "All Digital FM Demodulator" thesis (vtechworks.lib.vt.edu, 2019)
- SFU: "FM Demodulation: Frequency Discriminator" (ensc.sfu.ca ENSC327 lecture)
- Analog Devices Wiki: FM Detectors (wiki.analog.com/university/courses/electronics)

**Phase Discriminator:**

- Instantaneous phase: φ[n] = atan2(Q[n], I[n])
- Frequency: f_inst[n] ∝ φ[n] - φ[n-1]
- Quadrature (I/Q) sampling enables complex plane analysis
- Post-processing: de-emphasis filter (75 µs for broadcast FM)

**Tutorial:**

- WirelessPi: "Frequency Modulation and Demodulation Using DSP" (wirelesspi.com)

---

## IQ Constellation Diagrams

**Educational Resources:**

- WirelessPi: "I/Q Signals 101: Neither Complex Nor Complicated" (wirelesspi.com)
- PySDR: "IQ Sampling" guide (pysdr.org/content/sampling.html)
- Wikipedia: "In-phase and quadrature components" (en.wikipedia.org)
- ICO Optics: "Quadrature Sampling and I/Q Demodulation" (ico-optics.org)

**Technical Details:**

- Quadrature sampling: 90° phase separation (I=cosine, Q=sine)
- Maintains full amplitude and phase information
- Constellation diagram: IQ plane plot of modulation symbols
- QPSK: 4 points at 90° intervals (2 bits/symbol)
- 16-QAM: 16 points in grid (4 bits/symbol)
- Diagnostic tool: clusters show noise/distortion

**Signal Processing:**

- Hilbert transform: real to analytic (IQ) signal conversion (panoradio-sdr.de)
- Enables handling of complex modulations (QPSK, QAM, etc.)

---

## Cross-References to Codebase

**DSP Processing:**

- src/utils/dsp.ts - Core DSP functions
- src/utils/dspProcessing.ts - Signal processing pipeline
- src/utils/dspWasm.ts - WebAssembly optimizations

**Visualizations:**

- src/components/FFTChart.tsx - Spectrum display
- src/components/Spectrogram.tsx - Waterfall display
- src/components/IQConstellation.tsx - Constellation diagram

**Audio:**

- src/lib/audio/audio-pipeline.ts - Main audio manager
- src/workers/audio-worklet.js - Low-latency demodulation
- src/lib/audio/sample-rate-converter.ts - Decimation/interpolation

**Hardware:**

- src/models/HackRFOne.ts - HackRF device model
- src/models/HackRFOneAdapter.ts - WebUSB interface

---

## Future Deep Dives

**Priority Topics for Research:**

1. WebAssembly SIMD for parallel DSP operations
2. WebGPU compute shaders for GPU-side FFT
3. Digital mode demodulation (PSK31, FT8)
4. Phase-locked loop (PLL) implementations
5. Automatic modulation classification algorithms

**Academic Search Keywords:**

- "WebUSB software defined radio"
- "browser FFT performance optimization"
- "digital demodulation algorithms"
- "constellation diagram error vector magnitude"
- "window function spectral analysis"

**Key Journals & Conferences:**

- IEEE Transactions on Signal Processing
- IEEE International Conference on Acoustics, Speech, and Signal Processing (ICASSP)
- SDR Forum / Wireless Innovation Forum
- ACM Digital Library - web technologies
