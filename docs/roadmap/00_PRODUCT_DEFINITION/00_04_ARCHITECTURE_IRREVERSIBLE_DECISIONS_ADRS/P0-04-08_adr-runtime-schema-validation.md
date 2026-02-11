# ADR: Runtime Schema Validation

**ID:** P0-04-08  
**Roadmap:** Phase 0 / 0.4 Architecture “Irreversible Decisions” (ADRs)  
**Roadmap Description:** where/how to validate messages/state (e.g., Zod at boundaries) without perf cliffs.

## Summary

Decide where and how rad.io performs runtime schema validation at system boundaries (worker messages, device IO, file imports, persistence reads) without creating performance cliffs.

This ADR must establish:

- Validation boundaries (“contracts first”): what must be validated at runtime and what can be trusted.
- Library/approach (e.g., Zod) and how it’s applied (dev-only vs prod, sampling, handshake-only).
- How validation failures are surfaced (ties into error taxonomy ADR).

## Deliverables

- Create folder `docs/decisions/` (if missing).
- Create ADR file `docs/decisions/0008-runtime-schema-validation.md` with this outline:

  - Title, Status, Date
  - Context
    - Why runtime validation is needed (untrusted boundaries)
    - Perf constraints
  - Decision
    - Boundary list and validation policy per boundary
    - Library choice and why
    - Production vs development behavior (e.g., strict vs sampled)
    - Failure handling (error codes, UX surface)
  - Options considered
    - No runtime validation
    - Validate everything (slow but safe)
    - Validate at boundaries only (recommended)
  - Consequences
  - Migration plan
    - How to introduce validation incrementally
  - Validation plan
    - Perf measurements and correctness tests
  - Follow-ups

## Acceptance Criteria

- [ ] ADR exists at `docs/decisions/0008-runtime-schema-validation.md` with standard ADR sections.
- [ ] Decision record rules are explicitly stated:

  - [ ] Alternatives considered (≥ 2) and rationale.
  - [ ] Consequences include runtime cost, developer ergonomics, and safety.
  - [ ] Migration plan exists for incremental rollout.
- [ ] Validation boundaries are enumerated (at least: worker messages, WebUSB/device IO, file parsing/import, persistence reads).
- [ ] Performance strategy is explicit (avoid validating hot loops; validate handshakes/envelopes; define prod/dev policy).
- [ ] Validation failures are mapped to the error taxonomy and user-facing UX rules.

## Agent Prompt

Draft an ADR for runtime schema validation. Do not implement large code changes.

Context gathering steps:

- Identify boundaries where untrusted data enters:

  - Workers: `postMessage`, `onmessage`
  - Device: WebUSB driver code
  - Files: upload/import/recording decode
  - Persistence: IndexedDB/localStorage reads
- Identify existing validation libraries/patterns:

  - Search for `zod`, `parse`, `safeParse`, `schema`, `validate`
- Identify hot paths that must avoid overhead:

  - DSP loops, sample processing, render loops

Write `docs/decisions/0008-runtime-schema-validation.md`.

Validation checklist:

- [ ] Enumerates boundaries and defines policy per boundary.
- [ ] Avoids perf cliffs with an explicit strategy (handshake-only, sampling, dev/prod modes).
- [ ] Specifies failure handling and ties to error taxonomy ADR.
- [ ] Includes alternatives, rationale, consequences, and migration plan.
- [ ] Markdownlint-friendly formatting.
