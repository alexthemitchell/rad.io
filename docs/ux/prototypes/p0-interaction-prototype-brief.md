# P0 Interaction Prototype Brief

## Purpose

Validate interaction contracts before implementation hardening, with emphasis on tuning, safety, and recovery behavior.

## Decisions To Validate

1. Connection flow clarity (`idle` to `streaming`) and error recovery affordances.
2. Tuning semantics consistency between input, keyboard steps, and spectrum interactions.
3. Audio enablement clarity when autoplay policies block output.
4. Error-state copy actionability and diagnostics discoverability.

## Scope

Prototype includes:

- Control bar (source, start/stop, mute, diagnostics).
- Frequency input and tuning step controls.
- Spectrum and waterfall interaction affordances.
- Status banner and recovery actions.
- Keyboard shortcut help overlay.

## Target Users

- First-time hobbyist validating basic receive path.
- Returning user doing quick retune and mode changes.
- User recovering from disconnect or blocked audio.

## Scenarios

1. First session: select source, connect, start stream.
2. Retune: change frequency by input and keyboard steps.
3. Audio enablement: unblock audio and verify mute/unmute.
4. Planned failure: disconnect and recover without page reload.

## Explicit Exclusions

- RF correctness and demod fidelity validation.
- Advanced DSP controls and non-MVP workflows.
- Visual polish and branding refinement.

## Success Criteria

- Test script can be executed by an observer without extra context.
- At least one full dry run reveals actionable contract updates.
- Findings map directly to contracts/component specs/information architecture.
