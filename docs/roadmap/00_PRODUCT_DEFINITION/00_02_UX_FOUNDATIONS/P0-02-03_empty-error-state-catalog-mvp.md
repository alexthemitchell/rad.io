# Empty/Error State Catalog (MVP)

**ID:** P0-02-03  
**Roadmap:** Phase 0 / 0.2 UX Foundations  
**Roadmap Description:** define UI behavior for “no device”, “no signal”, “audio blocked”, “permission revoked”, “device busy”, “dropped samples”.

## Summary

Create a catalog of MVP empty and error states with explicit copy, severity, user actions, and telemetry hooks. This catalog ensures the UI never “goes blank” without explanation and always provides a path forward.

States must cover device lifecycle, signal/receive status, audio policy issues, and performance degradation signals (e.g., dropped samples).

## Deliverables

- docs/ux/contracts/empty-and-error-state-catalog.md
- docs/ux/copy/empty-error-state-copy.md
- docs/reference/support-diagnostics-entrypoints.md

## Acceptance Criteria

- [x] docs/ux/contracts/empty-and-error-state-catalog.md lists at least 18 states, including: no device, permission denied, permission revoked, device busy, device disconnected, stream start failed, no signal, likely mis-tuned, audio blocked, audio device missing, dropped samples, rendering overloaded.
- [x] Each state includes: detection condition, user-facing message, primary action, secondary action, and telemetry event name.
- [x] docs/ux/copy/empty-error-state-copy.md contains final copy for every state and avoids ambiguous terms like “failed” without context.
- [x] Accessibility notes exist for each state (e.g., announce via aria-live, focus placement, keyboard escape routes).
- [x] docs/reference/support-diagnostics-entrypoints.md defines how users access logs/diagnostics from any error state.

## Agent Prompt

You are producing the MVP empty/error state catalog for rad.io.

Context

- rad.io is a web SDR receiver/analyzer with WebUSB and audio output.
- The UX philosophy: actionable errors with a next step and explicit recovery paths.

Required outputs

- Create docs/ux/contracts/empty-and-error-state-catalog.md:

  - A table with columns: State ID, Category, Trigger/Detection, Message intent, Primary action, Secondary action, Telemetry event.
  - Include recovery flows for disconnection and permission changes.
  - Include “when to show” vs “when to suppress” rules (avoid flicker).
- Create docs/ux/copy/empty-error-state-copy.md:

  - Final copy strings with placeholders.
  - Button labels and short help text.
- Create docs/reference/support-diagnostics-entrypoints.md:

  - Where diagnostics lives in the UI.
  - What information is safe to show and how to export.

Non-goals

- Do not implement UI or telemetry.
- Do not create a full troubleshooting guide; only define entrypoints and messages.

Validation plan

- Confirm every state has at least one actionable next step.
- Confirm copy distinguishes user action needed vs system issue.
- Confirm accessibility behavior is specified (announcement, focus, keyboard routes).
- Ensure no TODOs and markdownlint-friendly formatting.
