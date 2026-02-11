# Canonical Session State Shape

**ID:** P0-05-01  
**Roadmap:** Phase 0 / 0.5 Data/Telemetry Contracts (Before Implementation)  
**Roadmap Description:** device/tuning/demod/UI/perf settings model with a versioned schema.

## Summary

Define a single, versioned “Session State” contract that can be persisted, restored, exported in diagnostics, and used as the canonical source of truth for UI and pipeline configuration.

The goal is to make later implementation deterministic and debuggable: any meaningful user-visible behavior (device selection, tuning, demod settings, UI configuration, and performance settings) should be representable in this schema, with explicit defaults and migration rules.

## Deliverables

- Versioned session state contract document: `docs/reference/contracts/session-state-v1.md`.
- Optional machine-readable schema (if useful): `docs/reference/schemas/session-state.v1.json` (or `session-state.v1.ts` if you prefer TS-first).
- Migration notes describing:
  - How schema versions are bumped.
  - How old versions upgrade.
  - What happens on downgrade/unknown fields.

## Acceptance Criteria

- [ ] Contract exists at `docs/reference/contracts/session-state-v1.md` and includes a top-level `schemaVersion` field.
- [ ] Schema covers at minimum:
  - [ ] Source/device selection + capabilities snapshot
  - [ ] VFO/tuning state (including step sizes and offsets)
  - [ ] Demodulation state (mode, bandwidth, deemphasis/filters as applicable)
  - [ ] Visualization state (FFT settings, waterfall controls)
  - [ ] UI layout state (panels, selected views) for session restore
  - [ ] Performance/budget knobs (buffer sizes, frame-rate caps, degraded-mode toggles)
- [ ] Defaults are explicit (no “implicit defaults” hidden in code).
- [ ] Migration section describes additive vs breaking changes and the deprecation policy.
- [ ] Includes at least one concrete JSON example of a valid session state.

## Agent Prompt

Draft the versioned Session State contract.

Output files:

- `docs/reference/contracts/session-state-v1.md`
- Optionally, a machine-readable schema in `docs/reference/schemas/` (JSON Schema) or a TS type file if that fits the repo better.

Steps:

1. Search for existing state/persistence guidance and patterns:
   - `ARCHITECTURE.md` “State & Persistence”
   - Code search: `zustand`, `persist`, `localStorage`, `indexedDB`, `idb`
2. Enumerate the state domains and decide which must be included in Session State vs excluded (explicitly list exclusions).
3. Write the contract with:
   - `schemaVersion`
   - A stable top-level shape (avoid deep nesting churn)
   - Explicit defaults and optional/required fields
4. Include a migration strategy section and example states.

Validation checklist:

- [ ] Schema is implementable and unambiguous.
- [ ] Contains explicit defaults and version/migration rules.
- [ ] Includes examples and non-goals.
- [ ] Markdownlint-friendly formatting.
