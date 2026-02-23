# Input Spec

## Purpose

Input controls capture explicit user values. MVP priority is numeric frequency entry with deterministic commit and cancel behavior.

## Anatomy

- Label with units where applicable (`MHz`).
- Text field.
- Optional helper text.
- Inline validation message region.

## States

| State | Behavior |
| --- | --- |
| `default` | Shows last committed value. |
| `editing` | User has uncommitted input. |
| `focus-visible` | Shows tokenized focus ring. |
| `invalid` | Shows actionable validation message; value not committed. |
| `disabled` | Not editable; reason required when operationally relevant. |

## Numeric Frequency Semantics

- Accept decimal MHz input in MVP.
- Commit on `Enter` and valid blur.
- Cancel pending edit on `Escape`, restoring last committed value.
- Reject out-of-range and invalid numeric input without mutating tuned state.
- Display fixed 3-decimal MHz format after commit.

## Keyboard

- `Tab`: focus input.
- `Enter`: commit valid value.
- `Escape`: cancel pending edits.
- Arrow stepping outside text-entry mode is governed by shortcut contract.

## Screen Reader Requirements

- Input must have programmatic label including units.
- Validation text must be announced by live region.
- After failed commit, focus remains on input.

## Contract References

- `docs/ux/contracts/frequency-entry-contract.md`
- `docs/ux/contracts/keyboard-shortcut-contract.md`
