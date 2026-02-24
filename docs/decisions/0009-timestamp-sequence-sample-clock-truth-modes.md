# ADR 0009: Timestamp, Sequence, and Sample-Clock Truth Modes

## Status

Accepted

## Date

2026-02-23

## Context

Phase 2 deterministic sources already emit frame metadata (`sequence`, `sampleIndex`, `sampleCount`, `timestampNs`, `droppedSamples`, and `discontinuity`) through `SDRStreamFrame` in `src/devices/streamFrame.ts`.

Mock and file replay implementations currently maintain monotonic frame progression and emit discontinuity causes on restart, retune, sample-rate changes, and dropped samples:

- `src/devices/MockDevice.ts`
- `src/devices/FileDevice.ts`

There are invariant tests and randomized regression checks that verify monotonicity and discontinuity linkage:

- `src/devices/MockDevice.streamFrame.test.ts`
- `src/devices/FileDevice.test.ts`
- `src/devices/streamFrame.fuzz.test.ts`

What is missing is a single architecture decision that locks:

- the canonical invariants,
- the meaning of sample-clock truth modes,
- and what claims UI/export surfaces may make per mode.

## Decision

Adopt a single frame-truth contract for deterministic sources and downstream consumers.

### 1. Canonical Invariants

For each `streamId` (or implicit stream instance when `streamId` is not serialized):

- `sequence` is strictly monotonic by `+1` per emitted frame.
- `sampleCount > 0` for every frame.
- `sampleIndex` is monotonic and must satisfy:
  - `current.sampleIndex = previous.sampleIndex + previous.sampleCount + current.droppedSamples`
- `timestampNs` is monotonic and must increase when `sampleCount > 0`.
- If `droppedSamples > 0`, frame must carry `discontinuity.cause = "dropped_samples"` unless a stronger explicit cause is already present.
- If `discontinuity` is present:
  - `discontinuity.sequence === frame.sequence`
  - `discontinuity.sampleIndex === frame.sampleIndex`

### 2. Sample-Clock Truth Modes

Use `SDRSampleClockTruthMode` values from `src/devices/streamFrame.ts`:

- `unknown`
- `corrected_ppm`
- `disciplined_ref`

Semantics:

- `unknown`:
  - sample rate/timebase is usable for continuity and relative timing only.
  - no absolute frequency/time accuracy claims in UI/export.
- `corrected_ppm`:
  - sample clock includes declared PPM correction and may be used for corrected readouts.
  - exports must include correction provenance when making corrected claims.
- `disciplined_ref`:
  - sample clock is disciplined to a named reference source.
  - UI/export may present high-confidence clock claims only when reference identity is present.

### 3. Discontinuity Cause Contract

Use the existing cause enum as the normative vocabulary:

- `restart`
- `retune`
- `sample_rate_change`
- `reset`
- `overflow`
- `dropped_samples`

Consumers must treat discontinuity as a timeline boundary and update diagnostics counters/events accordingly.

### 4. Claims and Degraded Mode Rules

- Contracts first: all sources emit the same metadata envelope shape.
- In degraded mode, continuity counters may grow, but invariants above must still hold.
- Any UI/export claim stronger than `unknown` must be backed by frame `sampleClock.truthMode` and corresponding metadata fields.

## Options considered

### Option A: Keep invariants implicit in tests and source implementations

Rejected.

- Pros: no additional docs work.
- Cons: behavior can drift across drivers and exports.

### Option B: ADR-level invariant and truth-mode contract (this decision)

Accepted.

- Pros: shared semantics across Mock/File/WebUSB, testable contracts, less churn.
- Cons: requires keeping docs and tests in lockstep when fields evolve.

### Option C: Delegate truth semantics to each source implementation

Rejected.

- Pros: source-specific flexibility.
- Cons: inconsistent UI/export claims and weaker conformance guarantees.

## Consequences

Positive:

- Locks a single truth vocabulary before hardware driver expansion.
- Enables conformance-style checks for future WebUSB drivers.
- Makes telemetry and diagnostics contracts easier to align.

Negative:

- Adds maintenance overhead for contract updates.
- Requires explicit downgrade behavior when truth mode is unavailable.

## Validation plan

- Keep monotonic/discontinuity invariant tests green in:
  - `src/devices/MockDevice.streamFrame.test.ts`
  - `src/devices/FileDevice.test.ts`
  - `src/devices/streamFrame.fuzz.test.ts`
- Add coverage (follow-up) for non-`unknown` truth modes in unit tests.
- Validate telemetry includes discontinuity and drop/underrun counters in contract docs.
- Verify roadmap Phase 2 checklist items reference concrete code/tests instead of prose-only claims.

## Follow-ups

- Add targeted tests for `corrected_ppm` and `disciplined_ref` payload semantics.
- Add conformance tests for WebUSB source adapters once stream-frame metadata is emitted there.
- Ensure recording/export schemas carry discontinuity timeline and truth-mode provenance before claiming measurement-grade timelines.
