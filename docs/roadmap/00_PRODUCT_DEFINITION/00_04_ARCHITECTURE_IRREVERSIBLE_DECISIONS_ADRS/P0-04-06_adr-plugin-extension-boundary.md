# ADR: Plugin/Extension Boundary (Future-Proofing)

**ID:** P0-04-06  
**Roadmap:** Phase 0 / 0.4 Architecture “Irreversible Decisions” (ADRs)  
**Roadmap Description:** define extension points and constraints even if plugins ship later.

## Summary

Define the plugin/extension boundary for rad.io (even if plugins ship later): what can be extended, what cannot, and what constraints must be preserved (security, performance, stability, versioning).

This ADR should minimize future churn by pre-committing to:

- Candidate extension points and their contracts.
- Compatibility and versioning rules for extension APIs.
- Sandbox/capability constraints (especially for untrusted code).

## Deliverables

- Create folder `docs/decisions/` (if missing).
- Create ADR file `docs/decisions/0006-plugin-extension-boundary.md` with this outline:

  - Title, Status, Date
  - Context
    - Why define boundary now (future-proofing without overbuilding)
  - Decision
    - Supported extension points (candidate list) and non-goals
    - Contract-first approach (typed interfaces + versioning)
    - Security model (capabilities, sandboxing, no direct DOM access)
    - Performance model (worker isolation, budgets)
  - Options considered
    - No plugins ever
    - Internal-only extension points
    - Public plugin API with sandboxing (future)
  - Consequences
  - Migration plan
    - How to evolve extension APIs without breaking existing plugins
  - Validation plan
    - How to test compatibility and enforce constraints
  - Follow-ups

## Acceptance Criteria

- [ ] ADR exists at `docs/decisions/0006-plugin-extension-boundary.md` with standard ADR sections.
- [ ] Decision record rules are explicitly stated:

  - [ ] Alternatives considered (≥ 2) and rationale.
  - [ ] Consequences include security, performance, and maintenance tradeoffs.
  - [ ] Migration plan includes API versioning and deprecation strategy.
- [ ] Extension points are enumerated with a first-pass contract shape (even if only sketched), covering at least:

  - [ ] Sources (Mock/File/WebUSB)
  - [ ] DSP stages/demodulators
  - [ ] Visualizations
  - [ ] Exporters/recording formats
- [ ] Constraints are explicit: sandboxing, capability-based APIs, resource budgets, and stability expectations.

## Agent Prompt

Draft an ADR defining plugin/extension boundaries and constraints. Do not implement large code changes.

Context gathering steps:

- Search for existing “capability” or “registry” patterns:

  - `capability`, `registry`, `plugin`, `extension`, `adapter`, `factory`
- Identify existing abstractions that resemble extension points:

  - Source interfaces, DSP pipeline composition, visualization registration
- Check roadmap terms:

  - Ensure ADR uses “contracts first”, “budgets”, and “degraded mode” where applicable

Write `docs/decisions/0006-plugin-extension-boundary.md`.

Validation checklist:

- [ ] Lists extension points and explicitly states non-goals.
- [ ] Defines versioning/deprecation strategy for extension contracts.
- [ ] Defines security constraints (capabilities, sandboxing assumptions).
- [ ] Defines performance constraints/budgets and enforcement approach.
- [ ] Includes alternatives, rationale, consequences, and migration plan.
- [ ] Markdownlint-friendly formatting.
