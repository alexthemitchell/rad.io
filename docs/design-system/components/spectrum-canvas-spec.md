# Spectrum Canvas Spec

## Purpose

The spectrum canvas is an interactive visualization for signal discovery and retuning. It must provide deterministic tuning behavior and keyboard-equivalent interactions.

## Anatomy

- Frequency axis and tick labels.
- Spectrum trace.
- Tuned center marker.
- Optional selection marker/preview.
- Optional cursor readout.

## Interaction States

| State | Behavior |
| --- | --- |
| `idle` | No active gesture; display updates continue. |
| `hover` | Cursor readout available. |
| `selecting` | User click/drag gesture in progress. |
| `committed` | New tune target applied. |
| `disabled` | Interaction blocked while stream unavailable. |

## Pointer Semantics

- Click: retune toward nearest FFT bin center.
- Drag: continuous retune updates with rate limiting.
- Double-click: center tune on target.
- Wheel: step tune by current step size.
- `Shift + Wheel`: large step.
- `Alt + Wheel`: fine step.

## Keyboard Equivalence

- `ArrowLeft` and `ArrowRight`: tune down/up by base step.
- `Shift + ArrowLeft` and `Shift + ArrowRight`: large step.
- `Alt + ArrowLeft` and `Alt + ArrowRight`: fine step.
- `Enter`: commit highlighted target when keyboard targeting mode is active.
- `Escape`: cancel in-progress drag/targeting operation.

## Screen Reader Requirements

- Provide non-canvas control equivalents for all tuning actions.
- Announce committed frequency changes via live region.
- Canvas region must have programmatic label and instructions reference.

## Error And Empty-State Behavior

- When stream is unavailable, canvas indicates non-interactive state and points user to `Start` or `Reconnect`.
- On render overload warning, retain tuning controls and surface mitigation action.

## Contract References

- `docs/ux/contracts/tuning-interaction-contract.md`
- `docs/ux/contracts/frequency-entry-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
