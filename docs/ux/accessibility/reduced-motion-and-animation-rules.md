# Reduced Motion And Animation Rules

## Purpose

Define which animations are allowed in MVP, which must be disabled under reduced-motion preference, and which dynamic behaviors remain necessary for system comprehension.

## Baseline Rules

1. Motion must communicate state change or orientation, not decoration.
2. No animation may be required to perceive error, focus, or selection state.
3. Animations must never block input handling.

## Behavior Under `prefers-reduced-motion: reduce`

The following must stop or become effectively instant:

- Panel entrance/exit transitions.
- Banner slide/fade transitions.
- Button/toggle decorative micro-animations.
- Non-essential shimmer, pulse, or attention animations.

The following may continue:

- Data-driven spectrum/waterfall updates (core function of app).
- Essential cursor/readout updates during tuning.

## Timing Contract

- Default UI transition budget: short and non-blocking.
- Reduced-motion mode: transitions collapse to instant state changes.
- Live region announcement timing is unchanged by reduced-motion mode.

## Flashing And Intensity Constraints

- Avoid high-frequency flashing status indicators.
- Warning/error emphasis must use persistent contrast and text, not repeated flashing.

## Validation Checklist

- [ ] Reduced-motion preference disables non-essential transitions.
- [ ] Focus and status visibility remains clear without animation.
- [ ] Spectrum/waterfall remains usable and performant.
- [ ] No animation-dependent affordance remains.
