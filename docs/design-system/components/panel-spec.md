# Panel Spec

## Purpose

Panels group related controls, status, and readouts into scannable functional regions.

## Anatomy

- Panel title.
- Optional status line.
- Content region.
- Optional actions row.

## States

| State | Behavior |
| --- | --- |
| `expanded` | Content visible and interactive. |
| `collapsed` | Content hidden, summary still visible. |
| `error` | Shows inline blocking/non-blocking issue summary and action. |
| `disabled` | Content visible but controls are non-interactive. |

## Keyboard

- `Tab`: enters panel controls in DOM order.
- `Enter` or `Space` on panel header toggle (if collapsible): expand/collapse.
- `Escape`: closes only panel-local popovers; does not collapse by default.

## Screen Reader Requirements

- Panels require programmatic name.
- Collapsible panels expose expanded/collapsed state.
- Error summaries include actionable next step.

## Layout Rules

- Panel order must remain stable across connection and recovery states.
- Critical actions (`Start`, `Stop`, `Reconnect`) remain visible without opening hidden panels.

## Contract References

- `docs/ux/contracts/connection-ux-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
