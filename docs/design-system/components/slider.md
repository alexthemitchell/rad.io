# Slider

## Purpose

Control bounded continuous or stepped numeric parameters such as gain, squelch, and filter width.

## Anatomy

- Label with unit.
- Track.
- Thumb.
- Optional tick marks with min and max labels.
- Current value readout.

## States

| State | Behavior |
| --- | --- |
| `default` | Value shown, idle |
| `hover` | Optional visual emphasis |
| `dragging` | Continuous updates while pointer drag is active |
| `focus-visible` | Thumb focus clearly visible |
| `disabled` | No updates accepted |

## Keyboard Behavior

- `Tab`: focus the thumb.
- `ArrowLeft` and `ArrowDown`: decrement by one step.
- `ArrowRight` and `ArrowUp`: increment by one step.
- `PageDown`: decrement by large step.
- `PageUp`: increment by large step.
- `Home`: jump to minimum.
- `End`: jump to maximum.

## Screen Reader Behavior

- Expose min, max, and current value.
- Include units in announced value text when relevant.
- During rapid updates, final settled value must always be announced.

## Error And Empty-State Guidance

- If capability is not available from device/source, disable slider with an explanatory reason.
- Persisted out-of-range values clamp to nearest legal value and emit a diagnostics event.

## UX Contract Alignment

- `docs/ux/contracts/tuning-interaction-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
