# Define “MVP Exit Checklist”

**ID:** P0-01-02  
**Roadmap:** Phase 0 / 0.1 Scope & Success Definition (Must Not Churn)  
**Roadmap Description:** a short acceptance checklist tied to user journeys + budgets (perf/reliability).

## Summary

Define a short, measurable MVP exit checklist that acts as the ship gate. The checklist is based on user journeys and budgets for reliability, accessibility, and performance.

This artifact is used to decide when MVP is ready for a preview release and to prevent “it works on my machine” ambiguity.

## Deliverables

- docs/product/mvp-exit-checklist.md
- docs/product/mvp-exit-manual-test-plan.md
- docs/reference/mvp-quality-budgets.md

## Acceptance Criteria

- [ ] docs/product/mvp-exit-checklist.md contains 20–35 checkboxes grouped by: Journeys, Reliability, Accessibility, Performance, and Recovery.
- [ ] docs/product/mvp-exit-manual-test-plan.md includes step-by-step instructions to validate at least 5 journeys, including a recovery journey.
- [ ] docs/reference/mvp-quality-budgets.md defines at least 6 budgets (e.g., time-to-audio, time-to-first-waterfall, reconnect time) with thresholds.
- [ ] Every checklist item is objectively verifiable (telemetry, manual steps, or automated test).
- [ ] Checklist includes an explicit “Known limitations” section with criteria for acceptable known issues.

## Agent Prompt

You are defining rad.io’s MVP ship gate.

Context

- This exit checklist is used to decide when MVP is ready.
- It must cover end-to-end success and failure recovery.

Required outputs

- Create docs/product/mvp-exit-checklist.md:
  - Grouped checkboxes.
  - Clear thresholds and what counts as pass.
  - A short “How to use this checklist” section.
- Create docs/product/mvp-exit-manual-test-plan.md:
  - Repeatable test steps for each journey.
  - Expected UI states and success signals.
- Create docs/reference/mvp-quality-budgets.md:
  - Budgets expressed in user-facing outcomes.
  - Thresholds and how to measure.

Non-goals

- Do not implement tests or telemetry.
- Do not add new MVP scope; only validate it.

Validation plan

- Verify each exit criterion is measurable and mapped to either a journey or a quality budget.
- Ensure the manual test plan is runnable by a non-author.
- Ensure docs contain no TODOs and use markdownlint-friendly formatting.
