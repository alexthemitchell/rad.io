# RF Chain Model Contract (Structured)

**ID:** P0-05-06  
**Roadmap:** Phase 0 / 0.5 Data/Telemetry Contracts (Before Implementation)  
**Roadmap Description:** define the canonical schema for antenna/RF-chain/transverter context (LNA/attenuator/filter/bias-tee/IF offsets), where it is stored, and how it affects frequency/level mappings and diagnostics.

## Summary

Define a canonical RF chain model schema describing how the user’s antenna/RF chain/transverter context affects frequency and level interpretation, what is stored persistently, and what must be included in diagnostics.

This enables consistent handling of IF offsets, transverters, gains/attenuators, and bias-tee state across sources/devices.

## Deliverables

- RF chain model contract: `docs/reference/contracts/rf-chain-model-v1.md`.
- Storage decision notes:
  - What is session-scoped vs persisted user profile.
  - How it is linked to Session State.

## Acceptance Criteria

- [ ] Contract exists at `docs/reference/contracts/rf-chain-model-v1.md`.
- [ ] Schema covers at least:
  - [ ] Antenna descriptor (optional, user-provided)
  - [ ] Preamp/LNA enable + gain (if applicable)
  - [ ] Attenuator settings
  - [ ] Filters (selection/flags)
  - [ ] Bias-tee state
  - [ ] Transverter configuration (LO offset, direction, labeling)
  - [ ] IF offset (signed) and how it maps to frequency model
- [ ] Contract explicitly defines mapping effects:
  - [ ] Frequency math (ties to Frequency Model contract)
  - [ ] Level interpretation and disclosure (ties to Calibration/Disclosure contract)
  - [ ] Diagnostics contents (what is captured)
- [ ] Includes at least one worked example for a transverter setup.

## Agent Prompt

Draft the RF chain model contract.

Output file:

- `docs/reference/contracts/rf-chain-model-v1.md`

Steps:

1. Identify the RF chain concepts that must be supported for Phase 1+ (including transverters).
1. Define the schema fields and invariants (units, sign conventions).
1. Define how it affects frequency math (link to Frequency Model), level disclosure and uncertainty (link to Calibration/Disclosure), and diagnostics capture.
1. Decide what is session-scoped vs persisted.

Validation checklist:

- [ ] Schema is implementable and consistent with other contracts.
- [ ] Defines mapping effects and storage boundary.
- [ ] Includes an example.
- [ ] Markdownlint-friendly formatting.
