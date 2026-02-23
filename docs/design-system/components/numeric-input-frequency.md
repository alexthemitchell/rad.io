# Numeric Input Frequency

## Purpose

Capture and validate explicit frequency entry with deterministic commit and cancel semantics.

## Anatomy

- Label including units.
- Single-line text entry.
- Inline validation region.
- Helper text for supported formats and range.

## States

| State | Behavior |
| --- | --- |
| `default` | Shows last committed value |
| `editing` | Contains uncommitted text |
| `focus-visible` | Focus ring visible |
| `invalid` | Error text visible, no retune committed |
| `disabled` | Not editable and reason available when needed |

## Parsing And Validation

- Accept decimal MHz and integer Hz forms.
- Strip visual separators before parse.
- Reject malformed input, out-of-range values, and unsupported suffixes.
- Validation is synchronous on commit and asynchronous checks are advisory only.

## Formatting

- Display committed value in fixed format (default: MHz with three decimals).
- Preserve user text only during `editing`; revert to canonical formatting after commit or cancel.

## Commit And Cancel

- `Enter`: commit valid input and retune.
- `Blur`: commit if valid; otherwise stay in invalid state and keep focus guidance visible.
- `Escape`: cancel edit and restore last committed value.
- Invalid commit attempts do not mutate tuned state.

## Error Messaging Guidance

- Use actionable messages such as `Enter a value between 24.000 MHz and 1766.000 MHz`.
- Include units and legal range.
- Keep message visible until corrected or canceled.

## Keyboard Behavior

- `Tab`: move focus in and out of control.
- `Enter`: commit valid value.
- `Escape`: cancel pending edits.

## Screen Reader Behavior

- Programmatic label includes unit and purpose.
- Validation region announced via polite live region.
- On invalid commit, focus remains in input.

## UX Contract Alignment

- `docs/ux/contracts/frequency-entry-contract.md`
- `docs/ux/contracts/tuning-interaction-contract.md`
- `docs/ux/contracts/keyboard-shortcut-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
