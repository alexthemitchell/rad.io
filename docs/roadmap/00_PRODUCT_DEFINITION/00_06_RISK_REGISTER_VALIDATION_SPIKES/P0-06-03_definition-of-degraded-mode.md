# Definition of “Degraded Mode”

**ID:** P0-06-03  
**Roadmap:** Phase 0 / 0.6 Risk Register + Validation Spikes (Timeboxed)  
**Roadmap Description:** agree on safe behavior when budgets are missed (mute ramps, lower FFT rate, reduced resolution).

## Summary

Define what “degraded mode” means for rad.io, including the triggers (budget misses) and the safe fallback behaviors the app must take to remain usable and truthful.

This must be explicit and measurable so later phases can build budget gates and consistent UX around them.

## Deliverables

- Degraded mode spec: `docs/reference/contracts/degraded-mode-v1.md`.
- A trigger → action table that maps telemetry/budget signals to specific mitigations.

## Acceptance Criteria

- [ ] Spec exists at `docs/reference/contracts/degraded-mode-v1.md`.
- [ ] Triggers are explicit and measurable, at minimum:
  - [ ] Buffer underrun/overrun thresholds
  - [ ] Render frame budget misses (dropped frames)
  - [ ] Worker message latency thresholds
  - [ ] USB stall thresholds
- [ ] For each trigger, safe fallback behavior is defined (examples):
  - [ ] Reduce FFT rate / resolution
  - [ ] Reduce waterfall rendering load
  - [ ] Reduce sample rate / apply decimation
  - [ ] Apply audio mute ramps on underrun
  - [ ] Disable expensive visual layers
- [ ] UX rules are explicit:
  - [ ] How the user is informed
  - [ ] Whether actions are automatic vs user-controlled
  - [ ] How/when the system recovers back to normal mode

## Agent Prompt

Draft the “degraded mode” specification.

Output file:

- `docs/reference/contracts/degraded-mode-v1.md`

Steps:

1. Enumerate the budgets and telemetry signals that will act as triggers.
2. Define fallback actions that are safe and truthful.
3. Define UX requirements (visibility, control, recovery).
4. Include a short section on “testing degraded mode” (how to simulate triggers).

Validation checklist:

- [ ] Trigger thresholds are measurable and tied to telemetry.
- [ ] Actions are concrete and safe.
- [ ] UX is explicit and recoverable.
- [ ] Markdownlint-friendly formatting.
