# Top Risks Register

**ID:** P0-06-01  
**Roadmap:** Phase 0 / 0.6 Risk Register + Validation Spikes (Timeboxed)  
**Roadmap Description:** top ~10 risks with owner, mitigation plan, and acceptance validation.

## Summary

Create a Phase 0 risk register that names the top risks early, assigns an owner, and defines a concrete mitigation + validation plan for each.

This is used to prioritize spikes and prevent “unknown unknowns” from surprising later phases.

## Deliverables

- Risk register document: `docs/reference/risk/phase0-risk-register.md`.
- Each risk includes:
  - Owner
  - Impact and likelihood
  - Mitigation plan
  - Validation plan (how we know the mitigation worked)
  - “Tripwire” signals (what telemetry indicates this risk is happening)

## Acceptance Criteria

- [ ] Risk register exists at `docs/reference/risk/phase0-risk-register.md`.
- [ ] At least 10 risks are listed, each with owner, mitigation, and measurable validation.
- [ ] Risk list includes (at minimum) risks in these areas:
  - [ ] WebUSB stability/permissions and device compatibility
  - [ ] Throughput and buffering (USB → worker → DSP)
  - [ ] Worker/audio latency and underruns
  - [ ] Rendering performance (60 FPS goals) and memory pressure
  - [ ] Cross-origin isolation / SAB availability and fallback behavior
  - [ ] Deterministic test sources/fixtures quality
  - [ ] Persistence/migration correctness
  - [ ] Browser support matrix / regressions
- [ ] Each risk has a defined “validation artifact” (doc link, test, spike report).

## Agent Prompt

Draft the Phase 0 risk register.

Output file:

- `docs/reference/risk/phase0-risk-register.md`

Steps:

1. Review Phase 0 roadmap items and ADRs to enumerate failure modes.
1. For each risk, fill owner (role-based is OK: “DSP”, “WebUSB”, “UX”, “Infra”), severity/likelihood, mitigation plan, validation plan with a measurable outcome, and tripwire signals.
1. Ensure the register drives the Spike Plan (link risks to spike IDs).

Validation checklist:

- [ ] Risks are specific and actionable (not vague).
- [ ] Validation is measurable.
- [ ] Includes tripwire signals and artifacts.
- [ ] Markdownlint-friendly formatting.
