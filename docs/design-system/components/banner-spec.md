# Banner Spec

## Purpose

Banners communicate persistent contextual status and required next steps, especially for connection, permission, and recovery states.

## Anatomy

- Severity indicator (`info`, `warning`, `error`, `success`).
- Message text (what happened).
- Primary action (what to do next).
- Optional secondary action (for example diagnostics export).

## States

| State | Behavior |
| --- | --- |
| `info` | Informational, no interruption. |
| `warning` | Non-blocking risk or degraded operation. |
| `error` | Blocking condition with recovery action. |
| `success` | Completion confirmation for transient workflows. |

## Keyboard

- `Tab`: actions reachable in order.
- `Enter` and `Space`: activate focused banner action.
- `Escape`: dismiss only if banner is dismissible and non-blocking.

## Screen Reader Requirements

- Use live region for newly displayed banner text.
- Action labels must be explicit (`Retry`, `Reconnect`, `Export diagnostics`).
- Severity must be available in text, not color alone.

## Timing And Persistence Rules

- Blocking errors remain until trigger resolves or user acts.
- Warnings may auto-dismiss only if condition clears and no action is required.
- If multiple banners are active, show highest severity first.

## Contract References

- `docs/ux/contracts/empty-and-error-state-catalog.md`
- `docs/ux/contracts/connection-ux-contract.md`
- `docs/ux/contracts/audio-ux-contract.md`
