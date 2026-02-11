# ADR: Source/DSP/Audio Sink Contracts

**ID:** P0-04-07  
**Roadmap:** Phase 0 / 0.4 Architecture “Irreversible Decisions” (ADRs)  
**Roadmap Description:** explicit interfaces + versioning strategy (so Mock/File/WebUSB can share the pipeline).

## Summary

Define the core contracts between Source → DSP Pipeline → Audio Sink (and related consumers like visualization/recording) so multiple sources (Mock/File/WebUSB) can share the same pipeline without per-source branching.

This ADR must lock:

- Interface boundaries and ownership (who produces/consumes what data, when).
- Capability negotiation (sample formats, rates, channel count, metadata).
- Versioning and compatibility strategy for these contracts.

## Deliverables

- Create folder `docs/decisions/` (if missing).
- Create ADR file `docs/decisions/0007-source-dsp-audio-sink-contracts.md` with this outline:

  - Title, Status, Date
  - Context
    - Need for shared pipeline and reproducibility
  - Decision
    - Contract definitions (TypeScript-first):
      - Source interface
      - Pipeline stage interface
      - Sink interface (audio + other sinks)
      - Metadata/timebase contract (timestamps, sequence)
    - Capability negotiation handshake
    - Backpressure and buffering rules
    - Versioning strategy (contract version, schema evolution)
  - Options considered
    - Per-source bespoke pipelines
    - Shared pipeline with strict contracts (recommended)
    - Plugin-driven pipeline composition
  - Consequences
  - Migration plan
    - How contract changes are introduced without breaking existing sources
  - Validation plan
    - How to verify compatibility across all sources
  - Follow-ups

## Acceptance Criteria

- [ ] ADR exists at `docs/decisions/0007-source-dsp-audio-sink-contracts.md` with standard ADR sections.
- [ ] Decision record rules are explicitly stated:

  - [ ] Alternatives considered (≥ 2) and rationale.
  - [ ] Consequences include testability, performance, and extensibility tradeoffs.
  - [ ] Migration plan exists for contract/version changes.
- [ ] Interfaces are described concretely enough to implement (method names/signatures can be pseudocode, but inputs/outputs and invariants must be explicit).
- [ ] Compatibility strategy is explicit (how multiple sources with different capabilities are handled).
- [ ] Validation plan includes a matrix (Mock/File/WebUSB) and how to prove each source conforms to the contracts.

## Agent Prompt

Draft an ADR for Source/DSP/Audio Sink contracts and versioning. Do not implement large code changes.

Context gathering steps:

- Locate existing source and pipeline code:

  - Search for `Source`, `DSP`, `demod`, `pipeline`, `audio`, `sink`, `worklet`, `samples`
- Locate timestamp/sequence models:

  - Search for `timestamp`, `sequence`, `timebase`, `sampleRate`
- Identify how Mock/File/WebUSB sources currently connect (if at all):

  - Search for `mock`, `fixture`, `file source`, `webusb`, `hackrf`

Write `docs/decisions/0007-source-dsp-audio-sink-contracts.md`.

Validation checklist:

- [ ] Defines contracts and invariants (data shapes, timing, ownership).
- [ ] Includes capability negotiation and backpressure/buffering policy.
- [ ] Includes versioning rules and migration plan.
- [ ] Includes alternatives, rationale, and consequences.
- [ ] Markdownlint-friendly formatting.
