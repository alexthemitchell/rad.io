# ADR: Error Taxonomy + User-Facing Error UX

**ID:** P0-04-04  
**Roadmap:** Phase 0 / 0.4 Architecture “Irreversible Decisions” (ADRs)  
**Roadmap Description:** typed errors, retryability, and diagnostics bundle linkage.

## Summary

Define a typed error taxonomy for rad.io and its mapping to user-facing UX, retryability rules, and diagnostics linkage.

This ADR must standardize:

- Error categories (by subsystem and by user impact).
- Retryability and recovery policy (automatic retry, user retry, no retry).
- User-facing presentation rules (toast/banner/modal/inline).
- Diagnostics bundle linkage (what to capture, where it’s stored, and how a user shares it).

## Deliverables

- Create folder `docs/decisions/` (if missing).
- Create ADR file `docs/decisions/0004-error-taxonomy-user-facing-ux.md` with this outline:

  - Title, Status, Date
  - Context
    - Why errors need taxonomy (supportability, reliability)
  - Decision
    - Error envelope shape (error code, category, severity, retryability, cause chain)
    - UX mapping table (category/severity → surface + copy guidelines)
    - Diagnostics linkage (bundle id, capture triggers)
  - Options considered
    - Ad-hoc errors
    - Central typed taxonomy (recommended)
    - Library-driven error framework
  - Consequences
  - Migration plan
    - How existing errors (if any) are moved to the taxonomy
  - Validation plan
    - How to ensure consistency and prevent regressions
  - Follow-ups

## Acceptance Criteria

- [ ] ADR exists at `docs/decisions/0004-error-taxonomy-user-facing-ux.md` with standard ADR sections.
- [ ] Decision record rules are explicitly stated:

  - [ ] Alternatives considered (≥ 2) and rationale.
  - [ ] Consequences include developer ergonomics, UX consistency, and observability.
  - [ ] Migration plan is included if there are existing error patterns to convert.
- [ ] ADR defines a canonical set of error categories covering at least:

  - [ ] WebUSB/device
  - [ ] DSP/pipeline
  - [ ] Worker/messaging
  - [ ] Persistence/storage
  - [ ] Network (if applicable)
  - [ ] Unknown/internal
- [ ] Retryability rules are explicit and deterministic.
- [ ] UX mapping includes concrete rules for:

  - [ ] User-actionable vs non-actionable
  - [ ] Blocking vs non-blocking
  - [ ] Copy guidelines (short summary + details affordance)
- [ ] Diagnostics linkage defines what data is captured (and privacy constraints) and how it is referenced from an error.

## Agent Prompt

Draft an ADR for error taxonomy and user-facing error UX. Do not implement large code changes.

Context gathering steps:

- Search for existing error handling:

  - `throw new`, `Error(`, `console.error`, `reportError`, `toast`, `notification`, `snackbar`, `dialog`
- Search for existing telemetry/diagnostics concepts:

  - `diagnostic`, `bundle`, `log`, `trace`, `telemetry`
- Identify the major subsystems to cover:

  - UI, workers, DSP, device drivers, persistence

Write `docs/decisions/0004-error-taxonomy-user-facing-ux.md`.

Validation checklist:

- [ ] Error categories, severity, and retryability are explicitly defined.
- [ ] UX mapping table covers all categories with concrete surfaces.
- [ ] Diagnostics linkage is concrete (capture triggers, bundle reference id).
- [ ] ADR includes alternatives, rationale, consequences, and migration plan.
- [ ] Markdownlint-friendly formatting.
