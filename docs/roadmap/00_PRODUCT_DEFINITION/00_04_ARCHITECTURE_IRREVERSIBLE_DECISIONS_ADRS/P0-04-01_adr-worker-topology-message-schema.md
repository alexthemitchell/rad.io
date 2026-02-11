# ADR: Worker Topology + Message Schema

**ID:** P0-04-01  
**Roadmap:** Phase 0 / 0.4 Architecture “Irreversible Decisions” (ADRs)  
**Roadmap Description:** single vs multiple workers, schema versioning, and compatibility strategy.

## Summary

Define the “must not churn” execution topology for rad.io’s UI + DSP pipeline and lock a single, versioned message schema strategy for cross-thread communication.

This ADR must answer:

- How many workers exist in Phase 0.4 (one DSP worker vs multiple workers by concern).
- What runs on the main thread vs worker(s) vs (optional) AudioWorklet.
- How messages are defined (TypeScript-first), validated (if at all), versioned, and migrated.
- How compatibility works across future refactors (schema evolution rules).

## Deliverables

- Create folder `docs/decisions/` (if missing).
- Create ADR file `docs/decisions/0001-worker-topology-message-schema.md` with this outline:
  - Title, Status (Proposed/Accepted), Date
  - Context
    - Current worker usage (if any) and bottlenecks/risks
    - Performance budgets (message rate, latency, GC pressure)
  - Decision
    - Worker topology diagram (text/ASCII is fine)
    - Thread ownership rules (UI state vs DSP state)
    - Transport rules (Transferable `ArrayBuffer` vs `SharedArrayBuffer` when available)
  - Options considered (2–4)
    - Single DSP worker
    - Split workers (DSP, visualization/precompute, IO)
    - AudioWorklet for sink timing
  - Consequences (positive/negative)
  - Compatibility & versioning
    - Message envelope (must include `schemaVersion`)
    - Backward/forward compatibility rules
    - Deprecation process
  - Validation plan
    - Concrete measurements and how to run them
  - Follow-ups
    - Concrete file paths / schemas to add later (non-breaking)

## Acceptance Criteria

- [ ] ADR exists at `docs/decisions/0001-worker-topology-message-schema.md` and uses consistent ADR sections (Context, Decision, Options considered, Consequences, Validation plan, Follow-ups).
- [ ] Decision record rules are explicitly stated:
  - [ ] At least 2 alternatives are documented, with why they were rejected.
  - [ ] Rationale is explicit and ties back to Phase 0 budgets and “contracts first”.
  - [ ] Consequences include both benefits and costs/risks.
  - [ ] Migration plan is included if the decision affects existing/public contracts (e.g., message envelope changes).
- [ ] A concrete message envelope contract is specified (minimum required fields, including `schemaVersion`).
- [ ] A concrete schema evolution strategy is specified (additive changes, removals, renames, defaulting).
- [ ] Validation plan is measurable (e.g., target p95 message latency, max payload sizes, CPU budget) and includes how it will be verified.

## Agent Prompt

You are drafting an Architecture Decision Record (ADR) for worker topology and message schema/versioning. Do not implement large code changes; focus on producing a crisp, implementable ADR that prevents future churn.

Context gathering (repo-first, minimal reading):

- Search for existing worker/message patterns:
  - `Worker(`, `new Worker`, `postMessage`, `onmessage`, `MessagePort`, `Comlink`, `structuredClone`
  - `src/**/worker*`, `src/**/workers/**`, `src/**/messages/**`
- Search for existing type- or schema-validation tooling:
  - `zod`, `valibot`, `io-ts`, `ajv`, `superstruct`, `parse(` patterns at boundaries
- Search for performance notes/budgets:
  - `docs/**/budget*`, `ARCHITECTURE.md`, any `docs/decisions/` if present

Write the ADR at `docs/decisions/0001-worker-topology-message-schema.md` using the Deliverables outline.

Validation checklist:

- [ ] ADR includes a clear decision statement, not a discussion.
- [ ] Alternatives considered are real options and include tradeoffs.
- [ ] Includes measurable budgets and a plan to verify them.
- [ ] Message envelope includes `schemaVersion` and explicit compatibility rules.
- [ ] Mentions how the design behaves without `SharedArrayBuffer` (fallback path), even if SAB is covered by a separate ADR.
- [ ] Markdown is markdownlint-friendly (blank line after headings, consistent list formatting, no trailing spaces).
