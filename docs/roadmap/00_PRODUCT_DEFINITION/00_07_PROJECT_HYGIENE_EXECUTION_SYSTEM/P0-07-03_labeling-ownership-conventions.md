# Labeling/Ownership Conventions

**ID:** P0-07-03  
**Roadmap:** Phase 0 / 0.7 Project Hygiene & Execution System  
**Roadmap Description:** area labels (usb/dsp/audio/ui), risk tags, and owner expectations.

## Summary

Standardize labels and ownership so triage, routing, and release gating are consistent and measurable.

This produces a label taxonomy, ownership expectations, and minimal repository configuration (CODEOWNERS + documented defaults).

## Deliverables

- A label taxonomy and conventions doc at `docs/process/labels-and-ownership.md`.
- A `.github/CODEOWNERS` file (if not already present) aligned with the ownership expectations.
- A “label required” policy section to be referenced by issue templates.

## Acceptance Criteria

- [ ] The taxonomy defines these required label namespaces (with examples):
  - `type:*` (bug, feature, chore, docs, perf, refactor)
  - `area:*` (usb, hackrf, dsp, audio, ui, viz, workers, recording, docs, ci)
  - `priority:*` (p0, p1, p2)
  - `risk:*` (perf-risk, privacy-risk, breaking-change-risk)
  - `status:*` (needs-triage, ready, blocked, in-progress)
- [ ] The doc defines “minimum labels per issue” (at least 1 `type:*`, 1 `area:*`, 1 `priority:*`).
- [ ] The doc defines ownership expectations:
  - Who can merge changes in critical areas (CODEOWNERS review required).
  - Who is responsible for triage SLAs (time-to-triage targets).
- [ ] CODEOWNERS includes explicit ownership rules for at least:
  - `src/hackrf/**`
  - `src/dsp/**`
  - `src/**/worker*/**` (or equivalent worker directories)
  - `.github/**` and `docs/**`

## Agent Prompt

Create `docs/process/labels-and-ownership.md` that includes:

1. A label taxonomy table with namespaces, allowed values, and when to apply.
2. Triage workflow: who applies `status:*`, when `priority:*` is set, and when `risk:*` labels are mandatory.
3. Ownership rules: CODEOWNERS expectations, review requirements for critical paths (WebUSB, worker schema, recordings).
4. Update or create `.github/CODEOWNERS` to reflect those ownership rules.
