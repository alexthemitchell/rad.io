# Labels And Ownership

Source requirements:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_07_PROJECT_HYGIENE_EXECUTION_SYSTEM/P0-07-03_labeling-ownership-conventions.md`
- `docs/roadmap/00_PRODUCT_DEFINITION/00_09_BACKLOG_RELEASE_CHANGE_MANAGEMENT/P0-09-01_issue-templates-acceptance-criteria-template.md`

## Label Taxonomy

| Namespace | Allowed Values | When To Apply |
| --- | --- | --- |
| `type:*` | `type:bug`, `type:feature`, `type:chore`, `type:docs`, `type:perf`, `type:refactor`, `type:feedback` | Primary work classification |
| `area:*` | `area:devices`, `area:hackrf`, `area:rtl-sdr`, `area:dsp`, `area:audio`, `area:components`, `area:ui`, `area:viz`, `area:workers`, `area:recording`, `area:docs`, `area:ci` | Primary subsystem ownership |
| `priority:*` | `priority:p0`, `priority:p1`, `priority:p2` | Delivery urgency |
| `risk:*` | `risk:perf-risk`, `risk:privacy-risk`, `risk:breaking-change-risk` | Delivery and release risk |
| `status:*` | `status:needs-triage`, `status:ready`, `status:blocked`, `status:in-progress` | Workflow state |

## Minimum Labels Per Issue

Every issue must include:

- One `type:*`.
- One `area:*`.
- One `priority:*`.

Add `risk:*` when performance, privacy, or compatibility could regress.

## Triage Workflow

1. Intake applies `status:needs-triage`.
2. Triage owner sets `type:*`, `area:*`, `priority:*`, and any `risk:*` within 48 hours.
3. If issue is actionable, set `status:ready`.
4. Assignee moves to `status:in-progress` when implementation starts.
5. If blocked, apply `status:blocked` and record unblock condition.

## Ownership Expectations

- CODEOWNERS review is required for critical paths:
  - Device and WebUSB integrations.
  - DSP pipeline changes.
  - Worker message schemas.
  - Release/process policy changes under `.github/**` and `docs/**`.
- Triage SLA:
  - `type:feedback` and `type:bug` should be triaged in <= 48 hours.
  - Other types should be triaged in <= 5 business days.

## Area Mapping To Repository

- `area:devices`: `src/devices/**`, `src/hackrf/**`
- `area:dsp`: `src/dsp/**`
- `area:components`, `area:ui`, `area:viz`: `src/components/**`, `src/App.tsx`, `src/index.css`
- `area:audio`: `src/audio/**`, `public/wfm-processor.js`
- `area:docs`: `docs/**`, `README.md`
- `area:ci`: `.github/workflows/**`, scripts used in CI

## Escalation

If `risk:privacy-risk` or `risk:breaking-change-risk` is present, PR must include explicit reviewer sign-off from the owning area and evidence links in the PR template.
