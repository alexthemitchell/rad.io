# Preview Distribution Plan

**ID:** P0-08-01  
**Roadmap:** Phase 0 / 0.8 Preview/Release Strategy (Feedback Loop)  
**Roadmap Description:** how pre-release builds are shared and how feedback is collected and triaged.

## Summary

Define how preview builds are distributed and how feedback is collected, triaged, and converted into measurable work.

This must work for a WebUSB/WebAudio app where HTTPS (or localhost) constraints matter.

## Deliverables

- A preview distribution plan at `docs/release/preview-distribution.md`.
- A feedback intake and triage playbook at `docs/release/preview-feedback-triage.md`.
- A single “Preview Feedback” issue template (created under Phase 0.9) and a required label `type:feedback`.

## Acceptance Criteria

- [ ] The plan explicitly defines channels:
  - `main` deployment (GitHub Pages) for the latest stable preview.
  - Per-PR artifacts (CI build artifacts) for reviewers to download/test.
- [ ] The plan documents WebUSB constraints and required instructions for testers:
  - Must use Chromium-based browser that supports WebUSB.
  - Site must be served over HTTPS (GitHub Pages qualifies) or `https://localhost` for local.
- [ ] The triage playbook defines:
  - Time-to-triage target (e.g., ≤ 48 hours for `type:feedback`).
  - Required labels applied during triage (`area:*`, `priority:*`, `risk:*`).
  - Conversion rules: feedback → bug/feature issue with measurable acceptance criteria.
- [ ] The plan defines what evidence preview feedback must include:
  - Browser/OS, app version or commit SHA, reproduction steps, expected vs actual, and whether hardware was used.

## Agent Prompt

Write two docs:

1. Write `docs/release/preview-distribution.md` referencing the existing GitHub Pages deployment workflow (`.github/workflows/deploy-pages.yml`), defining how testers access the preview URL and identify the build version, and defining how PR builds are shared via artifacts.
1. Write `docs/release/preview-feedback-triage.md` defining intake (issue template fields and required reproduction info), triage SLAs and label requirements, conversion to actionable issues, and how to tag performance/reliability regressions so they become gated work.
