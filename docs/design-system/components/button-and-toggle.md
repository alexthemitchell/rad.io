# Button And Toggle

## Purpose

Define deterministic behavior for immediate actions (button) and persistent binary state changes (toggle).

## Anatomy

- Button: text label, optional icon, optional busy indicator.
- Toggle: visible label, binary control, explicit on/off value text.

## States

| State | Button Behavior | Toggle Behavior |
| --- | --- | --- |
| `default` | Action available | Current value shown and actionable |
| `hover` | Visual emphasis only | Visual emphasis only |
| `active` | Pressed feedback during pointer/key hold | Transitional feedback while switching |
| `focus-visible` | Focus ring token applied | Focus ring token applied |
| `disabled` | Not actionable and reason available when needed | Not changeable and reason available when needed |
| `loading` | Prevent duplicate submission during async action | Not applicable |

## Keyboard Behavior

- `Tab`: move focus by document order.
- `Enter`: activate focused button; toggle if toggle uses button semantics.
- `Space`: activate focused button; toggle focused toggle.
- `Escape`: does not trigger action; reserved for parent context.

## Screen Reader Behavior

- Button uses native `button` semantics.
- Toggle exposes checked state (`on` or `off`) and a descriptive label.
- Safety-relevant state changes (for example mute) announce via nearby `aria-live` status.

## Error And Empty-State Guidance

- Blocking errors provide a primary recovery button (`Retry`, `Reconnect`).
- Destructive or high-impact actions require explicit verb labels.
- Toggle state must remain reversible by keyboard only.

## UX Contract Alignment

- `docs/ux/contracts/connection-ux-contract.md`
- `docs/ux/contracts/audio-ux-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
- `docs/ux/contracts/keyboard-shortcut-contract.md`
