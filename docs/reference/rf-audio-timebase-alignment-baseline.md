# RF<->Audio Timebase Alignment Baseline

Status: Phase 2 baseline implemented and regression-tested for deterministic sources.

## Goal

Define a reproducible mapping from RF sample-time (`SDRStreamFrame.timestampNs`) to audio playout time while preserving existing architecture.

## Baseline Model

Implementation: `src/measurements/rfAudioTimebaseAlignment.ts`

Model output fields:

- `rf`:
  - `sequence`
  - `sampleIndex`
  - `timestampNs`
  - `sampleRateHz`
  - `elapsedMsFromSampleClock`
- `audio`:
  - `queueAheadMs`
  - `underruns`
  - `estimatedPlaybackHeadMs`
- `drift`:
  - `estimatedPpm`
  - `bounded`
  - `boundPpm`
- `truth`:
  - `mode` (`unknown`, `corrected_ppm`, `disciplined_ref`)
  - `confidence` (`relative-only`, `corrected`, `disciplined`)

Drift estimate used in baseline:

```text
estimatedPpm = ((estimatedPlaybackHeadMs - elapsedMsFromSampleClock) / elapsedMsFromSampleClock) * 1_000_000
```

This baseline is exported for diagnostics and reproducibility, not yet used as a closed-loop correction controller.

## Export Propagation

Diagnostics export includes:

- `recordingTimeline.rfAudioTimebaseAlignment`
- `recordingTimeline.discontinuityTimeline`
- `measurementProvenance.timeAlignmentExtensions`

Primary wiring: `src/App.tsx`

## Regression Evidence

- Unit model tests:
  - `src/measurements/rfAudioTimebaseAlignment.test.ts`
- Long-run deterministic drift/suspend-resume regressions:
  - `src/devices/longRunDriftRegression.test.ts`
- Scripted scenario fixtures (retune/gain/clock/backpressure):
  - `src/devices/scenarioFixtures.test.ts`

## Current Limits

- WebUSB hardware adapters do not yet emit full `SDRStreamFrame` metadata in all paths, so this baseline is currently strongest for deterministic sources (`MockDevice`, `FileDevice` replay).
- Concealment/pop-suppression telemetry hooks are still pending in `AudioSink`; recovery tests remain partial for those two behaviors.
