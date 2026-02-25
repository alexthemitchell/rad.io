# Phase 6.2 Recording And Persistence Evidence

Implementation anchor:

- `src/measurements/phase62RecordingPersistence.ts`
- `src/measurements/phase62RecordingPersistence.test.ts`
- `src/App.tsx`

## Scope Summary

This implementation provides a deterministic, SigMF-first recording and persistence workflow:

- IQ + audio recording sessions with chunking and instant replay ring buffer
- IndexedDB-backed storage (with memory fallback for non-browser environments)
- SigMF metadata draft generation and interop hard-gate validation
- Structured RF notebook annotations and bookmarks
- Device preset capture bundled with recordings
- Repro bundle export with manifest + replay entrypoint + scene metadata
- Deterministic replay and offline deterministic demod render
- IQ interchange import/export profiles (`cu8`, `cs16_le`, `cf32_le`)
- Audio export (`wav` and deterministic `flac` stub) with metadata
- Workspace import/export bundles
- Retention and quota helpers for cleanup policy

## Persistence Boundaries (ADR 0003)

- UI-ephemeral controls remain in React state (`App.tsx`).
- Durable recording payloads and workspace bundles are stored in IndexedDB via `createBrowserRecordingStore`.
- Existing localStorage domains (preferences, VFO presets, calibration) are not overloaded with recording blobs.

## Test Coverage

`src/measurements/phase62RecordingPersistence.test.ts` covers:

- schema + hard-gate metadata checklist behavior
- persistence and retention policy behavior
- ring-buffer quick-tap export
- deterministic replay/offline render stability
- IQ interchange import/export profiles
- WAV/FLAC metadata export behavior
- repro bundle manifest + replay entrypoint emission
- workspace state import/export and annotation merge
