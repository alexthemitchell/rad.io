# Keyboard Shortcut Contract

## Purpose

Define stable shortcut behavior for MVP so keyboard operation is predictable, conflict-aware, and discoverable.

## Principles

1. Safety first: shortcuts must not trigger destructive or confusing behavior without clear context.
2. Conflict avoidance: avoid browser and OS reserved combinations where practical.
3. Discoverability: every non-obvious shortcut must appear in the help overlay.
4. Keyboard parity: any MVP mouse interaction must have a keyboard-only equivalent.
5. Stability: shortcut semantics remain stable across MVP unless a critical conflict is found.

## Scope

- Applies to all shortcuts in `docs/reference/keyboard-shortcuts.md`.
- Applies to global shortcuts and context-bound shortcuts.

## Focus Preconditions

| Shortcut Type | Preconditions |
| --- | --- |
| Global safe actions (`mute`, help, diagnostics) | Works from any focus location except editable text fields where input would be corrupted. |
| Tuning step shortcuts | Disabled while frequency input is in editing mode. |
| Commit/cancel (`Enter`, `Escape`) | Scoped to active control context (input, overlay, transient interaction). |
| Panel navigation shortcuts | Must not move focus into hidden or disabled controls. |

## Conflict-Avoidance Rules

1. Do not bind essential app actions exclusively to combinations commonly owned by browser navigation/window management.
2. If a chosen shortcut may conflict (`Ctrl + R`, `Ctrl + L`), provide at least one in-app fallback path and document it in help.
3. Shortcut handlers must no-op when focus is inside free-text editing fields unless explicitly scoped.

## Discoverability Requirements

- Shortcut overlay is reachable by keyboard (`?` and `F1` path).
- Overlay lists shortcut, action, and context.
- Overlay includes reserved-key rationale.
- First-time sessions should expose a lightweight hint for help entrypoint.

## Customization Policy

- MVP: shortcuts are fixed and not user-customizable.
- Post-MVP: customization may be added with conflict validation and reset-to-default support.

## Required Actions Coverage

The shortcut map must include direct keyboard support for:

- Step up/down.
- Larger step up/down.
- Direct frequency entry focus.
- Start/Stop stream.
- Mute/Unmute.
- Open help/shortcuts overlay.
- Open diagnostics/export diagnostics.

## Accessibility Requirements

- Shortcut use must not trap focus.
- Outcome of shortcut action must be perceivable via visible state change and/or live region announcement.
- Critical state changes from shortcut actions should include actionable recovery path.

## Telemetry Hooks

Record shortcut usage to evaluate discoverability and conflict pain points:

- `shortcut_invoked`
- `shortcut_blocked_due_to_focus`
- `shortcut_conflict_fallback_used`
- `shortcut_help_opened`
