# Toast And Alert

## Purpose

Provide transient and persistent system feedback with severity-aware behavior.

## Anatomy

- Severity indicator.
- Title and optional detail text.
- Optional action button.
- Optional dismiss action.

## Severity Levels

- `info`: contextual status with no immediate action required.
- `success`: confirmation of user-triggered completion.
- `warning`: degraded behavior or recoverable risk.
- `error`: failure requiring user acknowledgment or action.

## States

| State | Behavior |
| --- | --- |
| `default` | Message visible |
| `hover` | Pause auto-dismiss for toast |
| `focus-visible` | Action and dismiss controls are keyboard focusable |
| `dismissed` | Removed from visual layer and announcements |
| `stacked` | Multiple messages ordered newest first |

## Timing Rules

- Info and success toast auto-dismiss after 4 to 6 seconds.
- Warning toast auto-dismiss after 8 to 10 seconds unless action is required.
- Error toast does not auto-dismiss by default.
- Persistent alerts remain until resolved or explicitly dismissed.

## Modal Versus Toast Guidance

- Use toast when workflow can continue safely.
- Use alert banner for persistent non-blocking problems.
- Use modal only for blocking, destructive, or consent-required flows.

## Keyboard Behavior

- `Tab`: navigate action and dismiss controls.
- `Enter` and `Space`: trigger focused control.
- `Escape`: dismiss non-blocking toast if dismissible.

## Screen Reader Behavior

- Announce toast and alert text via live region.
- Severity prefix is announced first.
- Dismiss action has descriptive accessible name.

## UX Contract Alignment

- `docs/ux/contracts/connection-ux-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
- `docs/ux/contracts/audio-ux-contract.md`
