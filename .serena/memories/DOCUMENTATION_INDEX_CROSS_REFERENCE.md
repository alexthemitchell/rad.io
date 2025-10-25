# Documentation Index and Cross-Reference Guide

Comprehensive index of rad.io documentation with cross-references to code, memories, and external resources.

## Documentation Structure

### Architecture Decision Records (ADRs)
**Location:** `docs/decisions/`
**Status:** All 17 ADRs compliant with MADR v4 format (per ADR-REVIEW-SUMMARY.md)
**Index:** `docs/decisions/README.md`

**Core Architecture Decisions:**
1. ADR-0001: Architecture Decision Records (Meta)
2. ADR-0002: Web Worker DSP Architecture → Memory: INTERACTIVE_DSP_PIPELINE_ARCHITECTURE
3. ADR-0003: WebGL2/WebGPU GPU Acceleration → Memory: WEBGL_VISUALIZATION_ARCHITECTURE
4. ADR-0004: Signal Processing Library Selection → Code: src/utils/dsp.ts
5. ADR-0005: Storage Strategy → Code: src/utils/storage.ts
6. ADR-0006: Testing Strategy → Memory: TEST_COVERAGE_ENFORCEMENT
7. ADR-0007: Type Safety and Validation → Code: TypeScript strict mode
8. ADR-0008: Web Audio API Architecture → Memory: AUDIO_PLAYBACK_IMPLEMENTATION
9. ADR-0009: State Management Pattern → Code: src/store/
10. ADR-0010: Offline-First Architecture
11. ADR-0011: Error Handling and Resilience Strategy
12. ADR-0012: Parallel FFT Worker Pool → Memory: FFT_WIDEBAND_SCANNING_IMPLEMENTATION
13. ADR-0013: Automatic Signal Detection System
14. ADR-0014: Automatic Frequency Scanning
15. ADR-0015: Visualization Rendering Strategy → Memory: WATERFALL_DISPLAY_IMPLEMENTATION
16. ADR-0016: Viridis Colormap for Waterfall Visualization
17. ADR-0017: Comprehensive Accessibility Patterns

### Reference Documentation
**Location:** `docs/reference/`
**Index:** `docs/reference/README.md`

**User Documentation:**
- `sdr-basics.md` - SDR introduction, core concepts
  - Cross-ref: Memory WEBUSB_SDR_PRACTICAL_GOTCHAS
  - Citations: Nyquist theorem (Wikipedia, GeeksforGeeks)
- `frequency-allocations.md` - Radio frequency bands
- `modulation-types.md` - AM, FM, SSB, CW, digital modes
  - Cross-ref: Memory DEMODULATION_BASICS_FM_AM
- `signal-analysis.md` - Signal identification techniques
  - Cross-ref: Memory IQ_CONSTELLATION_DIAGNOSTICS
- `antenna-theory.md` - Antenna fundamentals
- `common-use-cases.md` - Practical applications

**Developer Documentation:**
- `dsp-fundamentals.md` - DSP theory and implementation
  - Cross-ref: Memory SDR_DSP_FOUNDATIONS
  - Code: src/utils/dsp.ts, src/utils/dspProcessing.ts
  - Citations: Brian McFee Digital Signals Theory
- `fft-implementation.md` - FFT algorithms in browser
  - Citations: Cooley-Tukey algorithm (Algowiki), fft.js benchmarks
  - Code: src/workers/fft-worker.ts
- `demodulation-algorithms.md` - AM, FM, SSB, PSK, FSK, CW
  - Citations: FM discriminator (Virginia Tech), phase detection
  - Code: src/workers/audio-worklet.js
- `performance-optimization.md` - Real-time processing optimization
  - Cross-ref: Memory JEST_MEMORY_PLAYBOOK
- `hardware-integration.md` - SDR hardware interfacing patterns
  - Cross-ref: Memory WEBUSB_SDR_INTEGRATION_PLAYBOOK
  - Code: src/models/HackRFOne.ts, src/models/HackRFOneAdapter.ts
- `webgl-visualization.md` - GPU-accelerated displays
  - Cross-ref: Memory WEBGL_VISUALIZATION_ARCHITECTURE
  - Code: src/components/Spectrogram.tsx, src/components/FFTChart.tsx
- `audio-demodulation-pipeline.md` - Audio processing architecture
  - Cross-ref: Memory AUDIO_PLAYBACK_IMPLEMENTATION
  - Code: src/lib/audio/audio-pipeline.ts

**Quick Reference:**
- `glossary.md` - SDR terminology (260+ terms)
- `formula-reference.md` - Key equations
- `keyboard-shortcuts.md` - Application controls

## Key Concept Mappings

### WebUSB & Hardware Integration
- **Docs:** `hardware-integration.md`
- **ADR:** ADR-0011 (Error Handling for hardware failures)
- **Code:** `src/models/HackRFOne.ts`, `src/models/HackRFOneAdapter.ts`
- **Memory:** WEBUSB_SDR_INTEGRATION_PLAYBOOK, HACKRF_DEVICE_INITIALIZATION_BUG_FIX
- **Citations:** uSDR paper (rs-ojict.pubpub.org), rtlsdrjs library

### FFT & Spectrum Analysis
- **Docs:** `fft-implementation.md`, `dsp-fundamentals.md`
- **ADR:** ADR-0012 (Parallel FFT Worker Pool)
- **Code:** `src/workers/fft-worker.ts`, `src/utils/dsp.ts`
- **Memory:** FFT_WIDEBAND_SCANNING_IMPLEMENTATION, DSP_STFT_SPECTROGRAM_GUIDE
- **Citations:** Cooley-Tukey O(N log N), fft.js 47,511 ops/sec

### Demodulation & Audio
- **Docs:** `demodulation-algorithms.md`, `audio-demodulation-pipeline.md`
- **ADR:** ADR-0008 (Web Audio API Architecture)
- **Code:** `src/workers/audio-worklet.js`, `src/lib/audio/audio-pipeline.ts`
- **Memory:** AUDIO_PLAYBACK_IMPLEMENTATION, DEMODULATION_BASICS_FM_AM
- **Citations:** Phase discriminator (Virginia Tech), AudioWorklet (MDN)

### Visualization
- **Docs:** `webgl-visualization.md`
- **ADR:** ADR-0003 (WebGL2/WebGPU), ADR-0015 (Rendering Strategy), ADR-0016 (Viridis colormap)
- **Code:** `src/components/Spectrogram.tsx`, `src/components/FFTChart.tsx`, `src/components/IQConstellation.tsx`
- **Memory:** WEBGL_VISUALIZATION_ARCHITECTURE, WATERFALL_DISPLAY_IMPLEMENTATION
- **Citations:** WebGL2 97% browser support, 60 FPS targets

### IQ Data & Signal Processing
- **Docs:** `dsp-fundamentals.md`, `signal-analysis.md`
- **Code:** `src/utils/dsp.ts`
- **Memory:** SDR_DSP_FOUNDATIONS, IQ_CONSTELLATION_DIAGNOSTICS
- **Citations:** IQ sampling (WirelessPi, PySDR), quadrature sampling (ICO Optics)

### Window Functions
- **Docs:** `fft-implementation.md`
- **Code:** `src/utils/dsp.ts` (hannWindow, hammingWindow, blackmanWindow)
- **Memory:** DSP_STFT_SPECTROGRAM_GUIDE
- **Citations:** Stanford FFT Windows (Julius O. Smith III), Springer window functions paper

## Research Citations Summary

**Total Citations Added:** 40+ academic papers, standards, and technical resources

**Key Academic Sources:**
- uSDR Web-based SDR (rs-ojict.pubpub.org/pub/esvkbk39)
- ScienceDirect: "Software-defined Radios: Architecture, state-of-the-art, and challenges" (2018)
- Virginia Tech: "All Digital FM Demodulator" thesis (2019)
- Stanford: FFT Windows lecture notes (Julius O. Smith III)
- Brian McFee: Digital Signals Theory (brianmcfee.net/dstbook-site)
- Springer: "Window Functions and Spectral Leakage" chapter

**Standards & Specifications:**
- W3C WebUSB API (w3.org/TR/webusb/)
- MDN Web Audio API (developer.mozilla.org)
- MDN AudioWorklet (developer.mozilla.org/docs/Web/API/AudioWorklet)

**Performance Benchmarks:**
- fft.js: 47,511 ops/sec at 2048 points (Mozilla Kraken)
- WebGL2: 60 FPS with 8192 FFT bins
- AudioWorklet: <5ms latency

**DSP Libraries & Tools:**
- fft.js (github.com/indutny/fft.js) - Fastest JS FFT
- rtlsdrjs (github.com/sandeepmistry/rtlsdrjs) - WebUSB library
- GNU Radio AGC3 (wiki.gnuradio.org) - Reference AGC implementation

## Gaps & Future Work

**Missing Documentation:**
- `keyboard-shortcuts.md` - Application keyboard controls (referenced but doesn't exist)
- Digital modes deep dive (PSK31, FT8 decoders)
- WebAssembly SIMD optimization guide
- Recording/playback implementation guide (partially covered in memory)

**Documentation Improvements Needed:**
- Add more diagrams to reference docs (signal flow, architecture)
- Create beginner tutorials for common tasks
- Add troubleshooting guide for common hardware issues
- Performance benchmarking methodology

**Memory-to-Doc Promotion Candidates:**
- WEBUSB_STREAMING_DEBUG_GUIDE → Could become troubleshooting section
- FILTERING_DECIMATION_PATTERNS → Could expand dsp-fundamentals.md
- P25_PRIMER_FOR_VISUALIZER → Could become digital-modes.md section
- RDS_IMPLEMENTATION_GUIDE → Could become modulation-types.md section

## Usage Patterns

**For New Contributors:**
1. Start with `docs/decisions/README.md` for architecture overview
2. Read `docs/reference/sdr-basics.md` for domain knowledge
3. Review relevant ADRs for specific areas
4. Check memories for implementation patterns
5. Use glossary.md for terminology

**For Users:**
1. Begin with `sdr-basics.md`
2. Check `frequency-allocations.md` for bands of interest
3. Use `modulation-types.md` to decode signals
4. Refer to `signal-analysis.md` for identification
5. Use `common-use-cases.md` for practical applications

**For Debugging:**
1. Check relevant memory (e.g., WEBUSB_STREAMING_DEBUG_GUIDE)
2. Review ADR for architectural context
3. Search reference docs for theory
4. Check code cross-references
5. Consult citations for deep dives

## Maintenance Notes

**Documentation Review Cycle:**
- ADRs: Review when making architectural changes
- Reference docs: Update with each major feature
- Memories: Keep concise, update when patterns change
- Citations: Verify links quarterly, update dead links

**Quality Standards:**
- All technical claims should have citations
- Code examples should be tested
- Cross-references should be bidirectional
- Keep memories ≤400 words per SERENA_MEMORY_BEST_PRACTICES
