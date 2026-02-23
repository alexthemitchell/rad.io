# Preview Distribution

Source requirement:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_08_PREVIEW_RELEASE_STRATEGY/P0-08-01_preview-distribution-plan.md`

## Channels

- Stable preview channel:
  - GitHub Pages deployment from `main`.
  - Workflow reference: `.github/workflows/deploy-pages.yml`.
- Per-PR validation channel:
  - CI build artifacts attached to PR workflow runs.
  - Used for review and regression checks before merge.

## Tester Access

- Use Chromium-based browser with WebUSB support.
- Use HTTPS origin (GitHub Pages) or `https://localhost` for local testing.
- Confirm build identity before testing:
  - Commit SHA from footer/UI or PR metadata.
  - Date/time of build artifact.

## Distribution Steps

1. Merge approved preview changes to `main`.
2. Confirm Pages deployment completes successfully.
3. Share preview URL and commit SHA in preview announcement issue.
4. For risky changes, share PR artifact link for targeted reviewer validation before merge.

## Required Preview Notes

Every preview announcement should include:

- Scope summary.
- Known limitations.
- Test focus areas (`area:*`).
- Feedback submission link to `preview_feedback.yml` issue template.

## WebUSB Constraints

Preview notes must remind testers:

- Browser permission prompts are required for device access.
- Non-secure origins are unsupported for WebUSB.
- Hardware is optional for most MVP checks; deterministic source paths remain required.
