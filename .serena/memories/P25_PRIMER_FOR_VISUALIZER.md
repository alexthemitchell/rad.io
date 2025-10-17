# P25 Primer for Visualizer (Phase I focus)

Signal basics
- C4FM modulation, 12.5 kHz channel spacing, 4800 symbols/s (9600 bps raw; dibits).
- Symbol shaping via raised‑cosine; constellation points at ±1, ±3 on I (Q≈0).

Processing chain (baseband IQ)
1) Tune + LPF: center channel at 0 Hz, LPF ~ 6 kHz.
2) Decimate to ~48–96 kS/s (≥ 8–16× symbols).
3) FM‑like discriminator to recover instantaneous frequency (C4FM detection via arctangent demod).
4) Symbol timing recovery: Gardner/Mueller–Müller loop to sample at symbol centers.
5) Slicer: map frequency deviations to dibits {00,01,10,11} with thresholds.
6) Framing/FSK4 decode: sync to known patterns (preambles); pass to vocoder (out of scope).

Visual diagnostics
- Eye diagram (optional): plot 2–3 samples/symbol around timing; open eye = good.
- Constellation after discriminator shows 4 amplitude levels on I axis.
- Spectrogram should show tight 12.5 kHz occupancy.

Repo links
- Utils: src/utils/p25decoder.ts (skeleton/roadmap)
- Components: src/components/P25SystemPresets.tsx, TalkgroupScanner.tsx
- Hooks: src/hooks/useDSPPipeline.ts (stage setup)

Notes
- Frequency offset tolerance is tight; CFO correction improves slicer accuracy.
- AGC helpful before discriminator; clip peaks softly to reduce click noise.
- For live decode, Web Workers recommended; WASM for symbol ops.
