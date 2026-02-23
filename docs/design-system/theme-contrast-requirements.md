# Theme Contrast Requirements

## Purpose

Define minimum contrast and visibility requirements for `rad.io` themes, including text, controls, focus indicators, and data visualizations.

## Minimum Contrast Targets

| Element Type | Minimum Target |
| --- | --- |
| Body text and control labels | `4.5:1` |
| Large text (`>= 18px` regular or `>= 14px` bold) | `3:1` |
| Non-text UI indicators (borders/icons) | `3:1` |
| Focus ring against adjacent surface | `3:1` |
| Critical status indicators (`danger`, blocking error) | `4.5:1` for text |

## Required Pairings

- `text-primary` on `surface-base`: must pass `4.5:1`.
- `text-secondary` on `surface-base`: must pass `4.5:1` for default body size.
- `on-accent` on `accent-*`: must pass `4.5:1`.
- `on-danger` on `danger-*`: must pass `4.5:1`.
- Focus ring token on all interactive surfaces: must pass `3:1`.

## Verification Procedure

1. Validate token pairs in design token tables before component-level use.
2. Validate representative component states (`default`, `hover`, `active`, `focus-visible`, `disabled`, `error`).
3. Manually verify keyboard focus visibility across all critical paths.
4. Validate status banners and alerts in `warning` and `danger` conditions.

## Charts, Spectrum, And Waterfall Guidance

Data visualizations use different perceptual rules from body text. Apply these constraints:

- Gridlines and reference markers must remain visible against waterfall background at `>= 3:1` where practical.
- Selected signal marker and tuned center indicator must be visually distinct from peak traces.
- Status cues in visualizations must not rely on color alone; pair with labels or glyphs.
- If a color scale prioritizes dynamic range over strict text contrast, place readable labels on a separate high-contrast surface.

## Reduced Motion And Contrast Stability

- Reduced motion may remove transitions but must not remove contrast cues.
- Focus, error, and selection states remain visually persistent even when animation is disabled.

## Failure Handling

If a contrast target is missed:

1. Treat as a release-blocking issue for the affected MVP flow.
2. Update token definitions first, then downstream component mappings.
3. Re-verify related components and state combinations.
