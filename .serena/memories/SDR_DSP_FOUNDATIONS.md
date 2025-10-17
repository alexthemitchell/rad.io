# SDR + DSP Foundations (I/Q, Mixing, Decimation)

Core concepts to anchor rad.io’s processing model. Concise refresher and formulas; cross-link to code paths.

Key ideas
- Complex baseband: Represent RF as I + jQ from quadrature sampling. Complex rotation e^{jωt} mixes/centers target to 0 Hz.
- Digital mixer/downconversion: x_bb[n] = x_rf[n] · e^{-j 2π f_lo n / f_s}. Follow with low-pass filter (LPF) at channel BW and decimate.
- Decimation: After LPF to ≤ new_fs/2, decimate by M. Use CIC/FIR anti-aliasing. Keep M so CPU stays low but spectrum detail remains adequate.
- Aliasing: Require f_s ≥ 2·BW (Nyquist). Image frequencies fold; verify with FFT after change. Prefer powers-of-two FFT for speed.
- Windowing: Time-domain window reduces spectral leakage at cost of resolution (see STFT memory).
- dB scaling: magnitude_dB = 20·log10(|X[k]|/ref). For normalized float (±1), ref=1 → dBFS.
- IQ impairments: DC offset at 0 Hz, gain/phase mismatch (ellipse constellation), LO leakage and image. Correct with DC removal + simple IQ imbalance compensation.

Practical patterns
- LO offset trick (DC avoidance): Tune hardware a few kHz away (e.g., +25 kHz), capture, then digitally shift back to center before narrow LPF.
- CFO/PPM correction: Estimate frequency offset via angle of autocorrelation or pilot tone, apply complex NCO for correction.
- Buffering: Use typed arrays; pre-allocate buffers; use overlap-save for FIR when streaming.

Formulas/snippets
- Complex shift: y[n] = x[n]·(cos θn − j sin θn), θ = 2π f_shift / f_s
- IQ normalization: Int8 → float: v/128; Uint8 → (v−127)/128
- DC removal (leaky integrator): y[n] = x[n] − y[n−1] + α·y[n−1], small α (~1e−3)

Repo cross-links
- DSP: src/utils/dsp.ts, src/utils/dspProcessing.ts, src/utils/dspWasm.ts
- Visuals: src/components/FFTChart.tsx, Spectrogram.tsx, IQConstellation.tsx
- Signals: src/utils/signalGenerator.ts

Success criteria
- Centered target at 0 Hz post-mix; DC spike handled; decimated stream free of aliasing; constellation roughly circular for noise.