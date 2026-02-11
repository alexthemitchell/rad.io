# ADR: SharedArrayBuffer Strategy

**ID:** P0-04-02  
**Roadmap:** Phase 0 / 0.4 Architecture “Irreversible Decisions” (ADRs)  
**Roadmap Description:** COOP/COEP requirements, fallback behavior, and feature degradations.

## Summary

Define when and how rad.io uses `SharedArrayBuffer` (SAB), including COOP/COEP prerequisites, runtime detection, and the exact “degraded mode” behavior when SAB is unavailable.

This ADR must treat SAB as an optimization, not a hard requirement, and must specify:

- Required headers/policies (COOP/COEP) and the deployment implications.
- How the app detects SAB availability at runtime.
- What features/performance characteristics degrade without SAB.
- How we test both paths and ensure the non-SAB path remains supported.

## Deliverables

- Create folder `docs/decisions/` (if missing).
- Create ADR file `docs/decisions/0002-sharedarraybuffer-strategy.md` with this outline:

  - Title, Status, Date
  - Context
    - Why SAB matters (copy avoidance, throughput)
    - Constraints (cross-origin isolation, hosting)
  - Decision
    - Policy: SAB optional; must have a fallback
    - Detection API and gating rules
    - Data transport rules when SAB is present vs absent
  - Options considered
    - Always require COOP/COEP and SAB
    - Optional SAB with fallback (recommended)
    - Never use SAB (simpler)
  - Consequences
    - Product/deploy implications
    - Perf implications
  - Validation plan
    - How to validate both paths, budgets, and degraded mode UX
  - Follow-ups

## Acceptance Criteria

- [ ] ADR exists at `docs/decisions/0002-sharedarraybuffer-strategy.md` with standard ADR sections.
- [ ] Decision record rules are explicitly stated:

  - [ ] Alternatives considered (≥ 2) with rationale.
  - [ ] Consequences include deploy, security, and performance tradeoffs.
  - [ ] Migration plan exists if this changes hosting or headers.
- [ ] SAB prerequisites are explicit (COOP/COEP and cross-origin isolation).
- [ ] A runtime detection approach is specified (exact checks and where they occur).
- [ ] Degraded mode is enumerated and concrete (what changes: max sample rate, buffer sizes, latency expectations, feature toggles).
- [ ] Validation plan includes a way to force both modes for testing (e.g., dev flag or test harness) and measurable budgets (throughput/latency).

## Agent Prompt

Draft an ADR that defines the `SharedArrayBuffer` strategy. Do not implement large code changes.

Context gathering steps:

- Search for existing SAB usage:

  - `SharedArrayBuffer`, `Atomics`, `crossOriginIsolated`, `COOP`, `COEP`
- Search for worker data transport patterns:

  - `postMessage(` with transfer lists, typed array usage, ring buffer implementations
- Check docs for deployment notes:

  - `docs/**/deploy*`, `docs/**/https*`, any hosting/config docs

Write `docs/decisions/0002-sharedarraybuffer-strategy.md`.

Validation checklist:

- [ ] ADR clearly states SAB is optional and defines a supported fallback.
- [ ] Includes explicit degraded-mode behaviors and user-visible impact.
- [ ] Includes measurable performance expectations for both modes.
- [ ] Includes security/deployment implications (headers, isolation).
- [ ] Includes a test strategy that prevents SAB-only regressions.
- [ ] Markdownlint-friendly formatting.
