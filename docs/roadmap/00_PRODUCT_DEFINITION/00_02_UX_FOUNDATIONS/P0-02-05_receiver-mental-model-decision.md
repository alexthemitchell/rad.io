# Receiver Mental Model Decision

**ID:** P0-02-05  
**Roadmap:** Phase 0 / 0.2 UX Foundations  
**Roadmap Description:** define and document semantics for center frequency vs tuned frequency vs span vs VFO.

## Summary

Decide and document the receiver mental model: what “center frequency”, “tuned frequency”, “span”, “sample rate”, and “VFO” mean in rad.io, and how they map to UI controls and internal behavior. This decision prevents contradictory UX, reduces user confusion, and makes tuning + artifact mitigation explainable.

This should be captured as an architectural decision record (ADR) plus a short reference glossary for UX and engineering.

## Deliverables

- docs/decisions/0001-receiver-mental-model.md
- docs/reference/receiver-mental-model.md

## Acceptance Criteria

- [ ] docs/decisions/0001-receiver-mental-model.md includes: decision, context, alternatives considered, rationale, consequences, and follow-ups.
- [ ] The decision explicitly defines at least these terms: center frequency, tuned frequency, span, sample rate, bandwidth, VFO.
- [ ] The decision specifies what UI control changes which quantity and what is derived from what.
- [ ] docs/reference/receiver-mental-model.md provides a user-facing explanation with at least 2 examples (e.g., “tune within a span” and “shift center to avoid DC”).
- [ ] The docs are consistent with the planned tuning and artifact awareness contracts (no contradictory definitions).

## Agent Prompt

You are writing the receiver mental model decision for rad.io.

Context

- rad.io is an SDR receiver/analyzer with spectrum and waterfall.
- Users must understand what they are changing when they tune.
- This decision will be referenced by tuning interactions, artifact awareness, and VFO management.

Required outputs

- Create docs/decisions/0001-receiver-mental-model.md as an ADR:

  - Context: what confusion we are avoiding.
  - Decision: authoritative definitions and mapping to UI.
  - Alternatives: at least 2 plausible models and why rejected.
  - Consequences: what we must implement, and what becomes simpler/harder.
- Create docs/reference/receiver-mental-model.md:

  - Explain in plain language.
  - Provide examples and small diagrams using ASCII where helpful.
  - Include a “Troubleshooting mental model” section: why you might see a signal but not hear audio.

Non-goals

- Do not implement UI.
- Do not write a full SDR textbook.

Validation plan

- Ensure terms are unambiguous and used consistently.
- Ensure the mapping to UI controls is explicit and testable.
- Ensure no TODOs and markdownlint-friendly formatting.
