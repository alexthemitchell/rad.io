# Telemetry/Privacy Review Gate

**ID:** P0-09-03  
**Roadmap:** Phase 0 / 0.9 Backlog, Release, and Change Management  
**Roadmap Description:** ensure diagnostics/telemetry items always include redaction rules and explicit user consent UX.

## Summary

Create a privacy/telemetry review gate that is required whenever diagnostics, telemetry, logging, or recording metadata changes.

This gate is a written checklist plus minimal repository integration so it shows up in every relevant PR.

## Deliverables

- `docs/telemetry/privacy-review-checklist.md`
- `docs/telemetry/telemetry-data-contract.md` (high-level: what is collected, why, and retention)
- DoD integration: add a privacy checkbox and link in the PR template.

## Acceptance Criteria

- [ ] The privacy checklist explicitly covers:
  - Data classification (PII vs non-PII), with “no PII by default” as the default rule.
  - Redaction rules for logs (never log raw USB payloads unless explicitly opted-in).
  - Consent UX requirements (what is opt-in vs required for functionality).
  - Storage and retention rules (local-only by default unless explicitly enabled).
- [ ] The checklist defines “must not collect” categories unless explicit opt-in is implemented.
- [ ] The gate is integrated into the PR template (a checkbox + link).

## Agent Prompt

Implement the privacy/telemetry review gate:

1. Write `docs/telemetry/privacy-review-checklist.md` as a checklist that a reviewer can execute.
2. Write `docs/telemetry/telemetry-data-contract.md` describing event categories, fields, and retention.
3. Update the PR DoD template to include a mandatory privacy review checkbox when telemetry/diagnostics are touched.
4. Keep the policy practical for Phase 0: if a telemetry system is not implemented yet, scope to “policy + placeholders” and require future work items.
