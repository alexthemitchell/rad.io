# Telemetry Data Contract

Source requirement:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_09_BACKLOG_RELEASE_CHANGE_MANAGEMENT/P0-09-03_telemetry-privacy-review-gate.md`

Phase 0 scope: policy and placeholders for eventual telemetry implementation.
No remote telemetry is assumed by default.

## Contract Goals

- Make event categories explicit.
- Minimize collected fields.
- Keep storage local by default.
- Enforce privacy review for contract changes.

## Event Categories

- `app.lifecycle`
  - Startup, shutdown, and fatal initialization failures.
- `source.lifecycle`
  - Source selection, connect, disconnect, stream start/stop.
- `pipeline.health`
  - Buffer underruns, dropped frames, recoveries.
- `ui.interaction`
  - High-level actions needed for reproducibility (not full clickstream).
- `diagnostic.error`
  - Structured error taxonomy references and redacted context.

## Required Common Fields

- `eventName`
- `eventVersion`
- `timestampUtc`
- `appVersion` or `commitSha`
- `sessionId` (ephemeral and non-identifying)
- `area` (`devices`, `dsp`, `audio`, `components`, `docs`, `ci`, and related)

## Prohibited Or Restricted Fields

By default, do not collect:

- User identifiers.
- Device serial numbers in plain text.
- Raw USB payloads.
- Free-form text that may include personal data.

If required for debugging, use explicit opt-in mode and redaction.

## Storage And Retention

- Default storage: local browser storage for diagnostics, not remote transport.
- Retention guidance:
  - `diagnostic.error`: up to 7 days.
  - `pipeline.health`: session-scoped unless explicitly persisted.
  - `app.lifecycle` and `source.lifecycle`: session-scoped by default.

## Change Control

Any change to event category or field requires:

- PR note under privacy gate in `.github/pull_request_template.md`.
- Checklist pass in `docs/telemetry/privacy-review-checklist.md`.
- Contract update in this file with rationale.
