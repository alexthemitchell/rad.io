# Modal

## Purpose

Present blocking workflows that require explicit acknowledgment or decision before returning to the receiver UI.

## Anatomy

- Dialog container.
- Title and body text.
- Primary and secondary actions.
- Optional close button.

## States

| State | Behavior |
| --- | --- |
| `default` | Open and interactive |
| `focus-visible` | Focus ring on interactive elements |
| `submitting` | Primary action busy and duplicate submits blocked |
| `error` | Inline error details shown |
| `closing` | Transition out and focus restore |

## Focus Trap Behavior

- Initial focus lands on modal title or first interactive element.
- `Tab` and `Shift+Tab` cycle within modal controls.
- Focus cannot move to background content while modal is open.
- On close, focus returns to invoking control.

## Escape Semantics

- `Escape` closes only dismissible modals.
- Non-dismissible modals ignore `Escape` and provide explicit path to resolve.
- Close behavior must be announced and deterministic.

## Accessible Labeling

- Dialog has programmatic title and description.
- Primary purpose and consequences are explicit in text.
- Errors are associated with controls and announced.

## Keyboard Behavior

- `Tab` and `Shift+Tab`: cycle focus in trap.
- `Enter`: activates focused default action when appropriate.
- `Escape`: closes if modal is dismissible.

## UX Contract Alignment

- `docs/ux/contracts/connection-ux-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
- `docs/ux/contracts/keyboard-shortcut-contract.md`
