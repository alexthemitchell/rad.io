# IQ Constellation Diagnostics (Practical)

Goal: Quickly detect front‑end and DSP issues via constellation shape.

Patterns
- Perfect noise: circular cloud centered near (0,0).
- DC offset: cloud shifted off center → apply DC removal; verify hardware LO.
- Gain/phase imbalance: ellipse (squashed/rotated) → IQ calibration.
- Clipping: square corners; points at ±1.0 bounds → reduce gain/AGC.
- Local oscillator leakage: vertical/horizontal line through origin.
- Narrowband FM audio: ring‑like distribution whose radius changes with modulation depth.

Actions
- Compute running mean of I,Q to estimate DC; subtract.
- Compute covariance matrix to quantify ellipse (eigenvalues → imbalance ratio).
- Display metrics: mean I/Q, variance, correlation ρIQ, peak magnitude.

Repo cross‑links
- Visualization: src/components/IQConstellation.tsx
- DSP: src/utils/dsp.ts (metrics helpers), src/utils/dspProcessing.ts
- Tests: src/components/__tests__/IQConstellation.test.tsx

UI tips
- Add optional overlays: unit circle, principal axes (PCA), center marker.
- Show numeric metrics beside canvas.

Acceptance
- DC |μ| < 0.02; imbalance ratio < 1.1 for “healthy”. Expose thresholds in diagnostics.