# Phase 2 Exit Checklist (Deterministic Sources)

Scope: Phase 2 roadmap items with repository-backed evidence only.

## Exit Checklist

- [x] Mock source emits deterministic stream frames and supports start/stop/rate/frequency controls.
  - Evidence:
    - `src/devices/MockDevice.ts`
    - `src/devices/MockDevice.streamFrame.test.ts`
- [x] File (SigMF) replay source emits deterministic stream frames.
  - Evidence:
    - `src/devices/FileDevice.ts`
    - `src/devices/FileDevice.test.ts`
    - `src/fixtures/sigmf/goldenToneFixture.ts`
- [x] Stream frame schema includes timestamp/sequence/sample-count/discontinuity/clock-truth fields.
  - Evidence:
    - `src/devices/streamFrame.ts`
- [x] Discontinuity causes are explicit and surfaced through runtime telemetry state.
  - Evidence:
    - `src/devices/streamFrame.ts`
    - `src/App.tsx`
- [x] Dropped-sample continuity behavior is regression-tested.
  - Evidence:
    - `src/devices/MockDevice.streamFrame.test.ts`
    - `src/devices/FileDevice.test.ts`
    - `src/devices/streamFrame.fuzz.test.ts`
- [x] Randomized discontinuity/property coverage exists for start/stop/retune/sample-rate sequences.
  - Evidence:
    - `src/devices/streamFrame.fuzz.test.ts`
- [x] Fixture library and schema include calibrated metadata extensions plus optional reference/wall-clock metadata.
  - Evidence:
    - `src/fixtures/sigmf/knownSignalFixtureLibrary.ts`
    - `src/fixtures/sigmf/schema.ts`
    - `src/fixtures/sigmf/schema.test.ts`

## Not Yet Exit-Complete (Remain Open)

- [ ] WebUSB source conformance to the same stream-frame invariants.
- [ ] Non-`unknown` sample-clock truth modes exercised in device tests.
- [ ] Recording/export pipeline propagation of discontinuity timeline and clock-truth provenance.
- [ ] Hour-scale drift regression for RF-timebase and audio-timebase divergence.
