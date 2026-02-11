# Issue Templates + Acceptance Criteria Template

**ID:** P0-09-01  
**Roadmap:** Phase 0 / 0.9 Backlog, Release, and Change Management  
**Roadmap Description:** standardize bug/feature/driver issues so work stays testable and user-visible.

## Summary

Create standardized GitHub Issue templates that force measurable acceptance criteria and make work easy to triage and gate.

Templates must cover the core work types for this project: product features, bugs, and device/driver integration.

## Deliverables

- Issue templates under `.github/ISSUE_TEMPLATE/`:
  - `bug_report.yml`
  - `feature_request.yml`
  - `driver_integration.yml`
  - `preview_feedback.yml`
  - `config.yml` (disable blank issues and link to discussions if used)
- A short acceptance criteria template doc at `docs/process/acceptance-criteria-template.md`.

## Acceptance Criteria

- [ ] Each template includes required fields that make the issue testable:
  - Problem statement
  - User-facing outcome
  - Acceptance criteria (3-8 checkboxes or bullets)
  - Verification method (unit/e2e/manual) and which script(s) validate it
  - Performance/reliability impact section (required for `type:perf` or `risk:perf-risk`)
- [ ] `driver_integration.yml` requires:
  - Device model, transport, permissions notes, and a minimal “connect → stream” success criteria.
  - A “debug artifacts” section (logs, USB descriptors, reproduction steps).
- [ ] Templates include label guidance (what `type:*`, `area:*`, `priority:*` to apply) and triage expectations.
- [ ] Blank issues are disabled via `.github/ISSUE_TEMPLATE/config.yml`.

## Agent Prompt

Implement GitHub issue templates:

1. Add `.github/ISSUE_TEMPLATE/config.yml` to disable blank issues.
2. Add YAML templates for bug, feature, driver integration, and preview feedback.
3. Write `docs/process/acceptance-criteria-template.md` that defines a standard format:
    - Scenario-based criteria
    - Measurable thresholds where relevant (FPS, latency, drop rate)
    - How to validate (scripts, tests, screenshots, logs)
4. Keep templates consistent with the label taxonomy and Definition of Done.
