# Fixtures And Recordings Versioning

Source requirement:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_08_PREVIEW_RELEASE_STRATEGY/P0-08-02_versioning-policy-for-fixtures-recordings.md`

## Terminology

- Fixture:
  - Deterministic test input and expected-output references used for automated checks.
  - Canonical location: `test/fixtures/`.
- Recording:
  - Captured source/session artifact used for replay, debugging, and regression checks.
  - Canonical location: `test/fixtures/recordings/`.

## Independent Schema Versions

Maintain two version numbers:

- `fixtureSchemaVersion`
- `recordingSchemaVersion`

These versions are independent and must not be conflated with application semantic version.

## Compatibility Rules

- Minor app changes may add optional fields without breaking old assets.
- Breaking schema change requires version bump and one of:
  - Migration path implementation.
  - Explicit unsupported statement in release notes.
- Migration code location:
  - `src/recording/migrations/` for recording migrations.
  - `src/test/fixtures/migrations/` for fixture migrations (or equivalent test utility path).

## Required Recording Metadata

Minimum manifest fields:

- `recordingSchemaVersion`
- `appVersion` or `commitSha`
- `sourceType` (`mock`, `hackrf`, `rtl-sdr`, or other declared type)
- `sampleRateHz`
- `centerFrequencyHz`
- `timestampBase`
- `createdAtUtc`

## Manifest Shape

```json
{
  "recordingSchemaVersion": 1,
  "fixtureSchemaVersion": 1,
  "appVersion": "0.1.0",
  "commitSha": "abc1234",
  "sourceType": "mock",
  "sampleRateHz": 2048000,
  "centerFrequencyHz": 101100000,
  "timestampBase": "unix-epoch-ms",
  "createdAtUtc": "2026-02-23T00:00:00Z",
  "file": "fm-scan-smoke.iq",
  "notes": "Deterministic smoke fixture for MVP demo"
}
```

## Validation

- Manifest must be validated by JSON Schema or runtime validation before use.
- CI must fail when fixture/recording manifests are invalid.
- Validation should be included in `npm run validate`.

## Current Deterministic Fixture Baseline

Implemented baseline assets and code paths:

- SigMF replay device: `src/devices/FileDevice.ts`
- Fixture schema validation: `src/fixtures/sigmf/schema.ts`
- Canonical deterministic fixture generator: `src/fixtures/sigmf/goldenToneFixture.ts`
- Determinism tests:
  - `src/fixtures/sigmf/goldenToneFixture.test.ts`
  - `src/devices/FileDevice.test.ts`

Minimum fixture metadata for the baseline schema:

- `sampleRateHz`
- `centerFrequencyHz`
- `calibrationStatus` (`uncalibrated` | `factory` | `user`)

The baseline canonical fixture is intentionally small and deterministic to support:

- hardware-independent DSP development
- reproducible regression checks
- stable bug report attachments

## Release Notes Requirement

When schema version changes:

- Add migration or compatibility statement to changelog.
- Add release checklist evidence in `docs/release/release-checklist-mvp.md`.
