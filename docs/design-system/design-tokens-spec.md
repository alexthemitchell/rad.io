# Design Tokens Specification

## Purpose

Define semantic, accessibility-first tokens for `rad.io` UI. Tokens are intent-based contracts used by components and layouts. Components must consume tokens instead of hard-coded values.

## Scope

- MVP app shell and control surfaces.
- MVP component states (`default`, `hover`, `active`, `focus-visible`, `disabled`, `error`, `success`, `warning`).
- Dark-first operating context with testable contrast targets.

## Token Categories

| Category | Prefix | Purpose | Example |
| --- | --- | --- | --- |
| Color (semantic) | `--color-*` | Surfaces, text, borders, status, accents | `--color-surface-1` |
| Typography | `--font-*`, `--text-*` | Family, size, weight, line-height | `--text-size-2` |
| Spacing | `--space-*` | Padding, gaps, margins, dense layouts | `--space-3` |
| Radii | `--radius-*` | Corner rounding consistency | `--radius-2` |
| Borders | `--border-*` | Border width/style emphasis | `--border-width-1` |
| Elevation | `--elevation-*` | Layer separation (panels, overlays) | `--elevation-2` |
| Focus | `--focus-*` | Keyboard-visible focus treatment | `--focus-ring-color` |
| Motion | `--motion-*` | Durations, easing, reduced-motion fallback | `--motion-duration-fast` |

## Semantic Color Roles

Color tokens must describe intent, not implementation detail.

| Role | Required Variants |
| --- | --- |
| `surface` | `base`, `raised`, `overlay`, `disabled` |
| `text` | `primary`, `secondary`, `muted`, `inverse`, `disabled` |
| `border` | `subtle`, `default`, `strong`, `focus` |
| `accent` | `default`, `hover`, `active`, `disabled`, `on-accent` |
| `success` | `default`, `soft-bg`, `on-success` |
| `warning` | `default`, `soft-bg`, `on-warning` |
| `danger` | `default`, `soft-bg`, `on-danger` |
| `info` | `default`, `soft-bg`, `on-info` |
| `visualization` | `grid`, `trace`, `peak`, `noise-floor`, `selection` |

## Typography Scale

Use a predictable scale for control-heavy UI.

| Token | Intended Use |
| --- | --- |
| `--text-size-0` | Dense metadata and helper labels |
| `--text-size-1` | Default control labels and values |
| `--text-size-2` | Section headings in panels |
| `--text-size-3` | Primary frequency readout |
| `--text-size-4` | Modal and critical status headings |

Rules:

- Frequency readouts and live metrics should use tabular numerals when available.
- Minimum body/control text size is `--text-size-1`.
- Do not use typography tokens to encode severity; use status color and copy.

## Spacing Scale

| Token | Typical Use |
| --- | --- |
| `--space-0` | No gap |
| `--space-1` | Tight inline spacing |
| `--space-2` | Dense control grouping |
| `--space-3` | Default control spacing |
| `--space-4` | Panel section spacing |
| `--space-5` | Large layout separation |
| `--space-6` | Page-level rhythm |

Rules:

- Controls in the same task cluster use a maximum 2-step spacing delta.
- Layout spacing must remain stable across connection and error states.

## Radii, Borders, And Elevation

- Radii are tiered (`none`, `sm`, `md`, `lg`) and reused across all components.
- Border widths are limited to `1` and `2` units to avoid visual noise.
- Elevation must communicate hierarchy only:
  - `--elevation-0`: base surface
  - `--elevation-1`: raised controls/panels
  - `--elevation-2`: overlays and critical transient UI

## Focus Tokens And Behavior

Focus visibility is non-negotiable for keyboard operation.

Required tokens:

- `--focus-ring-color`
- `--focus-ring-width`
- `--focus-ring-offset`
- `--focus-ring-shadow`

Rules:

- `:focus-visible` must be clearly distinct from hover and active states.
- Focus ring must remain visible against all supported surfaces.
- Components may not suppress focus outlines without replacing with tokenized ring treatment.

## Motion Tokens And Rules

Required tokens:

- `--motion-duration-instant`
- `--motion-duration-fast`
- `--motion-duration-standard`
- `--motion-ease-standard`
- `--motion-ease-emphasis`

Rules:

- Motion should reinforce state transitions, not decorate controls.
- Under reduced-motion preferences, non-essential motion is removed and remaining transitions use `--motion-duration-instant`.
- Visualizations (spectrum/waterfall) may continue data-driven updates, but decorative animated affordances must stop.

## Contract With Components

- Component specs under `docs/design-system/components/` must reference these token categories.
- New tokens require documenting intent and reuse rationale in `docs/design-system/token-naming-and-usage.md`.
- Contrast requirements are defined in `docs/design-system/theme-contrast-requirements.md` and are mandatory.
