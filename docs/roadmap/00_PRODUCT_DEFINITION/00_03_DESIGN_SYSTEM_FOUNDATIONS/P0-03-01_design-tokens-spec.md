# Design Tokens Spec

**ID:** P0-03-01  
**Roadmap:** Phase 0 / 0.3 Design System Foundations  
**Roadmap Description:** CSS variables for spacing, typography scale, elevation, focus rings, and semantic colors.

## Summary

Define the design tokens specification for rad.io: semantic color tokens, typography scale, spacing, elevation, focus rings, and motion. Tokens must be semantic (intent-based) rather than component-specific, support dark-first UI, and provide an accessibility baseline.

This spec is the contract between UX and implementation: components should reference tokens, not hard-coded values.

## Deliverables

- docs/design-system/design-tokens-spec.md
- docs/design-system/token-naming-and-usage.md
- docs/design-system/theme-contrast-requirements.md

## Acceptance Criteria

- [ ] docs/design-system/design-tokens-spec.md defines token categories: color (semantic), typography, spacing, radii, elevation, borders, focus, and motion.
- [ ] Color tokens are semantic (e.g., surface, text, accent, danger) and include states (default, hover, active, disabled).
- [ ] Focus tokens specify visible focus ring behavior for keyboard navigation.
- [ ] docs/design-system/theme-contrast-requirements.md defines minimum contrast targets and how to verify them.
- [ ] docs/design-system/token-naming-and-usage.md includes at least 10 “Do” examples and 10 “Don’t” examples.

## Agent Prompt

You are writing the design tokens spec for rad.io.

Context

- rad.io is a technical web app where readability, focus visibility, and low-glare dark UI matter.
- Tokens are the foundation of component consistency and accessibility.

Required outputs

- Create docs/design-system/design-tokens-spec.md:

  - Token categories and definitions.
  - Semantic color roles and required variants.
  - Typography scale and usage guidance.
  - Spacing scale and layout guidance.
  - Focus and motion rules.
- Create docs/design-system/token-naming-and-usage.md:

  - Naming convention (e.g., --color-surface-1, --text-primary).
  - Guidance for when to add a new token vs reuse.
  - Examples and anti-patterns.
- Create docs/design-system/theme-contrast-requirements.md:

  - Minimum contrast targets.
  - Approach for reduced motion.
  - Notes for charts/waterfalls where contrast differs from text.

Non-goals

- Do not implement CSS or components.
- Do not define brand marketing visuals; focus on usability.

Validation plan

- Verify tokens are semantic and usable across multiple components.
- Ensure focus visibility and contrast requirements are explicit.
- Ensure no TODOs and markdownlint-friendly formatting.
