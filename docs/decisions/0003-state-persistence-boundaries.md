# ADR 0003: State and Persistence Boundaries

## Status

Proposed

## Date

2026-02-23

## Context

The current app keeps most runtime state in React component state in `src/App.tsx`, with no durable persistence layer yet. This is good for early iteration but creates churn risk for reproducibility, URL shareability, and schema evolution.

Phase 0.4 requires explicit ownership boundaries across memory-only state, URL state, local preference state, and long-lived data stores, with migration rules per persisted format.

Constraints:

- Browser-first architecture (TypeScript + worker pipeline + WebUSB).
- Must support offline use and local-only diagnostics export.
- Must avoid storing raw IQ/audio payloads by default.

## Decision

Adopt split-by-domain ownership. No single storage mechanism is allowed to become the universal state bucket.

### Domain Mapping

| State domain | Primary mechanism | Versioning field | Retention | Notes |
| --- | --- | --- | --- | --- |
| UI ephemeral state (panel open/closed, hover, transient status) | React state (`useState`, `useRef`) | None | In-memory session only | Never persisted; reset on reload |
| VFO/frequency/tuning working state (frequency, fine tune, demod mode, zoom) | URL query params for shareable subset + in-memory runtime state | `urlStateVersion` query key | URL lifetime | URL is source of truth for shareable session intent |
| User preferences (palette, autoscale preference, units, mute preference) | `localStorage` | `prefsVersion` | Until user clears | Small, non-sensitive settings only |
| Session restore snapshot (last selected source type, last tuned params) | `localStorage` | `sessionVersion` | Last-known session | Must be best-effort and safe to ignore on parse/migration failure |
| Recording metadata and blobs | IndexedDB (metadata + blob references) | `recordingSchemaVersion` | User-managed | Metadata indexed separately from binary blob data |
| Frequency database / memories | IndexedDB | `memorySchemaVersion` | Durable | Supports larger collections and future search/index |
| Diagnostics/telemetry buffering | In-memory ring buffer + explicit export file | `diagnosticsSchemaVersion` in exported JSON | Current session unless exported | No automatic remote upload in MVP |

### Boundary Rules

- UI-only state:
  - Never read by worker directly.
  - Not persisted unless explicitly listed above.
- Pipeline-critical state:
  - Routed through versioned command contracts at UI-worker/device boundaries.
  - Snapshot persistence is allowed only for user intent, not transient streaming internals.
- URL boundary:
  - URL includes only safe, shareable user intent.
  - Internal diagnostics and hardware identifiers never enter URL.

## Alternatives Considered

### Alternative A: Put all state in Zustand + persist middleware

Rejected.

- Pros: single mental model.
- Cons: weak boundaries, over-persistence risk, harder compatibility discipline.

### Alternative B: URL-first for almost everything

Rejected.

- Pros: strong shareability.
- Cons: poor fit for larger objects, privacy risk, noisy URLs, brittle migrations.

### Alternative C: Split by domain (React + URL + localStorage + IndexedDB)

Accepted.

- Pros: clear contracts first boundaries and scalable migration story.
- Cons: more upfront architectural discipline and adapters.

## Consequences

- UX:
  - Shareable tune state becomes deterministic through URL contracts.
  - User preferences survive reloads without restoring unsafe runtime internals.
- Performance:
  - IndexedDB handles larger durable datasets without blocking main thread.
  - Avoids frequent write amplification by keeping high-rate telemetry in memory.
- Complexity:
  - Requires explicit serializers/migrators per persisted domain.
  - Requires tests for URL parsing and storage migration behavior.

## Migration / Rollout Plan

- `localStorage` stores:
  - Include top-level `version` field and domain-specific payload key.
  - Upgrade on read via pure migration functions.
  - On unknown future version, ignore payload and fall back to defaults (no crash).
- IndexedDB stores:
  - Bump DB version for structural changes.
  - Keep additive/object-store expansion backward-compatible when possible.
  - On downgrade or incompatible schema, preserve old data where possible and mark as read-only until migrated.
- URL state:
  - Include `urlStateVersion`.
  - Maintain one backward parser for previous version for at least one minor release cycle.

## Validation Plan

- Add round-trip tests for each persisted domain serializer.
- Add migration tests from N-1 and N-2 sample payloads.
- Add URL parse/serialize compatibility tests.
- Validate startup behavior with corrupt or unknown-version storage payloads (must degrade to defaults, not crash).

## Follow-Ups

- Add typed state contract module (suggested path: `src/state/contracts.ts`).
- Add persistence adapters:
  - `src/state/urlState.ts`
  - `src/state/localPrefsStore.ts`
  - `src/state/indexedDbStore.ts`
- Update diagnostics export schema with explicit version field in `src/App.tsx`.
