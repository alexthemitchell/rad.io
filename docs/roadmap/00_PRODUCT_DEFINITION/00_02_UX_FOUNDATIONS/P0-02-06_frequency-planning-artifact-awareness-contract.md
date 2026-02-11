# Frequency Planning / Artifact Awareness Contract

**ID:** P0-02-06  
**Roadmap:** Phase 0 / 0.2 UX Foundations  
**Roadmap Description:** define how the UI explains DC spur, images, and aliasing risk and what one-click mitigations are permitted (LO shift/IF shift, bandwidth clamp, rate change).

## Summary

Define how rad.io explains common receiver artifacts (DC spur, images, aliasing) and what safe, one-click mitigations are allowed. This is a UX contract: it defines detection heuristics, user-facing copy, and mitigation actions without requiring users to become RF experts.

The contract must be conservative: avoid false certainty, and provide “learn more” paths and reversibility.

## Deliverables

- docs/ux/contracts/artifact-awareness-contract.md
- docs/reference/rf-artifacts-and-mitigations.md
- docs/ux/copy/artifact-awareness-copy.md

## Acceptance Criteria

- [ ] docs/ux/contracts/artifact-awareness-contract.md defines at least 3 artifact classes (DC spur, images, aliasing) with: symptoms, when to warn, and what not to claim.
- [ ] The contract specifies at least 3 permitted mitigations and their UX constraints (e.g., reversible, confirm if disruptive, explain impact).
- [ ] docs/reference/rf-artifacts-and-mitigations.md provides a concise explanation with at least 2 “What to try next” sequences.
- [ ] docs/ux/copy/artifact-awareness-copy.md includes user-facing messages with placeholders and an action for each warning.
- [ ] Accessibility requirements specify how warnings are announced and how users can dismiss or learn more via keyboard.

## Agent Prompt

You are defining the artifact awareness and mitigation UX contract for rad.io.

Context

- rad.io users will encounter DC spur, images, and aliasing-like effects.
- The UI must educate without overwhelming and must avoid pretending to know the RF environment.

Required outputs

- Create docs/ux/contracts/artifact-awareness-contract.md:

  - Artifact categories and detection heuristics (expressed as signals and UI context, not deep DSP).
  - When to show warnings (thresholds, debouncing, and suppression to avoid noise).
  - Allowed mitigations: e.g., small center frequency shift, bandwidth clamp, sample rate suggestion.
  - Safety rules: reversibility, confirmation for disruptive changes, and how to undo.
  - Telemetry hooks for warning shown and mitigation chosen.
- Create docs/reference/rf-artifacts-and-mitigations.md:

  - Plain-language explanations and examples.
  - “Try this first” guidance.
  - Clear disclaimers about uncertainty.
- Create docs/ux/copy/artifact-awareness-copy.md:

  - Final copy for warnings, actions, and help text.

Non-goals

- Do not implement detection or mitigations.
- Do not provide advanced RF theory beyond what is needed for user understanding.

Validation plan

- Ensure every warning has an action and a learn-more path.
- Ensure mitigations are reversible and clearly communicated.
- Ensure copy avoids absolute claims and includes safety messaging.
- Ensure no TODOs and markdownlint-friendly formatting.
