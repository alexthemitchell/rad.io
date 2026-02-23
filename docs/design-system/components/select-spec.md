# Select Spec

## Purpose

Select controls choose from a bounded set of valid options (for example source type and demod mode).

## Anatomy

- Label.
- Trigger button with current value.
- Listbox popup with options.
- Optional option descriptions.

## States

| State | Behavior |
| --- | --- |
| `closed` | Shows current selection only. |
| `open` | Listbox displayed; one active option. |
| `focus-visible` | Trigger or option focus is visible. |
| `disabled` | Cannot open or change selection. |

## Keyboard

- `Tab`: focus trigger.
- `Enter` or `Space`: open listbox.
- `ArrowUp` and `ArrowDown`: move active option.
- `Home` and `End`: move to first/last option.
- `Enter`: commit active option and close.
- `Escape`: close without changing selection.

## Screen Reader Requirements

- Trigger exposes current value and expanded state.
- Listbox/options expose active and selected state.
- Selection commit announces new value in status region when it changes app behavior.

## Error And Empty Considerations

- If no options are available, control shows disabled state with explanatory text.
- Invalid option values from stale state must safely fall back to last known valid option.

## Contract References

- `docs/ux/contracts/connection-ux-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
