# MVP Demo Script

Source requirement:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_09_BACKLOG_RELEASE_CHANGE_MANAGEMENT/P0-09-02_release-checklist-mvp.md`

Goal: deterministic 5-10 minute walkthrough that does not require hardware.

## Preconditions

- Build is from known commit SHA.
- Deterministic source/fixture is available.
- Chromium browser on HTTPS or `https://localhost`.

## Script

1. Launch app and confirm build identity.
   - Expected: app loads without console errors.
2. Select deterministic/mock source.
   - Expected: source starts streaming immediately.
3. Tune to known fixture frequency.
   - Expected: spectrum peak appears at expected region.
4. Verify audio path for selected demod mode.
   - Expected: audible output or expected silence profile.
5. Start short recording capture.
   - Expected: recording action completes and metadata is persisted.
6. Replay captured or fixture recording.
   - Expected: replay behavior matches original deterministic pattern.
7. Stop source and verify clean shutdown.
   - Expected: no hung UI state, no uncaught errors.

## Evidence To Capture

- Startup screenshot.
- Spectrum/waterfall screenshot at tuned state.
- Recording/replay confirmation screenshot.
- Notes for expected versus actual behavior.

## Pass Criteria

- All steps complete with expected outcomes.
- No P0 defects opened during run.
- Any minor deviations are documented as non-blocking issues.
