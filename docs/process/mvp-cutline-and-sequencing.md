# MVP Cutline And Sequencing

Source requirement:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_07_PROJECT_HYGIENE_EXECUTION_SYSTEM/P0-07-04_mvp-cutline-sequencing-rules.md`

## Purpose

Keep MVP delivery focused on a demonstrable, deterministic vertical slice.

## Cutline Definitions

- Must:
  - Required to satisfy MVP user journeys and quality budgets.
  - Missing item blocks MVP release.
- Should:
  - Strongly improves reliability/usability.
  - Can ship immediately after MVP if Must set is complete.
- Could:
  - Nice-to-have.
  - Explicitly deferred until after MVP cutline passes.

## Labeling For Cutline

Apply one of:

- `priority:p0` for Must.
- `priority:p1` for Should.
- `priority:p2` for Could.

## Sequencing Rules

- No new subsystem work without a minimal end-to-end integration path.
- Every new subsystem must include at least one deterministic source/test path.
- Define performance and reliability budgets before optimization work.
- Prefer thin vertical slices over broad platform scaffolding.
- Require observable degraded-mode behavior for budget misses.

## Vertical Slice First Checklist

- [ ] Source path exists (mock/fixture/real where applicable).
- [ ] DSP or transform path is connected.
- [ ] Audio and/or visualization path shows outcome.
- [ ] Operator can verify result deterministically without hardware.
- [ ] Tests and diagnostics are sufficient to detect regressions.

## Cutline Decision Log

Record cutline decisions in issue comments and link from milestone tracking issue.
Each decision entry must include:

- Item moved (Must, Should, Could).
- Why the move is needed.
- Evidence used (quality data, schedule impact, regression risk).
- Approver(s).

## Approval Rule

Changing Must scope requires maintainer approval plus impact note on:

- MVP demo path.
- Release checklist.
- Remaining risk.

## Examples

Good sequencing:

- Add deterministic source to `src/dsp/**`, wire to `src/components/**`, verify output in demo script, then optimize.

Bad sequencing:

- Build advanced driver abstraction with no connect-to-stream path and no deterministic validation.

Good sequencing:

- Add recording metadata version field and validation first, then implement additional metadata producers.

Bad sequencing:

- Add new recording fields across codepaths without schema validation or compatibility statement.
