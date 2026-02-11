# ADR: UI Architecture + Component Strategy

**ID:** P0-04-05  
**Roadmap:** Phase 0 / 0.4 Architecture “Irreversible Decisions” (ADRs)  
**Roadmap Description:** state boundaries (UI vs DSP), component library approach (custom vs headless), and theming/token strategy.

## Summary

Define the UI architecture boundaries and component strategy for rad.io: what is “UI state” vs “pipeline state”, how UI components are composed, and how theming/design tokens are implemented.

This ADR should lock decisions that would be expensive to reverse later:

- UI layer boundaries vs DSP/worker/pipeline logic boundaries.
- Component strategy (custom components vs headless primitives; accessibility expectations).
- Theming strategy (design tokens, CSS variables, light/dark, future extensibility).

## Deliverables

- Create folder `docs/decisions/` (if missing).
- Create ADR file `docs/decisions/0005-ui-architecture-component-strategy.md` with this outline:

  - Title, Status, Date
  - Context
    - UI complexity drivers (visualization, controls, performance)
  - Decision
    - Layering rules (UI, state, services, worker adapters)
    - Component strategy (what we build vs adopt)
    - Theming/tokens strategy (where tokens live, how applied)
    - Performance budgets (UI responsiveness, render targets)
  - Options considered
    - Fully custom design system
    - Headless primitives + custom styling
    - Full component library adoption
  - Consequences
  - Migration plan (if changing existing patterns)
  - Validation plan
  - Follow-ups

## Acceptance Criteria

- [ ] ADR exists at `docs/decisions/0005-ui-architecture-component-strategy.md` with standard ADR sections.
- [ ] Decision record rules are explicitly stated:

  - [ ] Alternatives considered (≥ 2) and rationale.
  - [ ] Consequences include accessibility, bundle size, and maintenance costs.
  - [ ] Migration plan is included if existing components/tokens must be refactored.
- [ ] UI vs pipeline boundaries are explicit (what can be in React/Zustand vs what must be in worker/pipeline services).
- [ ] Theming/token strategy is concrete (source of truth, naming, and application mechanism).
- [ ] Validation plan includes measurable UI budgets (e.g., interaction latency targets, rerender constraints) and how to verify.

## Agent Prompt

Draft an ADR for UI architecture and component strategy. Do not implement large code changes.

Context gathering steps:

- Locate UI framework and styling conventions:

  - Search for `src/components`, `src/ui`, `styled`, `css`, `tailwind`, `css variables`, `theme`
- Identify state boundaries referenced in docs:

  - Read `ARCHITECTURE.md` and any state/persistence guidance
- Identify existing UI patterns:

  - Common layout components, control components, visualization entry points

Write `docs/decisions/0005-ui-architecture-component-strategy.md`.

Validation checklist:

- [ ] ADR defines clear layering rules and what code belongs where.
- [ ] Component strategy is explicit (build vs adopt) with tradeoffs.
- [ ] Theming/tokens strategy is implementable (file location, naming, usage).
- [ ] Includes alternatives, rationale, consequences, and migration plan if relevant.
- [ ] Markdownlint-friendly formatting.
