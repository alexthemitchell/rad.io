# P0 Interaction Prototype Findings

## Dry Run Context

- Date: 2026-02-23
- Session type: internal dry run
- Build medium: clickable interaction prototype
- Facilitator notes: contracts focused on connection, tuning, audio gating, and failure recovery

## Findings Log

| ID | Scenario | Observed Behavior | Expected Behavior | Severity | Suggested Follow-Up Artifact Update | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| F-001 | Connect source | Participant could not tell if app was `pairing` or `connected`. | Connection state label should be explicit at all times. | High | Clarify always-visible state label in `docs/ux/contracts/connection-ux-contract.md`. | UX |
| F-002 | Start stream | `Start` action looked disabled briefly without explanation. | Temporary unavailability should include inline reason text. | Medium | Add disabled-reason rule in `docs/design-system/components/button-spec.md`. | Design System |
| F-003 | Frequency input | Invalid input feedback appeared but was not actionable. | Error copy should state accepted format and example. | High | Tighten validation copy in `docs/ux/contracts/frequency-entry-contract.md`. | UX |
| F-004 | Visual tuning | Drag retune felt too sensitive and overshot target. | Drag should be rate-limited and cancellable. | Medium | Reaffirm drag rate-limiting in `docs/ux/contracts/tuning-interaction-contract.md`. | UX |
| F-005 | Keyboard tuning | Large-step shortcut unclear to first-time participant. | Shortcut help should list base/fine/large semantics together. | Medium | Update quick-help section in `docs/reference/keyboard-shortcuts.md`. | UX |
| F-006 | Audio enablement | User interpreted blocked audio as stream failure. | Audio blocked copy should isolate cause and action. | High | Refine copy in `docs/ux/contracts/audio-ux-contract.md`. | UX |
| F-007 | Mute toggle | Mute state change had no persistent textual confirmation. | Mute should have persistent state label plus announcement. | Medium | Strengthen state label requirement in `docs/design-system/components/toggle-spec.md`. | Design System |
| F-008 | Disconnect recovery | Error banner actions were below fold at smaller viewport. | Recovery action must remain immediately reachable. | High | Add visibility rule to `docs/design-system/components/banner-spec.md` and panel layout guidance. | Design System |
| F-009 | Diagnostics export | Participants found diagnostics only after second attempt. | Diagnostics action should be consistently placed and named. | Medium | Tighten discoverability in `docs/reference/support-diagnostics-entrypoints.md`. | Product |
| F-010 | Shortcuts overlay | Overlay close action stole focus and returned to page start. | Focus should return to invoking control. | High | Add focus-return rule in `docs/ux/accessibility/mvp-accessibility-requirements.md`. | Accessibility |
| F-011 | Reduced motion | Transition shimmer still displayed in reduced-motion mode. | Decorative motion should be disabled under reduced-motion preference. | Medium | Update `docs/ux/accessibility/reduced-motion-and-animation-rules.md`. | Accessibility |
| F-012 | Stable receiving return | After recover, user unsure whether previous frequency persisted. | Recovery copy should explicitly confirm restored or reset settings. | Medium | Expand recovery copy requirements in `docs/ux/contracts/connection-ux-contract.md`. | UX |

## Summary

- High severity findings: `4`
- Medium severity findings: `8`
- Low severity findings: `0`

## Immediate Next Updates

1. Prioritize high severity issues before implementation freeze.
2. Validate updated copy and focus behavior in a second dry run.
3. Re-run keyboard-only flows after shortcut/help updates.
