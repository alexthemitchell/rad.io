# MVP Cutline + Sequencing Rules

**ID:** P0-07-04  
**Roadmap:** Phase 0 / 0.7 Project Hygiene & Execution System  
**Roadmap Description:** label items as Must/Should/Could and define “vertical slice first” sequencing for new subsystems.

## Summary

Define the MVP cutline and sequencing rules so the project ships a working vertical slice early and avoids building unintegrated subsystems.

This is a written policy that drives issue scoping, PR review, and release readiness.

## Deliverables

- A cutline and sequencing rules doc at `docs/process/mvp-cutline-and-sequencing.md`.
- A “vertical slice first” checklist snippet to be referenced in the DoD PR template.

## Acceptance Criteria

- [ ] The doc defines Must/Should/Could with concrete criteria:
  - Must: required for the MVP user journeys and success gates.
  - Should: improves usability/reliability but not required to demo the core journey.
  - Could: nice-to-have, explicitly deprioritized until after MVP ships.
- [ ] The doc defines a sequencing rule set with at least these constraints:
  - No new subsystem work without a minimal end-to-end integration path.
  - Every new subsystem must have at least one deterministic test source.
  - Performance/reliability budgets must be defined before optimizing.
  - Prefer “thin slice” integration over “wide platform” work.
- [ ] The doc defines a “cutline decision log” process: where the cutline is recorded and how changes are approved.

## Agent Prompt

Create `docs/process/mvp-cutline-and-sequencing.md`:

1. Define Must/Should/Could and how labels are applied to issues.
2. Define sequencing rules for new subsystems (WebUSB, worker pipeline, WebAudio): vertical slice first.
3. Define a lightweight cutline change process: who approves, what evidence is required, and how it is recorded.
4. Provide two examples of “good sequencing” and “bad sequencing” taken from typical SDR features (driver, DSP, UI).
