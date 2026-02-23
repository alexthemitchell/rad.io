# Phase 2 Risk Register

This register tracks deterministic-source and timeline-contract risks for Phase 2.

## Scope

- Phase 2 roadmap sections:
  - `docs/ROADMAP.md` (2.1 to 2.5)
- Contract/ADR anchors:
  - `docs/decisions/0007-source-dsp-audio-sink-contracts.md`
  - `docs/decisions/0009-timestamp-sequence-sample-clock-truth-modes.md`
  - `docs/telemetry/telemetry-data-contract.md`

## Risk Register

| ID | Area | Risk | Impact | Likelihood | Mitigation | Tripwire | Evidence Gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P2-R01 | Frame timeline | Stream-frame invariants drift across source implementations, causing replay/debug mismatch. | H | M | Keep invariant tests shared across Mock/File and extend to WebUSB adapters before enabling hardware parity claims. | Any failing monotonicity/discontinuity invariant test in source frame suites. | `src/devices/MockDevice.streamFrame.test.ts`, `src/devices/FileDevice.test.ts`, `src/devices/streamFrame.fuzz.test.ts` all green. |
| P2-R02 | Discontinuity semantics | Discontinuity causes are emitted but not propagated consistently to diagnostics and later recording/export surfaces. | H | M | Keep cause vocabulary centralized in `SDRDiscontinuityCause`; require telemetry event/counter mapping. | Discontinuity observed in source frames but not reflected in runtime counters/events. | Runtime state updates in `src/App.tsx` plus telemetry contract mapping in `docs/telemetry/telemetry-data-contract.md`. |
| P2-R03 | Clock truth claims | UI/export claim stronger timing/frequency confidence than source truth mode supports. | H | L | Enforce claim rules from ADR 0009 and require truth-mode provenance fields when mode is non-`unknown`. | Export/UI declares corrected or disciplined timing without corresponding metadata. | Truth-mode union in `src/devices/streamFrame.ts` and ADR 0009 claim constraints. |
| P2-R04 | Deterministic coverage gaps | Fixture library does not yet cover all roadmap scenarios (for example NOAA/time-beacon clips), creating blind spots. | M | M | Keep roadmap item open; add fixture IDs incrementally with schema-backed metadata and tests. | Regression class cannot be reproduced with deterministic fixtures. | `src/fixtures/sigmf/knownSignalFixtureLibrary.ts` and related tests continue to expand before closure. |

## Review Cadence

- Update on each Phase 2 milestone merge.
- Close Phase 2 only when all `H` impact risks have evidence gates satisfied.
