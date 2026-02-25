# FFT Scaling Contract v1

## Status

Accepted for MVP (Phase 4.3).

## Purpose

Define end-to-end FFT scaling semantics so on-screen analyzer traces and exported analyzer artifacts report consistent levels across sources and sessions.

## Reference Units

- Spectrum traces are represented in `dBFS`.
- `0 dBFS` corresponds to full-scale complex IQ magnitude at the ADC/reference input domain.
- Analyzer reference-level controls are UI offsets and do not redefine the underlying dBFS contract.

## Required Metadata

Each analyzer artifact/export MUST include:

- `fft.size`
- `fft.window`
- `fft.enbwBins`
- `fft.reference` (must be `dBFS`)
- `analyzer.semantics.rbwHz`
- `analyzer.semantics.vbwHz`

## Core Formulas

- Bin width: `binWidthHz = sampleRateHz / fftSize`
- ENBW-adjusted RBW: `rbwHz = binWidthHz * enbwBins`
- VBW (averaging approximation): `vbwHz = rbwHz / vbwFrames`

## Detector Semantics

The analyzer supports detector modes:

- `sample`: latest frame value.
- `peak`: max over detector history window.
- `rms`: root-mean-square of linear power across detector history.
- `avg`: arithmetic mean of linear power across detector history.
- `min-hold`: minimum over detector history window.
- `p95`: 95th percentile over detector history window.

Detector mode selection MUST be persisted in analyzer exports.

## Trace Math

Trace math modes are defined against detector-derived traces:

- `a`: trace A.
- `a-minus-b`: pointwise difference (dB domain).
- `max-a-b`: pointwise max.

Trace math selection MUST be persisted in analyzer exports.

## Interop Notes

- Consumers should not assume `peak-hold` is folded into exported trace arrays unless explicitly documented in the artifact payload.
- Comparing artifacts across sessions requires matching `fft.window`, `fft.enbwBins`, detector mode, and trace math mode.
