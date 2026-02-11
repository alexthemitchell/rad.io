# Tuning Interaction Contract

**ID:** P0-02-04  
**Roadmap:** Phase 0 / 0.2 UX Foundations  
**Roadmap Description:** click/drag-to-tune semantics, wheel/keyboard stepping rules, direct frequency entry, and focus behavior.

## Summary

Define the tuning interaction contract: direct frequency entry behavior, click/drag tuning semantics, mouse wheel stepping rules, keyboard tuning, and focus/commit/cancel behavior. This contract must be explicit enough to implement consistently across spectrum, waterfall, and frequency input components.

The contract should minimize accidental retunes, support precise stepping, and be accessible via keyboard and screen readers.

## Deliverables

- docs/ux/contracts/tuning-interaction-contract.md
- docs/ux/contracts/frequency-entry-contract.md
- docs/ux/copy/tuning-and-frequency-entry-copy.md

## Acceptance Criteria

- [ ] docs/ux/contracts/tuning-interaction-contract.md defines tuning interactions for: click-to-tune, click-drag-to-tune, shift/alt modifiers, double-click behavior, and selection snapping rules.
- [ ] docs/ux/contracts/frequency-entry-contract.md defines focus/commit/cancel rules, validation, formatting, and error handling for frequency input.
- [ ] Both documents include keyboard-only tuning paths with explicit key bindings and stepping magnitudes.
- [ ] Both documents include accessibility requirements: focus order, aria-labels, and announcement strategy for tuned frequency changes.
- [ ] docs/ux/copy/tuning-and-frequency-entry-copy.md includes copy for invalid inputs, out-of-range tuning, and precision guidance.

## Agent Prompt

You are defining tuning interaction semantics for rad.io.

Context

- rad.io has spectrum/waterfall visuals and a numeric frequency input.
- Tuning must be precise, discoverable, and safe against accidental changes.

Required outputs

- Create docs/ux/contracts/tuning-interaction-contract.md:

  - Interaction table: gesture, preconditions, action, result, and notes.
  - Mouse wheel rules: default step size, accelerated step, and modifier keys.
  - Drag tuning: axis, sensitivity, clamping, and cancel rules.
  - Telemetry hooks for tuning actions.
- Create docs/ux/contracts/frequency-entry-contract.md:

  - Input parsing rules (Hz/kHz/MHz suffixes allowed or not, grouping separators).
  - Commit conditions (Enter, blur), cancel conditions (Escape), and revert behavior.
  - Range constraints and feedback for out-of-range.
  - Formatting rules for display.
- Create docs/ux/copy/tuning-and-frequency-entry-copy.md:

  - Inline validation messages and helper text.
  - Accessible labels for controls.

Non-goals

- Do not implement the controls.
- Do not decide DSP details; only define the UX contract.

Validation plan

- Ensure every interaction has deterministic behavior and a defined cancel path.
- Ensure keyboard-only users can perform all tuning actions.
- Ensure documents contain no TODOs and follow markdownlint formatting.
