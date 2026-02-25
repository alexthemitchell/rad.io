# Noise Floor Estimator Contract v1

## Status

Accepted for MVP (Phase 4.3).

## Purpose

Define a deterministic, ENBW-aware noise-floor estimator used by analyzer candidate stats, warnings, and analyzer exports.

## Estimator Name

`trimmed-mean-percentile`

## Algorithm

Given trace values in dBFS:

1. Sort bins ascending.
2. Take a trimmed low-power slice from 5th to 35th percentile.
3. Convert slice values from dB to linear power and compute the mean.
4. Convert mean power back to dBFS.
5. Apply ENBW correction: subtract `10*log10(enbwBins)`.

Output is `noiseFloorDbfs`.

## Required Inputs

- `trace` (Float32Array dBFS bins)
- `enbwBins` (from FFT window contract)

## Required Outputs

- `noiseFloorDbfs`
- Candidate stats derived from this floor:
- `strongestPeakSnrDb = strongestPeakDbfs - noiseFloorDbfs`
- `occupancy01` (fraction of bins above `noiseFloorDbfs + 6 dB`)
- `persistence01` (fraction of bins active in >=50% history frames)

## Export Contract

Analyzer exports MUST include:

- `analyzer.semantics.noiseFloorEstimator` = `trimmed-mean-percentile`
- `analyzer.semantics.noiseFloorDbfs`
- `analyzer.candidateStats.*`

## Guardrails

- Empty traces return `-Infinity` and should be treated as unavailable.
- Consumers must not compare noise floors across artifacts if `enbwBins` differs and correction is absent.
