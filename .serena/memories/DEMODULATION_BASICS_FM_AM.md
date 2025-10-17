# Demodulation Basics (FM & AM)

FM (wideband broadcast)
- Pre‑filter: LPF around channel BW (e.g., ±100–120 kHz) after mixing to baseband.
- Quadrature discriminator: y[n] = angle( x[n] * conj(x[n−1]) ) · (fs / (2π·k_dev)). For normalized IQ, k_dev scales audio.
- De‑emphasis: 75 µs (NA) / 50 µs (EU) single‑pole IIR: y[n] = y[n−1] + α·(x[n] − y[n−1]), α = dt/τ.
- Downsample to audio: decimate to 48 kHz with anti‑alias LPF.

AM (envelope)
- Pre‑filter: LPF to ~10 kHz audio BW; ensure carrier centered (0 Hz) or use Hilbert analytic signal.
- Envelope: a[n] = sqrt(I² + Q²) or abs(hilbert(x)).
- DC removal + AGC: remove carrier/DC, normalize level. Optional: synchronous AM uses phase‑locked carrier for better SNR.

Shared considerations
- DC spike handling: LO offset + digital shift, or high‑pass at ~50–200 Hz.
- Audio scaling: clamp to ±1.0; soft clip to avoid distortion.
- Buffering: overlap‑save FIRs for decimation; prefer polyphase for efficiency.

Repo cross‑links
- DSP: src/utils/dspProcessing.ts (demod helpers), src/utils/dsp.ts
- Audio: src/utils/audioStream.ts, src/components/AudioControls.tsx
- Pipeline: src/hooks/useDSPPipeline.ts (stage parameters)

Reference snippets
- FM discrim: phaseDiff = Math.atan2(I*Qprev − Q*Iprev, I*Iprev + Q*Qprev)
- De‑emphasis α = 1 − exp(−1/(fs·τ))

Benchmarks
- Use WASM for prefiltering/decimation when window sizes are large; JS OK for modest FIRs at fs ≈ 200–400 kHz post‑channel filter.