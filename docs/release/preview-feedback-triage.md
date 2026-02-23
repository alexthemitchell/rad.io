# Preview Feedback Triage

Source requirement:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_08_PREVIEW_RELEASE_STRATEGY/P0-08-01_preview-distribution-plan.md`

## Intake

Feedback must be filed with `.github/ISSUE_TEMPLATE/preview_feedback.yml`.
Required evidence:

- Browser and OS.
- Build version (commit SHA or release tag).
- Reproduction steps.
- Expected and actual behavior.
- Hardware usage and model if applicable.

## SLA

- `type:feedback` and `type:bug` triage target: <= 48 hours.
- Unclear reports receive a clarification request within same SLA window.

## Triage Labels

Apply at minimum:

- One `type:*` (`type:feedback`, convert to `type:bug` or `type:feature` when actionable).
- One `area:*`.
- One `priority:*`.

Apply risk labels when applicable:

- `risk:perf-risk` for frame rate, latency, or drop regressions.
- `risk:privacy-risk` for telemetry/diagnostics concerns.
- `risk:breaking-change-risk` for compatibility or schema concerns.

## Conversion Rules

Convert feedback into actionable issue when:

- Reproduction is confirmed.
- User impact is clear.
- Outcome can be validated.

Actionable issue must include:

- Measurable acceptance criteria.
- Verification method.
- Relevant scripts/commands.

## Escalation

Escalate immediately when feedback indicates:

- Privacy violation risk.
- Data corruption or loss.
- Deterministic demo path failure.

Escalation path:

- Apply `priority:p0` and matching `risk:*` label.
- Link blocker to release checklist item in `docs/release/release-checklist-mvp.md`.
