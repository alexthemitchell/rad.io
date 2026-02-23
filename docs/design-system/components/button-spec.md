# Button Spec

## Purpose

Buttons trigger immediate actions (`Start`, `Stop`, `Retry`, `Export Diagnostics`).

## Anatomy

- Label (required, action verb).
- Optional icon.
- Optional status adornment (for long-running action).

## States

| State | Behavior |
| --- | --- |
| `default` | Action available. |
| `hover` | Visual emphasis only. |
| `active` | Pressed feedback while key/mouse is held. |
| `focus-visible` | Uses focus ring tokens. |
| `disabled` | Not actionable, includes reason text when context requires. |
| `loading` | Action in progress, prevents duplicate trigger. |

## Keyboard

- `Tab`: moves focus in document order.
- `Enter` and `Space`: activate focused button.
- `Escape`: does not trigger button action; reserved for enclosing context (for example modal cancel).

## Screen Reader Requirements

- Use native `button` role.
- Label must clearly express result (`Start stream`, `Retry connection`).
- Loading state must announce progress via adjacent `aria-live` status text.

## Error And Empty-State Considerations

- Blocking errors must expose a primary recovery button (`Retry` or `Reconnect`).
- Empty states may use a primary onboarding button (`Start`).

## Contract References

- `docs/ux/contracts/connection-ux-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
