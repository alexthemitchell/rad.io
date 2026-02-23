# ADR 0001: Receiver Mental Model

## Status

Accepted

## Date

2026-02-21

## Context

Users must understand what changes when they tune, zoom, and adjust offsets. Without explicit semantics, controls appear inconsistent and support/debug workflows become ambiguous.

## Decision

rad.io uses this authoritative model:

- Center frequency: midpoint of the currently viewed RF span.
- Tuned frequency: target channel frequency selected by user actions.
- Span: visible frequency width rendered by spectrum/waterfall.
- Sample rate: source capture rate feeding DSP.
- Bandwidth: demod/filter passband around tuned frequency.
- VFO: logical receiver channel definition (MVP currently has one active VFO).

### UI Mapping Rules

- Frequency input edits tuned frequency.
- Fine-tune control offsets tuned frequency within current span.
- Zoom changes visible span density, not tuned frequency.
- Spectrum click selects tuned frequency nearest clicked bin.
- Source rate changes sample-rate constraints and effective span behavior.

## Alternatives Considered

### Alternative A: Single Frequency Concept (no center/tuned split)

Rejected. It obscures offset behavior and makes click-to-tune/fine-tune semantics confusing.

### Alternative B: Center-Locked Receiver (center is always tuned)

Rejected. It limits fast local retunes and degrades UX when inspecting adjacent signals.

## Rationale

A center/tuned split aligns with standard SDR workflows and supports clear interaction contracts, artifact explanations, and future multi-VFO behavior.

## Consequences

- UI must expose both center-oriented visuals and tuned-frequency controls consistently.
- Diagnostics and exports must include tuned frequency, center context, and sample-rate assumptions.
- Future multi-VFO features can extend this model without redefining terms.

## Follow-Ups

- Align tuning and artifact contracts with these terms.
- Ensure recording/export metadata carries tuned and center frequency context.
