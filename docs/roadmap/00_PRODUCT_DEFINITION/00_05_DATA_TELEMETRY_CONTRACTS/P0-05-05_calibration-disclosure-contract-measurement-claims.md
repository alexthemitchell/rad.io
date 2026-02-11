# Calibration & Disclosure Contract (Measurement Claims)

**ID:** P0-05-05  
**Roadmap:** Phase 0 / 0.5 Data/Telemetry Contracts (Before Implementation)  
**Roadmap Description:** define what “uncalibrated/approx/calibrated” means for frequency and level, what evidence is required for “measurement-grade,” and how assumptions/uncertainty must be surfaced in UI and exports.

## Summary

Define a calibration and disclosure taxonomy that prevents rad.io from making accidental “measurement-grade” claims.

This contract must standardize what “uncalibrated”, “approximate”, and “calibrated” mean for frequency and level; what evidence is required to claim calibrated behavior; and how assumptions/uncertainty are surfaced in UI and exports.

## Deliverables

- Calibration/disclosure contract: `docs/reference/contracts/calibration-disclosure-v1.md`.
- UI and export disclosure rules included in the contract (required copy elements and metadata fields).

## Acceptance Criteria

- [ ] Contract exists at `docs/reference/contracts/calibration-disclosure-v1.md`.
- [ ] Taxonomy includes at least:
  - [ ] Frequency calibration state (uncalibrated/approx/calibrated)
  - [ ] Level calibration state (uncalibrated/approx/calibrated)
  - [ ] Timebase/reference state (internal/unknown vs external disciplined)
- [ ] Evidence requirements are explicit (what must be known/measured to claim “calibrated”).
- [ ] UI disclosure rules are explicit (where and when to show uncertainty and assumptions).
- [ ] Export rules are explicit (required metadata fields in exports/recordings/diagnostics).
- [ ] Includes at least 2 examples of compliant disclosure text/metadata.

## Agent Prompt

Draft the calibration and disclosure contract.

Output file:

- `docs/reference/contracts/calibration-disclosure-v1.md`

Steps:

1. Identify all places the app may imply calibration or measurement accuracy (UI readouts, exports, screenshots, frequency database entries).
1. Define the calibration states and their precise meanings.
1. Define what evidence is required to claim “calibrated” (and defaults if unknown).
1. Define UI copy rules and export metadata requirements.

Validation checklist:

- [ ] Prevents implicit measurement claims.
- [ ] Includes explicit uncertainty/assumption disclosure rules.
- [ ] Includes examples.
- [ ] Markdownlint-friendly formatting.
