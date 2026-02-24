# Phase 4 Kickoff Issue Drafts (2026-02-24)

Purpose: provide issue-ready acceptance criteria for P4-A through P4-E using the required Scenario/Result/Verify/Evidence format from `docs/process/acceptance-criteria-template.md`.

## P4-A: Analyzer Baseline Controls

Roadmap link: `docs/ROADMAP.md` section 4.0 Kickoff Slice A

### Acceptance Criteria (P4-A)

- [x] Scenario: User adjusts analyzer reference level from the control panel while a spectrum trace is active.
  Result: Spectrum scale updates without NaN/clipping artifacts and the reference line text reflects the selected value.
  Verify: unit
  Evidence: `src/components/SpectrumCanvas.tsx`, `src/dsp/analyzerControls.test.ts`

- [x] Scenario: User switches averaging mode between `off`, `exp`, and `linear`.
  Result: Trace averaging behavior changes deterministically according to the selected mode and parameter value.
  Verify: unit
  Evidence: `src/dsp/analyzerControls.test.ts`

- [x] Scenario: User toggles peak-hold and presses reset.
  Result: Peak-hold overlay can be enabled/disabled and reset returns held values to the current trace.
  Verify: unit
  Evidence: `src/components/SpectrumCanvas.tsx`, `src/dsp/analyzerControls.test.ts`

## P4-B: Signal Discovery Helpers

Roadmap link: `docs/ROADMAP.md` section 4.0 Kickoff Slice B

### Acceptance Criteria (P4-B)

- [x] Scenario: User triggers center-on-peak from button or keyboard shortcut.
  Result: Tuner centers on strongest qualified peak in visible span and resets fine tune.
  Verify: unit
  Evidence: `src/App.tsx`, `src/dsp/analyzerControls.test.ts`

- [x] Scenario: User triggers snap-to-signal with marker focus or current tuned focus.
  Result: Fine tune moves to nearest qualified peak and remains alias-safe.
  Verify: unit
  Evidence: `src/App.tsx`, `src/dsp/analyzerControls.test.ts`

- [x] Scenario: User runs discovery actions through keyboard and pointer paths.
  Result: Each action emits diagnostic events with trigger metadata for replayability.
  Verify: manual
  Evidence: `src/App.tsx`, diagnostics event log in app UI

## P4-C: Marker MVP

Roadmap link: `docs/ROADMAP.md` section 4.0 Kickoff Slice C

### Acceptance Criteria (P4-C)

- [x] Scenario: User places and clears a marker from current trace peak.
  Result: Marker state is deterministic and clear action removes marker immediately.
  Verify: unit
  Evidence: `src/App.tsx`, `src/dsp/analyzerControls.test.ts`

- [x] Scenario: User changes zoom/span while marker is active.
  Result: Marker readout remains accurate and `inView` updates when marker exits visible span.
  Verify: unit
  Evidence: `src/dsp/analyzerControls.test.ts`, `src/components/SpectrumCanvas.tsx`

- [x] Scenario: User exports diagnostics with marker enabled.
  Result: Analyzer artifact includes marker payload (`active`, `frequencyHz`, `powerDbfs`, `inView`).
  Verify: unit
  Evidence: `src/dsp/analyzerArtifactExport.ts`, `src/dsp/analyzerArtifactExport.test.ts`

## P4-D: Rendering Performance Gate

Roadmap link: `docs/ROADMAP.md` section 4.0 Kickoff Slice D

### Acceptance Criteria (P4-D)

- [x] Scenario: Performance gate script runs on synthetic rendering workload.
  Result: Gate computes `medianFps`, `p95Fps`, and `sustainedFps` and fails if target is not met.
  Verify: unit
  Evidence: `scripts/render-fps-gate.mjs`, `scripts/render-fps-gate.test.mjs`

- [x] Scenario: Team runs the default gate duration for kickoff validation.
  Result: A 5-minute run (`durationSec: 300`) records sustained performance at or above 60 FPS target.
  Verify: manual
  Evidence: `artifacts/validation/p4-0d-render-fps-gate-2026-02-24T23-26-56-410Z.json`

- [x] Scenario: Validation output is generated during gate execution.
  Result: Evidence payload is written to `artifacts/validation/` with stable schema fields.
  Verify: unit
  Evidence: `scripts/render-fps-gate.test.mjs`, `artifacts/validation/`

## P4-E: Keyboard-First Tuning + Retune Assist

Roadmap link: `docs/ROADMAP.md` section 4.0 Kickoff Slice E

### Acceptance Criteria (P4-E)

- [x] Scenario: User applies base/large/fine keyboard steps (`Arrow`, `Shift+Arrow`, `Alt+Arrow`).
  Result: Frequency and fine tune honor configured step sizes and announce step changes via status live region.
  Verify: e2e
  Evidence: `src/App.tsx`, `e2e/phase4-keyboard.spec.ts`

- [x] Scenario: Drift confidence degrades during active AFC session and user triggers retune assist.
  Result: Return-to-last-lock restores last lock candidate and emits diagnostics event.
  Verify: manual
  Evidence: `src/App.tsx`, diagnostics event log in app UI

- [x] Scenario: Keyboard-first tuning flows are executed without pointer interaction.
  Result: Focus remains stable and shortcuts remain operable while command palette/input focus guards are respected.
  Verify: e2e
  Evidence: `e2e/phase4-keyboard.spec.ts`

- [x] Scenario: Operator selects HackRF source and initiates stream open from browser controls.
  Result: UI enters pairing/open path and emits explicit diagnostic failure guidance when WebUSB chooser selection is not completed.
  Verify: manual
  Evidence: `artifacts/validation/p4-hackrf-mcp-verification-2026-02-24.png`
