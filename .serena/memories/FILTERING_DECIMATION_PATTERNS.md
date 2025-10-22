# Filtering + Decimation Patterns (Efficient Streaming)

When and how to reduce sample rate without aliasing.

Core steps

1. Channel selection LPF (cutoff ~ BW/2) at current fs.
2. Decimate by M (integer). Prefer M s.t. fs/M is still convenient (e.g., to 204.8 kHz, 102.4 kHz, 48 kHz).
3. Repeat multi‑stage (e.g., 8 = 2×2×2) to reduce FIR length per stage.

Design tips

- Polyphase decimator: compute only output samples; major CPU savings.
- Windowed‑sinc FIR: length L ≈ 4·fs/Δf for transition Δf; use Kaiser for tight transition.
- CIC (boxcar) for large coarse reduction; follow with compensating FIR for passband droop.
- Overlap‑save for continuous streaming; reuse FFTs for fast convolution when L large.

Defaults for FM chain (fs=2.048 MSPS)

- LPF to 120 kHz; decimate by 4 → 512 kS/s; LPF to 60 kHz; decimate by 4 → 128 kS/s; demod then resample → 48 kHz audio.

Repo cross‑links

- DSP helpers: src/utils/dspProcessing.ts
- WASM path: src/utils/dspWasm.ts (future SIMD/polyphase)
- Bench: src/utils/dspBenchmark.ts

Validation

- Verify no spectral folding in FFT after decimation; tone at f0 remains at f0·(new_fs/old_fs) bins. THD/SNR within expectations.
