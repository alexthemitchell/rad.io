# Spectrum/Waterfall Display Practicals

Goals: crisp, responsive spectrum and waterfall visuals without external libs.

Rendering
- Canvas 2D with alpha:false, desynchronized:true; scale by devicePixelRatio.
- Use offscreen canvas for gradient LUT; copy via putImageData for rows.
- Precompute y-scaling for dB to pixel coordinate; avoid per-point Math during draw.

Data handling
- Maintain ring buffer of last N FFT rows; avoid array growth.
- Push rows at fixed cadence (20–30 FPS); when sample input faster, drop frames (visuals > exactness).
- Interpolate between FFT bins for cursor readout (quadratic peak pick) to show sub-bin frequency.

UX
- Pan/zoom with wheel+drag; snap to nice frequency steps; show gridlines at kHz/100 kHz/1 MHz depending on zoom.
- Cursor readout: frequency, magnitude dB, noise floor, SNR.
- Smooth color transitions; clamp dynamic ranges.

Repo cross‑links
- Components: src/components/Spectrogram.tsx, FFTChart.tsx
- Utils: src/utils/dsp.ts (windowing/FFT), src/utils/webgl.ts (future GPU)

Performance tips
- Batch draw calls; avoid per-bin fillStyle changes (use single ImageData write).
- For heavy loads, consider WebGL fragment shader rendering with 1D texture (future).