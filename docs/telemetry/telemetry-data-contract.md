# Telemetry Data Contract

Source requirement:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_09_BACKLOG_RELEASE_CHANGE_MANAGEMENT/P0-09-03_telemetry-privacy-review-gate.md`

Phase 0 scope: policy and placeholders for eventual telemetry implementation.
No remote telemetry is assumed by default.

Phase 3 update (2026-02-23): runtime diagnostics now emit a versioned local telemetry envelope with DSP amplitude metrics, demod quality metrics, per-stage timing, and an explicit AGC baseline placeholder.

## Contract Goals

- Make event categories explicit.
- Minimize collected fields.
- Keep storage local by default.
- Enforce privacy review for contract changes.

## Event Categories

- `app.lifecycle`
  - Startup, shutdown, and fatal initialization failures.
- `source.lifecycle`
  - Source selection, connect, disconnect, stream start/stop.
- `pipeline.health`
  - Buffer underruns, dropped frames/samples, discontinuities, recoveries.
- `ui.interaction`
  - High-level actions needed for reproducibility (not full clickstream).
- `diagnostic.error`
  - Structured error taxonomy references and redacted context.

## Runtime Telemetry Envelope (Implemented)

Implementation reference:

- `src/telemetry/runtimeTelemetryContract.ts`
- `src/dsp/worker.ts` (`DSP_TELEMETRY` worker event)
- `src/App.tsx` (runtime state + diagnostics export)

Top-level runtime telemetry fields now include:

- `telemetrySchemaVersion` (`"1.1.0"`)
- Existing continuity/audio/render counters and last-frame metadata
- `workerTransportMode` (`direct` or message-port fallback)
- `dsp` (pipeline timing + amplitude + demod quality)
- `agc` (baseline contract, currently not implemented)

### DSP Amplitude Contract (`dsp.amplitude`)

- Contract version: `1.0.0`
- Required fields:
  - `sampleCount`
  - `iqRmsLinear`
  - `iqPeakLinear`
  - `iqCrestFactor`
  - `audioRmsLinear`
  - `audioPeakLinear`
  - `audioDcOffset`
  - `audioClippingRatio`
- Purpose:
  - Establish a stable baseline for gain/clipping/DC diagnostics independent of demod mode.

### Demod Quality Contract (`dsp.demodQuality`)

- Contract version: `1.0.0`
- Required fields:
  - `demodMode`
  - `qualityScore01`
  - `signalPresent`
  - `reasons[]`
  - `rdsSynced` (nullable)
  - `rdsBlockErrorRate` (nullable)
- Purpose:
  - Convert DSP quality heuristics into a stable, versioned export shape for support and regressions.

### Pipeline Timing Contract (`dsp.pipelineTiming`)

- Contract version: `1.0.0`
- Required fields:
  - `ddcMs`
  - `fftMs`
  - `demodMs`
  - `downsampleMs`
  - `totalMs`
- Purpose:
  - Provide per-chunk stage timing breakdown for pipeline performance triage.

### AGC Baseline Contract (`agc`)

- Contract version: `1.0.0`
- Current state:
  - `implemented: false`
  - `mode: "none"`
  - `state: "not_available"`
  - `targetLevelDbfs: null`
  - `estimatedGainDb: null`
- Purpose:
  - Reserve a forward-compatible contract slot so AGC rollout can be additive and testable.

## Phase 2 Stream Continuity Extensions

These fields are required for stream continuity and sample-clock truth diagnostics.

### `pipeline.health.discontinuity`

- Purpose:
  - Represent explicit stream timeline boundaries.
- Required fields:
  - `streamId`
  - `sequence`
  - `sampleIndex`
  - `cause` (`restart`, `retune`, `sample_rate_change`, `reset`, `overflow`, `dropped_samples`)
  - `timestampUtc`
- Optional fields:
  - `droppedSamples`
  - `wallClockMs`

### `pipeline.health.counters`

- Purpose:
  - Monotonic counters for budget tracking and degraded mode triggers.
- Required fields:
  - `streamDiscontinuityTotal`
  - `droppedSamplesTotal`
  - `audioUnderrunTotal`
  - `windowStartUtc`
  - `windowEndUtc`

### `pipeline.health.clock_truth`

- Purpose:
  - Capture sample-clock truth mode used for UI/export confidence.
- Required fields:
  - `streamId`
  - `sampleClockTruthMode` (`unknown`, `corrected_ppm`, `disciplined_ref`)
  - `timestampUtc`
- Conditional fields:
  - If `sampleClockTruthMode = corrected_ppm`, include `correctionPpm`.
  - If `sampleClockTruthMode = disciplined_ref`, include `referenceId` and optional `correctionPpm`.

## Continuity Invariants For Telemetry

- Discontinuity events must reference the same `sequence`/`sampleIndex` pair emitted by the stream frame metadata.
- `droppedSamplesTotal` and `audioUnderrunTotal` are monotonic within a process lifetime.
- `sampleClockTruthMode` must not imply stronger claims than source metadata provides.
- `telemetrySchemaVersion` must be present in exported runtime telemetry payloads.
- `dsp.*.contractVersion` fields are required whenever `dsp` telemetry is present.

## Required Common Fields

- `eventName`
- `eventVersion`
- `timestampUtc`
- `appVersion` or `commitSha`
- `sessionId` (ephemeral and non-identifying)
- `area` (`devices`, `dsp`, `audio`, `components`, `docs`, `ci`, and related)

## Prohibited Or Restricted Fields

By default, do not collect:

- User identifiers.
- Device serial numbers in plain text.
- Raw USB payloads.
- Free-form text that may include personal data.
- Raw IQ sample buffers and raw audio PCM windows in telemetry payloads.

If required for debugging, use explicit opt-in mode and redaction.

## Storage And Retention

- Default storage: local browser storage for diagnostics, not remote transport.
- Retention guidance:
  - `diagnostic.error`: up to 7 days.
  - `pipeline.health`: session-scoped unless explicitly persisted.
  - `app.lifecycle` and `source.lifecycle`: session-scoped by default.

## Change Control

Any change to event category or field requires:

- PR note under privacy gate in `.github/pull_request_template.md`.
- Checklist pass in `docs/telemetry/privacy-review-checklist.md`.
- Contract update in this file with rationale.

## Validation Evidence

- Contract helper tests:
  - `src/telemetry/runtimeTelemetryContract.test.ts`
- Runtime emission path:
  - `src/dsp/worker.ts` emits `DSP_TELEMETRY`
- Runtime ingestion/export path:
  - `src/App.tsx` stores telemetry in `runtimeTelemetry` and includes it in diagnostics export
