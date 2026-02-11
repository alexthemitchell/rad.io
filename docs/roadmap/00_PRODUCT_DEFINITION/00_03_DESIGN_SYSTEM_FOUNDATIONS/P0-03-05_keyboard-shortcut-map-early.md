# Keyboard Shortcut Map (Early)

**ID:** P0-03-05  
**Roadmap:** Phase 0 / 0.3 Design System Foundations  
**Roadmap Description:** reserve key bindings for core ops (tune, step, start/stop, mute, record) to avoid rework.

## Summary

Reserve and document an early keyboard shortcut map for core receiver operations to avoid later rework and conflicts. Shortcuts must support tuning, stepping, start/stop streaming, mute, and opening diagnostics, and must be compatible with accessibility expectations and common browser/OS reserved shortcuts.

This is a contract: shortcuts should be stable and discoverable.

## Deliverables

- docs/reference/keyboard-shortcuts.md
- docs/ux/contracts/keyboard-shortcut-contract.md

## Acceptance Criteria

- [ ] docs/reference/keyboard-shortcuts.md lists at least 20 shortcuts grouped by category (tuning, audio, navigation, diagnostics).
- [ ] docs/ux/contracts/keyboard-shortcut-contract.md defines rules: conflict avoidance, discoverability, focus preconditions, and customization policy.
- [ ] Shortcuts include at least: step up/down, larger step up/down, direct frequency entry focus, start/stop, mute, open help/shortcuts overlay, open diagnostics.
- [ ] The map explicitly excludes browser/OS-reserved combinations and documents rationale.
- [ ] All shortcuts have a keyboard-only equivalent for any mouse-only interaction in MVP.

## Agent Prompt

You are defining the early keyboard shortcut map for rad.io.

Context

- rad.io is a browser app; many key combos are reserved.
- Keyboard-only operation is a priority.

Required outputs

- Create docs/reference/keyboard-shortcuts.md:

  - Categorized list of shortcuts.
  - For each: key combo, action, context (global vs focused control), and notes.
  - Include a “Conflicts and reserved keys” section.
- Create docs/ux/contracts/keyboard-shortcut-contract.md:

  - Principles: avoid conflicts, keep discoverable, require safe defaults.
  - Focus rules (what must be focused for certain shortcuts to work).
  - Policy: whether shortcuts are customizable in MVP or later.

Non-goals

- Do not implement shortcuts.
- Do not add shortcuts for non-MVP features.

Validation plan

- Cross-check against common browser shortcuts to avoid collisions.
- Ensure every core MVP journey can be performed via keyboard.
- Ensure docs contain no TODOs and follow markdownlint formatting.
