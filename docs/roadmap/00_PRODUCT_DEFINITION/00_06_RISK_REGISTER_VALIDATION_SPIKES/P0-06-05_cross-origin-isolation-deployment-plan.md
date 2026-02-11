# Cross-Origin Isolation Deployment Plan

**ID:** P0-06-05  
**Roadmap:** Phase 0 / 0.6 Risk Register + Validation Spikes (Timeboxed)  
**Roadmap Description:** ensure COOP/COEP headers in dev/prod and define the fallback feature set.

## Summary

Define the dev and production deployment requirements for cross-origin isolation (COOP/COEP) so rad.io can use `SharedArrayBuffer` where available, and define the supported fallback feature set when cross-origin isolation is not enabled.

This should align with the SAB ADR and make “SAB optional” real in practice.

## Deliverables

- Deployment plan doc: `docs/reference/deploy/cross-origin-isolation.md`.
- Fallback behavior table that lists:
  - Feature/behavior
  - Requires cross-origin isolation?
  - Degraded behavior when unavailable
  - How to test both modes

## Acceptance Criteria

- [ ] Plan exists at `docs/reference/deploy/cross-origin-isolation.md`.
- [ ] Headers are explicitly specified for:
  - [ ] Development server
  - [ ] Production hosting (generic reverse proxy guidance)
- [ ] Verification steps are included:
  - [ ] How to confirm COOP/COEP are set
  - [ ] How to confirm `crossOriginIsolated` in the browser
- [ ] Fallback feature set is concrete and includes at minimum:
  - [ ] “SAB disabled” transport strategy (Transferables)
  - [ ] Expected performance changes (max sample rate, buffer sizes)
  - [ ] Any feature flags (e.g., advanced ring buffer mode)
- [ ] Includes a test plan for both modes (forcing non-isolated mode and isolated mode).

## Agent Prompt

Draft the cross-origin isolation deployment plan.

Output file:

- `docs/reference/deploy/cross-origin-isolation.md`

Steps:

1. Review the SAB ADR and ensure the plan matches it.
1. Document the required COOP and COEP header values.
1. Document how to configure these headers in common environments (generic reverse proxy instructions are fine).
1. Create a fallback table describing degraded behavior when COI is not enabled.

Validation checklist:

- [ ] Dev and prod requirements are explicit.
- [ ] Includes verification steps.
- [ ] Fallback behavior is concrete and testable.
- [ ] Markdownlint-friendly formatting.
