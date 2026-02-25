# Phase 6.6 Satellite Workflow Evidence

Implementation anchor:

- `src/measurements/phase66SatelliteWorkflows.ts`
- `src/measurements/phase66SatelliteWorkflows.test.ts`
- `src/devices/rotctldHostBridge.ts`
- `src/devices/rotctldHostBridge.test.ts`
- `src/App.tsx`

## Scope Summary

This implementation adds practical satellite workflow contracts and UI integration:

- TLE catalog import/parsing with validation and structured satellite metadata
- Predictive pass list generation over an operator-defined window
- Real-time Doppler correction helper for VFO tuning from pass range-rate
- Rotator control bridge integration for `rotctld` command dispatch via local host bridge capability

## Implemented Contracts

- `parseTleCatalog`: robust name/line1/line2 parsing with error collection
- `predictSatellitePasses`: bounded pass prediction output using SGP4 propagation from imported TLE line pairs
- `computeDopplerCorrectedFrequencyHz`: applies radial-velocity correction to downlink frequency
- `buildRotctldSetPositionCommand`: guardrailed `rotctld` `P <az> <el>` command generation
- `probeRotctldHostBridge` + `runRotctldCommandViaHostBridge`: capability-gated bridge execution path

## Propagation Model Notes

Pass prediction now uses SGP4 propagation via `satellite.js`, with observer look-angle solving for elevation/range and a deterministic finite-difference range-rate estimate for Doppler workflows.

Current assumptions and boundaries:

- Orbit state is propagated in TEME and transformed to observer look angles each sample step.
- Range-rate is estimated with a centered 1-second derivative of slant range and clamped to operational bounds for UI safety.
- Prediction cadence (`stepSeconds`) trades precision for runtime cost and is operator configurable through workflow inputs.

## Test Coverage

- `phase66SatelliteWorkflows.test.ts`:
  - TLE parsing
  - Doppler sign/correction behavior
  - SGP4 predictive pass chronology and bounded range-rate behavior
  - rotctld command formatting guardrails
- `rotctldHostBridge.test.ts`:
  - host-bridge capability probe
  - command validation and timeout guardrails
  - response normalization
