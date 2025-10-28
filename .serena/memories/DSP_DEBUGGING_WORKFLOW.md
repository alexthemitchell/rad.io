Purpose: 5-step sanity flow to localize DSP faults (RF→audio). Stop at first failure.

1. Tone inject

- Generate single-tone IQ at Fs, known f0. Code: src/utils/signalGenerator.ts, src/utils/dsp.ts
- Expect: DC (no rotation) or rotating phasor at f0.

2. FFT peak

- Spectrum (CPU/WASM). Code: src/utils/dsp.ts, assembly/dsp.ts, src/utils/dspWasm.ts, src/components/FFTChart.tsx
- Expect: single narrow peak at bin≈f0 (≤1 bin). If broad/missing: fix window, N, normalization.

3. LO offset

- Tuning contracts: src/hooks/useSDR.ts, src/models/HackRFOneAdapter.ts, src/models/SDRDevice.ts
- If peak ≠ DC: digital mix exp(-j2πf0n/Fs); confirm DC-centered.

4. LPF + decim

- Complex LPF before decim M. Code: src/utils/dspProcessing.ts; UI: DSPPipeline/InteractiveDSPPipeline
- Expect: peak preserved, no images; adjust taps or M; account group delay.

5. Demod audio

- FM/AM demod → playback. Code: src/utils/dspProcessing.ts, src/utils/audioStream.ts, src/hooks/useSpeaker.ts
- Expect: 1 kHz IQ → ~1 kHz audio; verify deemphasis, rates, no NaNs/clipping.

Instrumentation/tips: PerformanceMetrics + performanceMonitor; Float32 end-to-end; tests use src/utils/testMemoryManager.ts; CPU vs WASM FFT magnitudes within small epsilon.

Healthy pipeline: FFT peak ≤1 bin error; centered after mix; no new images post-decim; clean demod audio, no dropouts.

See also: DSP_STFT_SPECTROGRAM_GUIDE, FILTERING_DECIMATION_PATTERNS, DEMODULATION_BASICS_FM_AM, WebUSB_STREAMING_DEBUG_GUIDE.
