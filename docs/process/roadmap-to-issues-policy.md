# Roadmap To Issues Policy

Source requirement:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_07_PROJECT_HYGIENE_EXECUTION_SYSTEM/P0-07-02_roadmap-to-issues-policy.md`

## Purpose

Every roadmap checkbox that represents executable work is tracked as a GitHub issue so progress is auditable and testable.

## Mapping Rules

- 1 roadmap checkbox equals 1 primary issue.
- Roadmap research notes can stay as docs-only entries if they have no implementation outcome.
- If a checkbox is too large for 1-3 days, create an epic issue plus leaf issues.

## Epic Versus Leaf

Epic issue:

- Tracks a multi-issue objective.
- Contains scope summary and Definition of Done checklist.
- Links all sub-issues in a task list.

Leaf issue:

- Implementable in 1-3 days by one owner.
- Contains 3-8 measurable acceptance criteria.
- Contains a concrete verification plan.

## Required Issue Fields

- Title format: `P{phase}-{section}: <short action>`.
- Required links:
  - Roadmap file path.
  - Checkbox/item ID.
- Required labels:
  - 1 `type:*`
  - 1 `area:*`
  - 1 `priority:*`
- Required sections:
  - Problem statement.
  - User-facing outcome.
  - Acceptance criteria.
  - Test plan and expected scripts.
  - Risks and degraded-mode behavior (if relevant).

## Linking Conventions

Roadmap to issue:

- Add issue URL adjacent to completed checkbox in roadmap markdown.

Issue to roadmap:

- Add a `Roadmap Traceability` section with:

  - file path
  - phase/section
  - item ID

## Closing Rules

Close an issue only when:

- All acceptance criteria are met.
- Evidence is linked (tests, CI, screenshots, logs, or docs).
- Any required contract/policy docs are updated.

## Change Management

When roadmap scope changes:

- Update roadmap item text.
- Update linked issue acceptance criteria.
- If issue already closed, open follow-up issue for deltas.

## Worked Example

Roadmap checkbox:

- `P0-08-01`: define preview feedback triage playbook.

Resulting leaf issue:

- Title: `P0-08: Add preview feedback triage playbook`
- Labels: `type:docs`, `area:docs`, `priority:p1`
- Acceptance criteria:

  - `docs/release/preview-feedback-triage.md` exists.
  - Triage SLA is defined (`<= 48h`).
  - Conversion rules feedback to bug/feature issue are defined.
  - Required reproduction evidence is defined.
- Test plan: markdown lint check and reviewer walkthrough.
