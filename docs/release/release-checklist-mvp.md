# Release Checklist MVP

Source requirement:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_09_BACKLOG_RELEASE_CHANGE_MANAGEMENT/P0-09-02_release-checklist-mvp.md`

Use this checklist for every MVP preview/release cut.

## 1. Scope And Version

- [ ] Scope is frozen for this cut and linked issues are closed or explicitly deferred.
- [ ] Version/tag for release candidate is selected.
- [ ] Changelog entries are drafted per `docs/release/changelog-policy.md`.

## 2. Quality Gates

Run and record outcomes:

- [ ] `npm run validate` passes.
- [ ] `npm run build:prod` passes.
- [ ] `npm run test:e2e` passes.
- [ ] `npm run test:e2e:real` completed or explicitly skipped (timeboxed optional hardware smoke).

## 3. Support Matrix

- [ ] Tier 1 browser matrix is green for deterministic path.
- [ ] Any unsupported combinations are documented in release notes.
- [ ] WebUSB constraints are restated for testers.

## 4. Schema And Migration

- [ ] Fixture schema compatibility statement included.
- [ ] Recording schema compatibility statement included.
- [ ] Migration notes are linked if schema changed.

## 5. Privacy And Diagnostics

- [ ] If telemetry/diagnostics/logging changed, complete `docs/telemetry/privacy-review-checklist.md`.
- [ ] `docs/telemetry/telemetry-data-contract.md` updated when event/field changes occur.

## 6. Demo Gate

- [ ] `docs/release/demo-script-mvp.md` passes end-to-end on deterministic source.
- [ ] Demo artifacts collected (screenshots and notes).
- [ ] Any demo failures are tracked as blocking issues.

## 7. Publish

- [ ] Preview distribution notes published (`docs/release/preview-distribution.md`).
- [ ] Feedback channel is open (`preview_feedback.yml`).
- [ ] Release owner records go or no-go decision with rationale.
