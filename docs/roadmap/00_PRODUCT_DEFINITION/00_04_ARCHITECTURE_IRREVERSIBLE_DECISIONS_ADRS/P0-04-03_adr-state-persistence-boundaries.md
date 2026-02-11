# ADR: State & Persistence Boundaries

**ID:** P0-04-03  
**Roadmap:** Phase 0 / 0.4 Architecture “Irreversible Decisions” (ADRs)  
**Roadmap Description:** what lives in Zustand vs URL vs localStorage vs IndexedDB (including migrations).

## Summary

Define state ownership and persistence boundaries for rad.io, mapping each state domain to one primary mechanism (React state, Zustand, URL, `localStorage`, IndexedDB) and locking migration rules.

This ADR must be concrete: list state domains and where they live, including how they are serialized, versioned, and migrated.

## Deliverables

- Create folder `docs/decisions/` (if missing).
- Create ADR file `docs/decisions/0003-state-persistence-boundaries.md` with this outline:

  - Title, Status, Date
  - Context
    - State types and risks (data loss, reproducibility)
    - Constraints (offline, privacy, performance)
  - Decision
    - State domains table (domain → mechanism → versioning → retention)
    - Explicit boundary rules (UI-only vs pipeline-critical)
  - Options considered
    - All state in Zustand
    - URL-first for shareability
    - Split by domain (recommended)
  - Consequences
  - Migration plan
    - Versioning for persisted formats and upgrade/downgrade behavior
  - Validation plan
    - How to verify migrations and prevent breaking changes
  - Follow-ups

## Acceptance Criteria

- [ ] ADR exists at `docs/decisions/0003-state-persistence-boundaries.md` with standard ADR sections.
- [ ] Decision record rules are explicitly stated:

  - [ ] Alternatives considered (≥ 2) and rationale.
  - [ ] Consequences include product UX, performance, and complexity costs.
  - [ ] Migration plan is included for every persisted store.
- [ ] ADR includes a domain mapping table that covers at least:

  - [ ] UI ephemeral state (panels, selections)
  - [ ] VFO/frequency/tuning state
  - [ ] User preferences (theme, units)
  - [ ] Session restore state
  - [ ] Recording metadata and blobs
  - [ ] Frequency database / memories
  - [ ] Diagnostics/telemetry buffering (if any)
- [ ] URL vs persisted vs in-memory boundaries are explicit and consistent with “contracts first”.
- [ ] Migration rules are explicit (schema version fields, upgrade steps, rollback behavior).

## Agent Prompt

Draft an ADR for state and persistence boundaries. Do not implement large code changes.

Context gathering steps:

- Locate existing state management patterns:

  - Search for `zustand`, `createStore`, `useStore`, `persist(`
  - Search for router/query-state usage: `searchParams`, `location`, `history`, `router`
- Locate existing persistence layers:

  - Search for `localStorage`, `sessionStorage`, `indexedDB`, `idb`, `Dexie`
- Check existing guidance:

  - Read `ARCHITECTURE.md` section “State & Persistence” and any related docs

Write `docs/decisions/0003-state-persistence-boundaries.md`.

Validation checklist:

- [ ] Every persisted store has a schema version and migration notes.
- [ ] ADR includes a domain-to-storage mapping table.
- [ ] Reproducibility-sensitive state is clearly identified and handled.
- [ ] Alternatives considered and consequences are explicit.
- [ ] Markdownlint-friendly formatting.
