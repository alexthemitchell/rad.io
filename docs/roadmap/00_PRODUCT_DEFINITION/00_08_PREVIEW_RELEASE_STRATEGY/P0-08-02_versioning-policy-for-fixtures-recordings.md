# Versioning Policy for Fixtures/Recordings

**ID:** P0-08-02  
**Roadmap:** Phase 0 / 0.8 Preview/Release Strategy (Feedback Loop)  
**Roadmap Description:** compatibility expectations for early users and regression assets.

## Summary

Define a versioning and compatibility policy for deterministic fixtures (golden inputs) and user recordings so regression assets remain usable over time.

The outcome must be measurable (schema versions, compatibility guarantees) and minimally supported by repository structure and validation scripts.

## Deliverables

- A policy doc at `docs/reference/fixtures-and-recordings-versioning.md`.
- A canonical location and naming convention for fixtures and recordings:
  - Fixtures: `test/fixtures/` (or `docs/fixtures/` if they are non-test assets).
  - Recording samples for tests: `test/fixtures/recordings/`.
- A machine-readable manifest format described in the policy (JSON) with required fields.

## Acceptance Criteria

- [ ] The policy defines two independent version numbers:
  - `fixtureSchemaVersion` (how fixture files are interpreted)
  - `recordingSchemaVersion` (how recordings are interpreted)
- [ ] The policy defines compatibility rules:
  - Minor app releases may add optional fields without breaking old assets.
  - Breaking schema changes require a schema version bump and a migration tool or an explicit “unsupported” statement.
- [ ] The policy defines required metadata fields for recordings (minimum):
  - `appVersion` or commit SHA, `recordingSchemaVersion`, source type, sample rate, center frequency, timestamp base.
- [ ] The policy defines validation requirements:
  - A JSON Schema (or TypeScript runtime validation) exists for the manifest.
  - CI fails if fixture/recording manifests are invalid.

## Agent Prompt

Create `docs/reference/fixtures-and-recordings-versioning.md`:

1. Define fixture vs recording terminology and what each is used for.
2. Define schema versioning rules and the required metadata fields.
3. Define a manifest JSON shape and show a complete example.
4. Define migration expectations and where migration code lives (e.g., `src/recording/migrations/`).
5. Define validation expectations and a minimal CI check to enforce schema validity.
