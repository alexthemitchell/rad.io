# Definition of Done (PR/Issue)

**ID:** P0-07-01  
**Roadmap:** Phase 0 / 0.7 Project Hygiene & Execution System  
**Roadmap Description:** required checks, test updates, perf impact notes, ADR-needed rule.

## Summary

Define and adopt a measurable Definition of Done (DoD) for issues and pull requests so work stays testable, observable, and aligned with success gates.

The DoD must be enforceable via a checklist (policy) and minimally supported by repository templates/config (PR template, issue templates, CODEOWNERS).

## Deliverables

- A written DoD policy at `docs/process/definition-of-done.md` covering Issue DoD and PR DoD.
- A PR checklist template at `.github/pull_request_template.md` (or `.github/PULL_REQUEST_TEMPLATE.md`) reflecting the PR DoD.
- A CODEOWNERS baseline at `.github/CODEOWNERS` (minimum: require review for `src/hackrf/**`, `src/dsp/**`, `docs/roadmap/**`, `.github/**`).
- A short “How to use DoD” section added to `README.md` (linking to the DoD policy).

## Acceptance Criteria

- [ ] The DoD document defines two separate checklists: **Issue DoD** and **PR DoD**, each with 8-15 items.
- [ ] PR DoD checklist includes these required items with explicit evidence fields:
  - [ ] Linked tracking issue(s) or explicitly marked “no issue needed” with justification.
  - [ ] `npm run lint`, `npm run type-check`, `npm test`, and `npm run build:prod` pass locally or in CI (link to CI run).
  - [ ] Tests updated or a written rationale for why no test change is needed.
  - [ ] Performance impact statement: “no impact” or “measured” with metric(s) and method.
  - [ ] If telemetry/diagnostics changed: privacy review completed (link to privacy checklist item) and consent/redaction documented.
  - [ ] If interfaces/contracts changed (worker message schema, recording schema, device interface): migration/back-compat plan documented.
  - [ ] If architectural decision is irreversible: ADR created/updated in `docs/decisions/` and linked.
- [ ] Issue DoD checklist requires measurable acceptance criteria, including: scenario, expected result, how it is verified (unit/e2e/manual), and what “done” means.
- [ ] `.github/pull_request_template.md` exists and contains the PR DoD checklist (not just a link).
- [ ] `.github/CODEOWNERS` exists and includes at least 4 explicit path rules.

## Agent Prompt

Update the repo to enforce a Definition of Done:

1. Write `docs/process/definition-of-done.md` with two checklists:
    - Issue DoD: definition, required acceptance criteria format, required labels, and required links (roadmap item, ADR if needed).
    - PR DoD: required CI signals, test expectations, perf/latency note expectations, telemetry/privacy gate, and documentation update expectations.
2. Create `.github/pull_request_template.md` mirroring the PR DoD checklist with checkboxes and explicit “Evidence/Links” slots.
3. Create `.github/CODEOWNERS` with minimal ownership rules for the most critical subsystems and docs.
4. Update `README.md` to link to the DoD and explain that PRs must satisfy the checklist before review.
5. Keep formatting markdownlint-friendly: blank lines after headings, consistent list markers, no trailing spaces.
