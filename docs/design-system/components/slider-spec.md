# Slider Spec

## Purpose

Slider controls adjust continuous numeric values (for example gain, squelch, bandwidth).

## Anatomy

- Label and current value readout.
- Track.
- Thumb.
- Optional tick marks and min/max labels.

## States

| State | Behavior |
| --- | --- |
| `default` | Value shown, no active input. |
| `hover` | Optional visual emphasis only. |
| `dragging` | Continuous value updates while pointer drag is active. |
| `focus-visible` | Thumb focus clearly visible. |
| `disabled` | No updates accepted. |

## Keyboard

- `Tab`: focus slider thumb.
- `ArrowLeft` and `ArrowDown`: decrement by one step.
- `ArrowRight` and `ArrowUp`: increment by one step.
- `PageUp` and `PageDown`: large step.
- `Home`: set to min.
- `End`: set to max.

## Screen Reader Requirements

- Expose current value, minimum, and maximum.
- Value text should include unit when relevant (`dB`, `kHz`).
- Rapid pointer updates may be rate-limited, but final value must be announced.

## Error And Empty Considerations

- If source capability does not include parameter, slider is disabled with explanatory text.
- Invalid out-of-range values from persisted state clamp to nearest valid value and log a diagnostic event.

## Contract References

- `docs/ux/contracts/tuning-interaction-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
