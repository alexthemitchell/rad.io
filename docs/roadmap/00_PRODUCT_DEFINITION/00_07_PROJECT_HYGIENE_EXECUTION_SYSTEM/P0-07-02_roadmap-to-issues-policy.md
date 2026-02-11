# Roadmap → Issues Policy

**ID:** P0-07-02  
**Roadmap:** Phase 0 / 0.7 Project Hygiene & Execution System  
**Roadmap Description:** every roadmap checkbox becomes an issue with acceptance criteria; epics get sub-issues.

## Summary

Define a deterministic mapping from roadmap checkboxes to GitHub issues so planning is executable and progress is auditable.

This is a written policy plus minimal repo configuration so the workflow is easy to follow.

## Deliverables

- A policy document at `docs/process/roadmap-to-issues-policy.md`.
- A “roadmap item issue” template snippet included in the issue templates created in Phase 0.9.
- A lightweight convention for linking:
  - Roadmap checkbox → Issue URL
  - Issue → Roadmap file path and checkbox ID

## Acceptance Criteria

- [ ] Policy defines a 1:1 mapping: every roadmap checkbox that represents work becomes a GitHub issue with acceptance criteria.
- [ ] Policy defines what becomes an epic (tracking issue) vs a leaf issue:
  - Epic: has a scope summary, links to all sub-issues, and a single “Definition of Done” checklist.
  - Leaf: implementable within 1-3 days and includes measurable acceptance criteria.
- [ ] Policy defines minimum required issue fields:
  - Title convention: `P{phase}-{section}: <short action>` (example included).
  - Labels: at least one `area:*` and one `type:*`.
  - Acceptance criteria: 3-8 measurable bullets.
  - Test plan: unit/e2e/manual and which script(s) are expected to pass.
- [ ] Policy defines “exit criteria” for closing an issue: acceptance criteria met and evidence linked.
- [ ] Policy defines how roadmap changes are handled: editing roadmap requires updating linked issues (and vice versa).

## Agent Prompt

Create `docs/process/roadmap-to-issues-policy.md` that specifies:

1. What is considered a “roadmap checkbox” that must become an issue.
2. How to name issues and how to link issues back to roadmap paths.
3. Epic vs sub-issue rules, including how to represent sub-issues (GitHub task list or sub-issues).
4. Required metadata: labels, acceptance criteria, test plan, and which CI scripts must pass.
5. A short worked example that starts with a roadmap checkbox and ends with an issue body.
