# ADR 0005: UI Architecture and Component Strategy

## Status

Accepted

## Date

2026-02-23

## Context

The current UI is React-driven with canvas visualizations (`src/components/SpectrumCanvas.tsx`, `src/components/WaterfallCanvas.tsx`, `src/components/AudioScopeCanvas.tsx`) and worker-backed DSP processing. Styling is tokenized with CSS custom properties in `src/index.css`.

Phase 0.4 must prevent churn by locking:

- UI vs pipeline ownership boundaries.
- Component strategy (build vs adopt).
- Theming token source of truth.
- Performance budgets for responsiveness.

## Decision

Use a layered UI architecture with headless/native controls plus custom domain-specific visualization components.

### Layering Rules

- Presentation layer:
  - React components and canvas rendering only.
  - No DSP math, USB protocol logic, or stream loop ownership.
- UI state layer:
  - React state for view-local and interaction state.
  - Future shared UI store allowed only for cross-panel UI concerns.
- Service/adapter layer:
  - thin orchestration to communicate with worker and device adapters.
  - owns translation between UI intent and contract messages.
- Pipeline layer:
  - worker (`src/dsp/worker.ts`) and DSP modules own sample processing.
  - never depends on React component details.

### Component Strategy

- Domain components (spectrum, waterfall, audio scope, RF controls) remain custom.
- Standard controls (inputs, select, range, buttons) use native/headless HTML primitives styled via tokens.
- Avoid full UI framework dependency in Phase 0.4 to minimize bundle weight and styling lock-in.
- Accessibility requirements:
  - keyboard operability for all control surfaces.
  - live region updates for status/error changes.
  - visible focus states and contrast-compliant token combinations.

### Theming and Token Strategy

- Source of truth: CSS variables in `src/index.css` under `:root`.
- Naming convention:
  - semantic tokens (`--bg`, `--text`, `--accent`, `--warn`, `--error`).
  - typography tokens (`--font-ui`, `--font-mono`).
- Application rule:
  - components consume semantic tokens only; no hard-coded one-off colors in JSX unless visualization palette logic requires it.

### UI Performance Budgets

- Budgets align with `docs/reference/mvp-quality-budgets.md`:
  - visual cadence median `>= 50 FPS`.
  - tune apply latency p95 `<= 120 ms`.
  - time to first spectrum `<= 2.0 s`.
- Render policy:
  - throttle high-rate telemetry updates to UI cadence.
  - avoid full-tree rerenders for per-frame sample updates.

## Alternatives Considered

### Alternative A: Fully custom design system and widget stack

Rejected.

- Pros: maximal visual control.
- Cons: high maintenance cost and duplicated accessibility work.

### Alternative B: Headless primitives + custom styling and domain canvases

Accepted.

- Pros: strong control over RF-specific UX with lower dependency weight.
- Cons: requires deliberate consistency and internal component conventions.

### Alternative C: Full component library adoption

Rejected for Phase 0.4.

- Pros: faster generic UI assembly.
- Cons: bundle size growth, styling constraints, and mismatch with highly custom SDR visualization needs.

## Consequences

- Accessibility:
  - requires explicit a11y ownership in custom controls and canvas overlays.
- Bundle and runtime:
  - avoids heavy UI library overhead, helping startup and render budgets.
- Maintenance:
  - internal conventions and reusable primitives must be documented to avoid drift.

## Migration / Rollout Plan

- Keep existing UI functional while introducing folder-level separation:
  - `src/components/visualization/*`
  - `src/components/controls/*`
  - `src/ui/tokens.css` (optional extraction from `src/index.css`)
- Refactor incrementally per component; no big-bang rewrite.
- For each moved component, preserve behavior first, then improve structure.

## Validation Plan

- Add UI interaction latency checks around tune, mode switch, and start/stop actions.
- Capture render FPS and low-FPS event rates from existing runtime telemetry.
- Run keyboard-only traversal of all controls and diagnostics export path.
- Verify token usage by lint/style checks that flag hard-coded non-palette colors in non-visualization controls.

## Follow-Ups

- Document component layering rules in `docs/` architecture guidance.
- Add lightweight UI primitive set for labeled field, status banner, and action bar patterns.
- Add perf test harness for visualization cadence under Mock source load.
