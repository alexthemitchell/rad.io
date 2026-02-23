# Component Specs

## Purpose

This directory defines behavior contracts for MVP components used by `rad.io`. Specs are implementation-ready and focused on deterministic interaction semantics, accessibility, and state handling.

## How To Read These Specs

Each component spec includes:

- Purpose and usage boundaries.
- Anatomy and required sub-elements.
- State definitions.
- Keyboard behavior with exact key semantics.
- Screen reader requirements.
- Error and empty-state handling where relevant.
- UX contract references to avoid behavior drift.

## Source Contracts

- `docs/ux/contracts/connection-ux-contract.md`
- `docs/ux/contracts/audio-ux-contract.md`
- `docs/ux/contracts/frequency-entry-contract.md`
- `docs/ux/contracts/tuning-interaction-contract.md`
- `docs/ux/contracts/empty-and-error-state-catalog.md`
- `docs/ux/contracts/keyboard-shortcut-contract.md`

## Change Process

1. Update the relevant component spec.
2. Update linked UX contract if behavior semantics changed.
3. Update `docs/reference/keyboard-shortcuts.md` when key mappings change.
4. Re-run accessibility flow checks from `docs/ux/accessibility/keyboard-only-flows.md`.

## Canonical MVP Spec Files

- `button-and-toggle.md`
- `slider.md`
- `numeric-input-frequency.md`
- `dropdown.md`
- `tabs.md`
- `toast-and-alert.md`
- `modal.md`
- `tooltip.md`
