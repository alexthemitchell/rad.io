# STFT + Spectrogram Guide (Time–Frequency)

Essentials for our canvas spectrograms and FFT views.

Resolution trade‑offs
- FFT size (N): frequency bin width ≈ fs/N. Larger N → better frequency resolution, worse time resolution and more latency.
- Hop/overlap: hop = N · (1 − overlap). Use 50–75% overlap for smoother waterfalls. More overlap = more CPU.
- Windowing: Hann (default) balances leakage vs resolution. Blackman better sidelobe suppression; Rectangular for max resolution (more leakage).

Scaling & display
- Magnitude: 20·log10(|X[k]|/ref). For normalized ±1 input, ref=1 → dBFS.
- Noise floor estimation: median or low‑percentile of bins per frame; use it to normalize color scale adaptively.
- Dynamic range: clamp to [floor, ceiling] dB (e.g., −110 to −20 dBFS) to avoid flicker.
- Colormap: Viridis (perceptually uniform). Precompute 256‑entry LUT; map dB→index.

Performance patterns
- Use WASM FFT for N≥1024. Batch multiple windows per call when possible.
- Typed arrays everywhere; reuse frame buffers; avoid per‑pixel allocations.
- Precompute window coefficients for common N; cache by (N, type).
- High‑DPI canvas: scale by devicePixelRatio; translate(0.5, 0.5) for crisp lines.

Recommended defaults (fs ≈ 2.048 MSPS)
- FFT N: 2048 (bin ≈ 1 kHz), overlap: 50–66%, window: Hann.
- Waterfall row rate: 20–30 FPS; throttle via requestAnimationFrame.

Repo cross‑links
- Components: src/components/Spectrogram.tsx, FFTChart.tsx
- DSP: src/utils/dsp.ts (windowing, FFT path), src/utils/dspWasm.ts
- Styles: src/styles/main.css (canvas utilities)

Validation
- Inject test tone via src/utils/signalGenerator.ts; confirm a single bin peak at f0 and correct drift with known offsets.