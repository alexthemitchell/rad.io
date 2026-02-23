# Navigation Model

## Paradigm

- Single-screen panel workspace.
- Persistent control rail under visual panels.
- Progressive disclosure for diagnostics via expandable section.

## Interaction Rules

- Core controls are always in one action row.
- Stream lifecycle changes state labels, not route/screen.
- Error and recovery keep users in context with direct retry actions.

## Responsive Rules

- Desktop: two-column visual grid with waterfall full-width.
- Mobile/tablet: one-column stacked panels and full-width control groups.
- Actions remain reachable without horizontal scrolling.

## Keyboard Navigation Rules

- Tab order follows source -> stream -> audio -> tune/mode/frequency -> gain -> diagnostics.
- ArrowLeft/ArrowRight tune by fixed step.
- `M` toggles mute.
- Status changes are announced through live region.

## Focus And Announcement Rules

- Start/Stop action retains focus after state transitions.
- Blocking errors keep focusable recovery actions in current viewport.
- No modal focus traps for MVP stream control flows.
