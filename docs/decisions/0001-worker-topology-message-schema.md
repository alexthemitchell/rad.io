# ADR 0001: Worker Topology And Message Schema

## Status

Accepted

## Date

2026-02-23

## Context

rad.io runs browser UI, WebUSB device control, DSP processing, and audio output under tight latency and frame-rate budgets. Phase 0 requires a contracts-first architecture and clear boundaries that avoid churn.

Key concerns:

- Message rate and payload sizes can create GC pressure and jitter.
- UI responsiveness must remain stable while DSP and rendering are active.
- Some environments will not provide `SharedArrayBuffer`; fallback behavior must remain supported.
- Contracts must evolve without breaking older payload producers/consumers.

## Decision

Use a single primary DSP worker in Phase 0 with a versioned message envelope for all cross-thread control and data messages.

### Topology

- Main thread:
  - UI state and interaction orchestration.
  - Device connect/disconnect and user intent handling.
- DSP worker:
  - Sample transport intake.
  - DSP transforms and analysis snapshots.
  - Telemetry event aggregation for processing-stage timings.
- Audio sink:
  - Current pipeline remains in-browser sink path with deterministic queue behavior.

### Thread Ownership Rules

- UI state remains on main thread.
- DSP pipeline state remains in worker.
- Cross-thread state exchange occurs only through explicit envelopes; no implicit shared mutable state contract.

### Transport Rules

- Preferred hot-path transport uses transferable `ArrayBuffer` now.
- Optional SAB path is capability-gated and defined by ADR 0002.
- Control and event messages always use typed envelopes regardless of transport mode.

## Message Envelope Contract

All worker-bound and worker-originated control/event messages use this minimum envelope:

```ts
interface MessageEnvelope<TPayload = unknown> {
  schemaVersion: "1.0";
  messageType: string;
  messageId: string;
  timestampMs: number;
  source: "ui" | "worker" | "audio";
  payload: TPayload;
}
```

Required rules:

- `schemaVersion` is mandatory and validated at boundaries.
- Unknown `messageType` is ignored with a diagnostics warning.
- `payload` shape validation occurs for control-plane messages; hot-loop sample arrays are validated at envelope level only.

## Schema Evolution Strategy

- Additive changes:
  - Add optional fields with defaults; keep existing fields stable.
- Renames/removals:
  - Introduce new field first, support both for one minor cycle, then remove old field in next major schema.
- Defaulting:
  - Consumers apply explicit defaults at decode boundary.
- Compatibility:
  - Producer must not emit schema versions newer than negotiated/known consumer contract.

## Options Considered

### Option A: Single DSP worker with versioned envelopes

Accepted.

- Pros: simplest operational model, low coordination overhead, easy to instrument.
- Cons: fewer parallelism knobs for future high-throughput scenarios.

### Option B: Split workers by concern (DSP, visualization, IO)

Rejected for Phase 0.

- Pros: improved isolation and potential throughput scaling.
- Cons: more inter-worker transport complexity and synchronization risk before baseline contracts are stable.

### Option C: AudioWorklet-centric topology early

Rejected for Phase 0.

- Pros: tighter audio timing control.
- Cons: increased complexity and cross-context contract overhead too early in roadmap.

## Consequences

Benefits:

- Clear and testable boundary between UI and DSP behavior.
- Versioned envelopes reduce integration ambiguity.
- Easier phased migration to SAB/advanced transports.

Costs and risks:

- Single worker can become contention point under heavy future workloads.
- Contract discipline is required for every new message type.
- Dual transport support (transferable plus optional SAB) increases testing surface.

## Migration Plan

- Current unversioned/loosely versioned messages migrate to `MessageEnvelope` incrementally.
- Boundary adapters accept legacy payloads during transition and emit normalized `schemaVersion: "1.0"` envelopes.
- Legacy-only message paths are removed after contract compliance tests pass in CI.

## Validation Plan

- Measure p95 control message latency (`<= 10 ms`) under active stream.
- Cap control message payload sizes for routine events (`<= 8 KB`).
- Verify tune request to applied-state acknowledgement p95 (`<= 120 ms`).
- Verify frame cadence remains within quality budgets while messaging load tests run.
- Test fallback behavior with forced no-SAB mode.

## Follow-Ups

- Define canonical message types in a shared contract module.
- Add boundary validation mappings per ADR 0008.
- Add benchmark and soak test fixtures for message throughput and latency.
