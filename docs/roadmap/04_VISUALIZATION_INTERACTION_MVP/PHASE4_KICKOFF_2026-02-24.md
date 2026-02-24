# Phase 4 Kickoff Plan (2026-02-24)

## Purpose

Prepare Phase 4 implementation as issue-ready vertical slices that align with MVP cutline rules.

## Entry Criteria

- Phase 0 governance documents are present and linked in `docs/ROADMAP.md`.
- Phase 2 deterministic source coverage remains green (`npm test`).
- Phase 3 DSP baseline remains green (`npm run type-check`, `npm run validate`).

## Slice P4-A: Analyzer Baseline Controls

Scope:

- Add user controls for reference level, averaging mode/value, and peak-hold.
- Apply controls to spectrum rendering path.

Acceptance criteria:

- Reference level control changes visible scale without clipping/NaN artifacts.
- Averaging modes (`off`, `exp`, `linear`) produce deterministic trace changes.
- Peak-hold can be toggled and reset.
- Unit tests cover reducer/logic and render-state transitions.

Suggested issue labels:

- `type:feature`, `area:viz`, `priority:p0`

## Slice P4-B: Signal Discovery Helpers

Scope:

- Add center-on-peak action and snap-to-signal action from active trace.

Acceptance criteria:

- Center-on-peak tunes to current strongest peak within visible span.
- Snap-to-signal chooses nearest qualified peak to cursor/focus frequency.
- Actions are accessible from pointer and keyboard paths.
- Actions emit diagnostics events for replayability.

Suggested issue labels:

- `type:feature`, `area:ui`, `priority:p0`

## Slice P4-C: Marker MVP

Scope:

- Add one primary marker with frequency and level readout.
- Add tune-to-marker action.

Acceptance criteria:

- Marker can be placed/cleared deterministically.
- Marker readout updates with tuned span and zoom changes.
- Tune-to-marker updates active VFO without breaking audio safety path.
- Marker state is represented in exported analyzer artifact metadata.

Suggested issue labels:

- `type:feature`, `area:viz`, `priority:p1`

## Slice P4-D: Rendering Performance Gate

Scope:

- Add measurable FPS instrumentation for synthetic rendering runs.
- Define and run a repeatable 60 FPS gate.

Acceptance criteria:

- Synthetic render harness produces median and p95 FPS.
- 5-minute synthetic run shows sustained `>= 60 FPS` target for MVP hardware profile.
- Output evidence stored in `artifacts/validation/`.

Suggested issue labels:

- `type:perf`, `area:viz`, `priority:p0`

## Slice P4-E: Keyboard-First Tuning + Retune Assist

Scope:

- Ensure keyboard step tuning parity with pointer controls.
- Add return-to-last-lock assist behavior for drift-prone sessions.

Acceptance criteria:

- Keyboard step actions honor configured tuning step sizes.
- Retune-assist action returns to last lock candidate after failed drift event.
- Accessibility checks pass for focus and announcement flows.

Suggested issue labels:

- `type:feature`, `area:ui`, `priority:p1`

## Execution Order

1. P4-A Analyzer controls
2. P4-B Signal discovery
3. P4-C Marker MVP
4. P4-D FPS gate
5. P4-E Keyboard/retune assist

## Required Validation Per Slice

- `npm run lint`
- `npm run type-check`
- `npm test`
- Browser smoke validation on local dev server

## Traceability

Issue-ready acceptance criteria for slices P4-A through P4-E are captured in `docs/roadmap/04_VISUALIZATION_INTERACTION_MVP/PHASE4_KICKOFF_ISSUES_2026-02-24.md` using the template in `docs/process/acceptance-criteria-template.md`.

Link each created issue back to `docs/ROADMAP.md` Phase 4.0 and the corresponding Phase 4 subsection item(s).
