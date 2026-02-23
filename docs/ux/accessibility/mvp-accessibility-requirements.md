# MVP Accessibility Requirements

## Purpose

Define testable accessibility requirements for Phase 0 to Phase 1 MVP behavior. These requirements are the release gate for keyboard operation, focus, announcements, contrast, and reduced-motion handling.

## Must-Pass Requirements

1. Every primary user action in MVP journeys is keyboard-operable without pointer use.
2. All interactive controls show visible `focus-visible` indication with tokenized focus styling.
3. Blocking errors include at least one keyboard-activatable recovery action.
4. State changes for connection, audio, tuning commit, and validation errors are announced via a consistent live region.
5. Contrast requirements in `docs/design-system/theme-contrast-requirements.md` are met for text and controls.
6. Reduced-motion preferences are respected per `docs/ux/accessibility/reduced-motion-and-animation-rules.md`.
7. Focus does not move unexpectedly during connection, recovery, or inline validation.
8. Canvas-only interactions have equivalent non-canvas controls.

## Should-Pass Requirements

1. Keyboard shortcuts provide efficient alternatives for repetitive tuning actions.
2. Status and diagnostics messages are concise and action-oriented.
3. Live-region announcements avoid excessive repetition during rapid tuning updates.
4. Non-blocking warnings do not steal focus.

## Focus Management Rules

- Connection transitions preserve or intentionally redirect focus to the next required action.
- Failed form commits return focus to the invalid field.
- Dismissible overlays return focus to the invoking control.
- No hidden focus traps outside active modal context.

## Announcement Rules

Announce at minimum:

- Connection state transitions (`idle`, `pairing`, `connected`, `streaming`, `recovering`, `error`).
- Audio state transitions (`suspended`, `awaiting-user-gesture`, `running`, `degraded`, `muted`).
- Frequency commit success and validation failures.
- Recovery outcomes (`Reconnect succeeded`, `Retry failed`, `Diagnostics exported`).

## MVP Exit Checklist

- [ ] Keyboard-only run for connect/start/tune/audio/recover completed.
- [ ] Visible focus in all primary controls verified.
- [ ] Error recovery actions keyboard reachable.
- [ ] Live announcements cover required state changes.
- [ ] Contrast targets pass representative states.
- [ ] Reduced motion behavior verified.
- [ ] Canvas interactions have keyboard equivalent.
