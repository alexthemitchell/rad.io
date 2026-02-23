# Changelog Policy

Source requirement:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_09_BACKLOG_RELEASE_CHANGE_MANAGEMENT/P0-09-02_release-checklist-mvp.md`

## Purpose

Make release impact explicit for users, testers, and maintainers.

## Location

Use `CHANGELOG.md` at repository root for release-level entries.
If unavailable, include changelog section in release notes and add `CHANGELOG.md` in next release hygiene cycle.

## Entry Format

Each release entry should include:

- Release identifier (tag/version/date).
- Summary paragraph.
- Sections:

  - Added
  - Changed
  - Fixed
  - Known Issues
  - Migration Notes

## What Must Be Recorded

- User-visible behavior changes.
- Breaking or potentially breaking changes.
- Performance/reliability changes with measurable context.
- Fixture/recording schema version updates and compatibility statements.
- Privacy-impacting diagnostics/telemetry changes.

## Authoring Rules

- Write in user-facing language first, implementation detail second.
- Link to issues/PRs for traceability.
- Include rollback or mitigation notes for risky changes.
