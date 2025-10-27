Purpose: Establish a stable, token-first CSS architecture with predictable import order to ensure maintainability, accessibility, and theme consistency.

Structure (src/styles)

- tokens.css — Single source of truth for design tokens (colors in OKLCH, typography, spacing, radii, borders, shadows, motion, z-index). Must be imported first by the aggregator.
- base.css — Reset and base document scaffolding (global box-sizing/margins, body background/foreground, accent-color, #app min-height). No component styles here.
- a11y.css — Accessibility utilities and global focus indicators: .visually-hidden, .skip-link, :focus-visible ring, reduced-motion clamp, .live-region.
- components/ — One file per component family (e.g., buttons.css, cards.css, controls.css, playback.css, dialog.css, status-bar.css). Keep rules scoped to component classes.
- main.css — Aggregator only. Do not place component rules here.

Import order in main.css (top to bottom)

1. ./tokens.css
2. ./base.css
3. ./a11y.css
4. ./components/\*.css (ordered from generic to specific: buttons → cards → controls → playback → dialog → status-bar)

Rationale / Invariants

- Tokens-first enables consistent theming (WCAG AA-friendly focus rings, dark default) and simplifies refactors.
- a11y.css centralizes focus-visible rings and reduced-motion to keep accessible behavior consistent throughout.
- Component files should be cohesive and independently readable; avoid cross-file overrides. If two components interact, prefer adding a small combinator rule to the more specific component file.
- Prefer semantic tokens (var(--rad-primary), --rad-border, --rad-ring) over hard-coded colors. Exceptions can exist temporarily but should be tracked and replaced.

Paths

- Aggregator: src/styles/main.css
- Tokens: src/styles/tokens.css
- Base/A11y: src/styles/base.css, src/styles/a11y.css
- Components: src/styles/components/\*.css

Testing

- After structural edits, run lint → type-check → build → e2e. Visual diffs and a11y checks rely on consistent class names and focus tokens.
