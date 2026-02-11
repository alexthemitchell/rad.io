# Core Component Spec Pack

**ID:** P0-03-02  
**Roadmap:** Phase 0 / 0.3 Design System Foundations  
**Roadmap Description:** Button/Toggle, Slider, Numeric input (frequency), Dropdown, Tabs, Toast/Alert, Modal, Tooltip.

## Summary

Define the core component spec pack for rad.io: interaction semantics, states, accessibility requirements, and copy guidance for the MVP component set. Component specs must be implementation-ready and consistent with UX contracts (connection, tuning, error states).

This is a contract for behavior, not visual design.

## Deliverables

- docs/design-system/components/README.md
- docs/design-system/components/button-and-toggle.md
- docs/design-system/components/slider.md
- docs/design-system/components/numeric-input-frequency.md
- docs/design-system/components/dropdown.md
- docs/design-system/components/tabs.md
- docs/design-system/components/toast-and-alert.md
- docs/design-system/components/modal.md
- docs/design-system/components/tooltip.md

## Acceptance Criteria

- [ ] Each component spec defines: purpose, anatomy, states (default/hover/active/disabled), keyboard behavior, and screen reader behavior.
- [ ] Numeric frequency input spec includes parsing/validation, formatting, commit/cancel, and error messaging guidance.
- [ ] Toast/alert spec includes severity levels, timing rules, and when to use modal vs toast.
- [ ] Modal spec includes focus trap behavior, escape semantics, and accessible labeling.
- [ ] At least 6 specs explicitly reference relevant UX contracts (connection, tuning, empty/error) for consistency.

## Agent Prompt

You are producing the MVP component behavior specs for rad.io.

Context

- This repo needs a consistent design system to avoid one-off UI behavior.
- Accessibility and keyboard operation are first-class requirements.

Required outputs

- Create docs/design-system/components/README.md describing how component specs are organized and how to propose changes.
- Create the following component spec docs with behavior-first content:

  - button-and-toggle.md
  - slider.md
  - numeric-input-frequency.md
  - dropdown.md
  - tabs.md
  - toast-and-alert.md
  - modal.md
  - tooltip.md
- Each spec must include:

  - Purpose and usage guidelines.
  - Interaction states.
  - Keyboard interactions (exact keys).
  - Accessibility requirements (roles, labels, announcements).
  - Error/empty considerations where relevant.

Non-goals

- Do not implement components.
- Do not design pixel-perfect UI or iconography.

Validation plan

- Ensure each spec is implementation-ready with deterministic behavior.
- Ensure keyboard and screen reader requirements are explicit.
- Ensure docs contain no TODOs and follow markdownlint-friendly formatting.
