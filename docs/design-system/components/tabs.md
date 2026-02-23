# Tabs

## Purpose

Switch between peer views while preserving context, such as spectrum, waterfall, and diagnostics panes.

## Anatomy

- Tab list container.
- Tab triggers.
- Associated tab panels.
- Optional status badges.

## States

| State | Behavior |
| --- | --- |
| `default` | One tab selected and panel visible |
| `hover` | Optional visual emphasis |
| `focus-visible` | Focused tab has visible focus ring |
| `disabled` | Tab cannot be selected |
| `loading` | Panel content loading indicator is shown |

## Keyboard Behavior

- `Tab`: enters tab list on selected tab.
- `ArrowLeft` and `ArrowRight`: move focus between tabs.
- `Home` and `End`: focus first or last tab.
- `Enter` and `Space`: activate focused tab.
- `Tab` from active tab: moves into active panel content.

## Screen Reader Behavior

- Tab list, tab, and panel semantics are exposed.
- Active tab state and panel association are announced.
- Disabled tabs are announced as unavailable.

## Error And Empty-State Guidance

- Panels may render empty/error states consistent with catalog contracts.
- Tab switch should not clear active error details without explicit user action.

## UX Contract Alignment

- `docs/ux/contracts/empty-and-error-state-catalog.md`
- `docs/ux/contracts/keyboard-shortcut-contract.md`
