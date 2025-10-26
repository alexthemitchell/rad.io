# Accessibility Guide

This project implements accessible patterns across controls and visualizations. This guide summarizes what exists in the code today and how to extend it safely.

## Keyboard and Interaction

Interactive visualizations expose keyboard handlers and focus:

- Canvases use `tabIndex={0}` to be focusable where appropriate.
- Handlers include `onKeyDown` for panning/zooming.
- See:
  - `src/hooks/useVisualizationInteraction.ts`
  - `src/components/IQConstellation.tsx`
  - `src/components/Spectrogram.tsx`
  - `src/components/WaveformVisualizer.tsx`

Common key mappings (as implemented in handlers/tests):

- Arrow keys: pan
- Plus/Minus: zoom
- 0: reset view

## ARIA and Roles

The UI uses ARIA roles and labels to describe purpose and state:

- Grouping and status
  - `role="group"` for grouped controls (e.g., Audio controls, Presets)
  - `role="status"` with `aria-live="polite"` for dynamic text
- Buttons and toggles
  - `aria-pressed` for toggle buttons (Signal type, Presets)
- Range and progress indicators
  - `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
- Sections and regions
  - `section` with `aria-labelledby` in `Card`
  - Regions labeled for assistive tech (e.g., "Signal visualizations")
- Visualizations
  - Canvases use `role="img"` and descriptive `aria-label`

Examples in code:

- `src/components/AudioControls.tsx`
- `src/components/SignalTypeSelector.tsx`
- `src/components/PresetStations.tsx`
- `src/components/SignalStrengthMeter.tsx`
- `src/components/Card.tsx`
- `src/pages/Visualizer.tsx`

## Live Regions

Dynamic messages (e.g., audio status) use `aria-live="polite"` so screen readers receive updates without interrupting the user.

## Testing Accessibility

The repository includes tests that assert ARIA attributes and keyboard handlers:

- `src/components/__tests__/Accessibility.test.tsx`
- `src/components/__tests__/AudioControls.test.tsx`
- `src/components/__tests__/SignalStrengthMeter.test.tsx`
- `src/hooks/__tests__/useVisualizationInteraction.test.ts`

When adding components:

- Provide `aria-label` or `aria-labelledby` for non-text controls.
- Ensure focusable elements have visible focus.
- Include keyboard handlers where interaction is possible.
- Add tests asserting ARIA attributes and keyboard behavior.

## Guidelines

- Prefer semantic elements first; use ARIA roles to enhance, not replace semantics.
- Keep `aria-label` concise and specific.
- Announce dynamic state changes via `aria-live` when applicable.
- Validate with automated tests and manual screen reader spot checks.

If you update patterns or add new ones, extend the tests and reference files above to keep this guide accurate.

## Writing accessible documentation

Follow these quick checks when updating docs in this repo:

- Use descriptive image alt text that conveys purpose, not just file names.
- Write meaningful link text (avoid “here”); links should make sense out of context.
- Maintain a logical heading order (don’t skip levels).
- Treat emojis as decorative; don’t rely on them to carry meaning by themselves.

Additional resource:

- GitHub blog – 5 tips for making your GitHub profile page accessible: https://github.blog/developer-skills/github/5-tips-for-making-your-github-profile-page-accessible/
