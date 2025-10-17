# IITM Wireless Lab Learnings → rad.io (Applied)

Source: https://varun19299.github.io/ID4100-Wireless-Lab-IITM/
Focus: distill course learnings into actionable rules and checks for our browser SDR app.

Signal & sampling
- Nyquist: fs ≥ 2·BW. For multistage decimation, LPF before each downstep to avoid aliasing.
- Complex sampling: I/Q captures positive+negative frequencies; use complex NCO for mixing. Avoid real-signal-only shortcuts.
- dB math: Power: 10·log10(P/P0); Voltage/Magnitude: 20·log10(A/A0). Use dBFS for normalized signals.

Mixing & filtering
- Heterodyne: multiply by e^{−j2πf0t} to shift target to 0 Hz, then LPF channel BW.
- Windowing: Rectangular → leakage; Hann/Hamming → lower sidelobes; Blackman → even lower (wider main lobe). Match window to task.
- Convolution theorem: time-domain FIR ↔ frequency-domain multiply. Overlap-save for streaming FIRs.

Time–frequency analysis (STFT)
- Trade-off: larger N gives finer frequency bins, worse time resolution; choose by task.
- Overlap: 50–75% for smooth spectrograms; beyond that diminishing returns vs CPU.
- Zero-padding improves interpolation of peaks but not true resolution.

Demodulation essentials
- AM: envelope = |analytic(x)| or sqrt(I²+Q²); remove DC; lowpass to audio BW.
- FM: phase-difference discriminator y[n]=∠(x[n]·conj(x[n−1])); de-emphasis (τ=50/75µs).
- SNR: estimate via signal peak vs noise floor; use for AGC decisions.

Practical diagnostics
- IQ constellation: DC offset (shift), imbalance (ellipse), clipping (square edges).
- Spectral checks: image frequencies after mixing imply filter/decimation bug; DC spike indicates LO/DC removal issues.
- Parseval sanity: sum(|x|²) ≈ (1/N)·sum(|X|²) to validate FFT scaling.

Browser constraints & choices
- Prefer fs 1–4 MSPS with staged decimation for real-time demod in JS/WASM.
- Typed arrays + preallocation; throttle visual updates to 20–30 FPS.
- Use WASM FFT for N≥1024; batch windows for spectrogram.

Repo cross-links
- DSP: src/utils/dsp.ts, dspProcessing.ts, dspWasm.ts
- Visuals: Spectrogram.tsx, FFTChart.tsx, IQConstellation.tsx
- Devices: HackRFOne.ts, HackRFOneAdapter.ts

Acceptance checkpoints
- After tuning+LPF: target centered, passband shape visible, no aliasing post-decimation.
- FM chain: intelligible audio at 48 kHz, stable levels with de-emphasis; CPU within budget.
- Spectrogram: stable bin peak for test tone; expected leakage per window choice.