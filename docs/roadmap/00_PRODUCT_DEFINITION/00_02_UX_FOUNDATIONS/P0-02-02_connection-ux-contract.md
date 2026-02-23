# Connection UX Contract

**ID:** P0-02-02  
**Roadmap:** Phase 0 / 0.2 UX Foundations  
**Roadmap Description:** explicit UX for device pairing/claiming, streaming start/stop, and audio enablement (including recovery states and copy).

## Summary

Define an explicit, testable UX contract for connection and permissions flows, including recovery states for disconnects and autoplay/audio enablement recovery. This contract must be expressed as named state machines with allowed transitions, user-facing copy, actionable next steps, and accessibility requirements.

Scope includes: pairing/claiming a WebUSB device, connecting/disconnecting, starting/stopping streaming, handling permission revocation, and audio enablement (including user gesture requirements and degraded states).

## Deliverables

- docs/ux/contracts/connection-ux-contract.md
- docs/ux/contracts/audio-ux-contract.md
- docs/ux/copy/connection-and-audio-copy.md

## Acceptance Criteria

- [x] docs/ux/contracts/connection-ux-contract.md includes a state-transition table for device connection with at least these states: idle, pairing, connected, streaming, error, recovering.
- [x] docs/ux/contracts/audio-ux-contract.md includes a state-transition table for audio with at least these states: suspended, awaiting-user-gesture, running, degraded, muted.
- [x] Both contracts include explicit recovery flows for: device disconnect mid-stream, permission revoked, device busy, and user denies permission.
- [x] docs/ux/copy/connection-and-audio-copy.md defines user-facing strings with placeholders (e.g., {deviceName}) and an action for every error state.
- [x] Accessibility requirements cover keyboard-only operation, focus management, and screen reader announcements for state changes.

## Agent Prompt

You are producing UX contracts for rad.io connection and audio enablement.

Context

- rad.io uses WebUSB for device access.
- Common failure modes: permission prompts, device busy/claimed, disconnects, and browser autoplay restrictions.
- The UX must be resilient: every error state must contain a next step.

Required outputs

- Create docs/ux/contracts/connection-ux-contract.md:

  - Always visible UI elements (e.g., connection status indicator, start/stop, diagnostics entry).
  - State machine: state list, allowed transitions, entry/exit actions, and UI affordances per state.
  - Recovery flows after drops/disconnects.
  - Telemetry hooks: event names and when emitted.
- Create docs/ux/contracts/audio-ux-contract.md:

  - Audio state machine with explicit transitions for autoplay blocked and user gesture recovery.
  - Rules for when audio is allowed to start automatically vs requiring explicit action.
  - Degraded/muted semantics and how they appear in UI.
- Create docs/ux/copy/connection-and-audio-copy.md:

  - Copy strings per state with placeholders.
  - For each error: message, primary action label, secondary action label, and help link target.

Non-goals

- Do not implement UI or device code.
- Do not define RF/DSP behavior beyond what affects connection and audio.

Validation plan

- Ensure every state has a clear entry condition and a defined next action.
- Ensure error states include at least one recovery path.
- Ensure keyboard navigation and screen reader announcements are specified for all state transitions.
- Ensure documents contain no TODOs and follow markdownlint formatting.
