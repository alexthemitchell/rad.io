# ADR 0006: Plugin and Extension Boundary

## Status

Accepted

## Date

2026-02-23

## Context

rad.io does not currently expose a public plugin API, but it already has abstractions that map naturally to extension points (`ISDRDevice`, demodulators/DSP stages, visualization components, diagnostics/export surfaces).

If extension boundaries are not defined now, future plugin support will force breaking refactors across worker contracts, security model, and performance budgets.

## Decision

Adopt internal contract-first extension points now, with a future path to public plugins under strict capability and isolation constraints.

### Supported Extension Points (Phase 0 Contract Sketch)

- Sources:
  - Contract shape aligned to `ISDRDevice` (`open`, `close`, `setFrequency`, `setSampleRate`, `setGain`, `start`, `stop`).
  - Implementations include Mock, HackRF WebUSB, and RTL-SDR adapter.
- DSP stages/demodulators:
  - Deterministic block-processing interface (`process(input, output)` style) with explicit sample-rate assumptions.
- Visualizations:
  - Read-only subscription to processed telemetry/spectrum streams.
  - No direct mutation of pipeline state.
- Exporters/recording formats:
  - Consume versioned diagnostics or recording metadata payloads and return serializable output.

### Non-Goals (Phase 0.4)

- No arbitrary third-party code execution in main thread.
- No direct plugin DOM access to app shell.
- No unrestricted file system, network, or USB access from plugin code.

### Contract and Versioning Rules

- Every extension contract includes explicit `contractVersion`.
- Additive changes are preferred; removals/renames require deprecation cycle.
- Host and extension negotiate minimum compatible version at registration.

### Security Model

- Capability-based API surface only:
  - plugin receives narrow handles (for example `readSpectrum`, `requestTune`, `exportArtifact`) rather than global app objects.
- Worker isolation is default for untrusted extension logic.
- No direct `window`, `document`, or raw WebUSB handles to extensions.

### Performance Model

- Extensions run under budgets and degraded mode expectations:
  - per-frame CPU budget and message payload limits.
  - bounded event subscription rates.
- Host may throttle or disable extension callbacks under overload to protect audio/tune budgets.

## Alternatives Considered

### Alternative A: No plugins ever

Rejected.

- Pros: simplest codebase and threat model.
- Cons: limits ecosystem and future feature velocity.

### Alternative B: Internal-only extension points

Partially accepted as Phase 0.4 stepping stone.

- Pros: enables modularity without public API commitment.
- Cons: does not alone solve future ecosystem compatibility.

### Alternative C: Public plugin API with sandboxing

Accepted as target direction, not immediate delivery.

- Pros: future extensibility with controlled risk.
- Cons: requires version governance, sandbox tooling, and stronger compatibility tests.

## Consequences

- Security:
  - stricter boundary discipline reduces plugin blast radius.
  - sandboxing infrastructure adds implementation effort.
- Performance:
  - budget enforcement protects core DSP/audio paths.
  - plugin callback and message mediation add some overhead.
- Maintenance:
  - API lifecycle governance and compatibility testing become mandatory.

## Migration / Rollout Plan

- Phase 1:
  - formalize internal registries for source, DSP stage, visualization, exporter contracts.
- Phase 2:
  - introduce `contractVersion` negotiation and deprecation annotations.
- Phase 3:
  - pilot external plugin loading in isolated worker context behind feature flag.
- Deprecation strategy:
  - announce deprecation in one minor cycle, keep compatibility shim where feasible, then remove in next major.

## Validation Plan

- Contract conformance tests for each extension point.
- Compatibility tests across N and N-1 contract versions.
- Security tests verifying denied access to DOM/global capabilities.
- Performance checks ensuring plugin activity cannot violate tune/audio/visual budgets.

## Follow-Ups

- Add contract package namespace (suggested path: `src/contracts/extensions/*`).
- Add capability descriptor schema and registry manifest format.
- Add extension-host compatibility matrix to docs and CI.
