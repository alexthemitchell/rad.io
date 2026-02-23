# Dropdown

## Purpose

Present a constrained list of choices such as source selection, demod mode, or preset options.

## Anatomy

- Field label.
- Trigger button displaying current value.
- Popup listbox with options.
- Optional helper and error text.

## States

| State | Behavior |
| --- | --- |
| `default` | Current selection shown |
| `open` | Popup list visible |
| `focus-visible` | Trigger or active option has focus ring |
| `disabled` | No interaction allowed |
| `invalid` | Error message shown when selection required |

## Keyboard Behavior

- `Tab`: focus trigger.
- `Enter` and `Space`: open list when trigger focused.
- `ArrowDown`: open list and move to next option.
- `ArrowUp`: open list and move to previous option.
- `Home` and `End`: jump to first or last option while open.
- `Enter`: commit active option while open.
- `Escape`: close without changing value.

## Screen Reader Behavior

- Trigger announces expanded state and selected option.
- Option count and current position are announced while navigating.
- Selection commit announces resulting value.

## Error And Empty-State Guidance

- Empty option sets show non-interactive placeholder with recovery guidance.
- Invalid state explains what selection is required to continue.

## UX Contract Alignment

- `docs/ux/contracts/connection-ux-contract.md`
- `docs/ux/contracts/tuning-interaction-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
