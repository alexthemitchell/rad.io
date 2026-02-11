# Frequency Planning / LO Model Contract (Unified)

**ID:** P0-05-04  
**Roadmap:** Phase 0 / 0.5 Data/Telemetry Contracts (Before Implementation)  
**Roadmap Description:** define RF frequency vs tuner LO vs display frequency, plus LO/IF offsets and how they propagate into readouts, exports, and retune math.

## Summary

Define a single “frequency model” contract that disambiguates RF frequency, tuner LO frequency, IF frequency, and display frequency, including sign conventions and how offsets propagate into UI readouts, exports, and retune math.

This contract prevents subtle bugs later (wrong direction offsets, incorrect labeling, inconsistent math between devices/sources).

## Deliverables

- Frequency model contract: `docs/reference/contracts/frequency-model-v1.md`.
- A worked example section with common scenarios:
  - Direct sampling (no IF)
  - Quadrature sampling with IF offset
  - Transverter with LO offset

## Acceptance Criteria

- [ ] Contract exists at `docs/reference/contracts/frequency-model-v1.md`.
- [ ] Definitions and invariants are explicit (units, sign conventions), including at least:
  - [ ] `rfHz` (physical on-air center frequency)
  - [ ] `tunerLoHz` (device LO setting, if applicable)
  - [ ] `ifHz` (intermediate frequency offset, signed)
  - [ ] `displayCenterHz` (what the UI shows as center)
  - [ ] `userOffsetHz` (optional user-defined offset)
- [ ] Propagation rules are explicit for:
  - [ ] Display readouts
  - [ ] Retune math (what field is commanded to the device)
  - [ ] Exports/recordings (what frequency metadata is stored)
  - [ ] Diagnostics (what is logged)
- [ ] Includes at least 3 worked examples with numeric values.

## Agent Prompt

Draft the unified frequency model contract.

Output file:

- `docs/reference/contracts/frequency-model-v1.md`

Steps:

1. Search the repo for frequency usage and terminology:
    - `frequency`, `tune`, `lo`, `if`, `offset`, `centerHz`
2. Define the canonical fields and invariants (units, sign).
3. Define mapping rules between:
    - UI display
    - Device commands
    - Persistence/exports
    - Diagnostics
4. Add worked examples.

Validation checklist:

- [ ] Definitions are unambiguous.
- [ ] Math rules cover the common scenarios.
- [ ] Includes worked numeric examples.
- [ ] Markdownlint-friendly formatting.
