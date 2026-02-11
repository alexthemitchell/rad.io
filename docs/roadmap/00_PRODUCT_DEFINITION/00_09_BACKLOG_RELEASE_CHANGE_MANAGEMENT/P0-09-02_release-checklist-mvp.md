# Release Checklist (MVP)

**ID:** P0-09-02  
**Roadmap:** Phase 0 / 0.9 Backlog, Release, and Change Management  
**Roadmap Description:** versioning, changelog notes, migration notes, browser matrix, and “demo script passes” gate.

## Summary

Define an MVP release checklist that is executable and tied to automated quality gates.

The checklist must be runnable by a maintainer and produce a clear “release yes/no” decision.

## Deliverables

- `docs/release/release-checklist-mvp.md`
- `docs/release/demo-script-mvp.md` (a 5-10 minute deterministic demo script)
- `docs/release/changelog-policy.md` (what gets recorded, format, and where)

## Acceptance Criteria

- [ ] The release checklist includes explicit commands to run and expected outcomes:
  - [ ] `npm run validate`
  - [ ] `npm run build:prod`
  - [ ] `npm run test:e2e`
  - [ ] Optional: `npm run test:e2e:real` (hardware smoke; timeboxed)
- [ ] The checklist includes a support-matrix verification step (Tier 1 must be green).
- [ ] The checklist includes migration notes requirements: recording schema changes and fixture schema changes must have a migration/compat statement.
- [ ] The checklist includes a demo gate: demo script must pass end-to-end using a deterministic source (no hardware required).
- [ ] The checklist includes a privacy review step if telemetry/diagnostics changed.

## Agent Prompt

Create release docs:

1. `docs/release/release-checklist-mvp.md` with a step-by-step checklist:
    - Version bump policy, changelog updates, build/test commands, and quality gate review.
    - Support matrix checks and known-issues documentation.
2. `docs/release/demo-script-mvp.md`:
    - Deterministic scenario: load a fixture or mock source, tune, listen, record, replay.
    - Expected screenshots or observable outcomes.
3. `docs/release/changelog-policy.md`:
    - Where the changelog lives and how entries are written.
