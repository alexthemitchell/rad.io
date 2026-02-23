# Definition of Done

Source requirements:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_07_PROJECT_HYGIENE_EXECUTION_SYSTEM/P0-07-01_definition-of-done-pr-issue.md`
- `docs/roadmap/00_PRODUCT_DEFINITION/00_09_BACKLOG_RELEASE_CHANGE_MANAGEMENT/P0-09-03_telemetry-privacy-review-gate.md`

This repository uses two Definition of Done checklists: one for issues and one for pull requests.
A work item is done only when both checklists are satisfied.

## Issue DoD

- [ ] Roadmap linkage is present: include roadmap file path and item ID (for example, `P0-07-01`).
- [ ] Problem statement is specific and user-meaningful.
- [ ] Acceptance criteria are measurable and scenario-based (3-8 bullets).
- [ ] Each acceptance criterion includes how it will be verified: `unit`, `e2e`, or `manual`.
- [ ] Test plan lists expected commands, at minimum from `npm run validate`, `npm run test:e2e`, or justified subset.
- [ ] Labels include at least one `type:*`, one `area:*`, and one `priority:*`.
- [ ] Dependencies and sequencing are called out (what must land first, what can run in parallel).
- [ ] Risks are documented, including degraded-mode behavior when performance/reliability budgets are at risk.
- [ ] Contract changes are called out if they touch driver interfaces, worker messages, fixtures, or recordings.
- [ ] If change is architectural and hard to reverse, ADR requirement is identified (`docs/decisions/`).

## PR DoD

- [ ] Linked issue(s) are present, or `No issue needed` is justified.
- [ ] `npm run lint` passes.
- [ ] `npm run type-check` passes.
- [ ] `npm test` passes.
- [ ] `npm run build:prod` passes.
- [ ] Tests are updated or a rationale for no test change is provided.
- [ ] Performance impact statement is provided: `no impact` or measured impact with method.
- [ ] Contract impact is documented for schema/interface changes:

  - Worker message schemas
  - Device interfaces under `src/devices/**` and `src/hackrf/**`
  - Fixture/recording manifests
- [ ] If telemetry/diagnostics/logging/recording metadata changed, privacy review is completed:

  - Complete `docs/telemetry/privacy-review-checklist.md`
  - Confirm data contract updates in `docs/telemetry/telemetry-data-contract.md`
- [ ] If irreversible architectural decision was made, ADR was created or updated under `docs/decisions/`.
- [ ] Docs are updated when behavior or operator workflow changed (`docs/process/**`, `docs/release/**`, `docs/reference/**`).

## Evidence Expectations

For every checked PR DoD item, include one of:

- Command output summary.
- CI run link.
- Screenshot or short note for manual step.
- Doc link proving policy/contract updates.

## Vertical Slice Gate

Before review approval, confirm the change contributes to an end-to-end slice and not an isolated subsystem buildout.
See `docs/process/mvp-cutline-and-sequencing.md`.
