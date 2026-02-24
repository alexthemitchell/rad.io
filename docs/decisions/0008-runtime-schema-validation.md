# ADR 0008: Runtime Schema Validation

## Status

Proposed

## Date

2026-02-23

## Context

rad.io is TypeScript-first, but TypeScript checks do not protect runtime boundaries where untrusted or weakly trusted data enters:

- UI <-> worker messages (`postMessage` in `src/App.tsx`, `src/dsp/worker.ts`)
- WebUSB/device IO payloads and capability reports (`src/devices/*`)
- File import/recording decode boundaries (current and planned)
- Persistence reads (planned `localStorage` and IndexedDB usage)

Validation everywhere in DSP hot loops would create performance cliffs. Phase 0.4 requires contracts first boundaries with safety and explicit failure mapping.

## Decision

Validate at boundary envelopes and configuration handshakes, not per-sample hot loops.

### Validation Boundary Policy

| Boundary | Validate at runtime | What is validated | Hot path policy |
| --- | --- | --- | --- |
| UI -> worker command messages | yes | command discriminator, required fields, value ranges | validate every command envelope |
| Worker -> UI event messages | yes | event type, payload envelope metadata, array buffer identity | validate envelope; do not validate every FFT bin value |
| Device/WebUSB control responses | yes | command ack shape, status bytes, capability descriptors | validate per control transaction |
| Device sample stream chunks | limited | chunk envelope metadata and byte alignment | do not parse/validate each sample value |
| File import/recording decode | yes | file header/schema version, metadata ranges | full validation before decode and ingest |
| Persistence reads (`localStorage`/IndexedDB) | yes | versioned schema and required keys | validate on read, then migrate |

### Library and Approach

- Use a lightweight schema library (recommended: Zod) for boundary schemas.
- Compile schema once per module; avoid allocation-heavy recreation.
- Expose `parse` for strict paths and `safeParse` where degraded mode fallback is allowed.

### Production vs Development Policy

- Development:
  - strict validation on all boundary envelopes.
  - verbose diagnostics for schema mismatches.
- Production:
  - strict on control/config boundaries.
  - sampled validation for high-frequency non-critical telemetry envelopes if needed.
  - never disable validation for persistence/file/device handshakes.

### Failure Mapping to Error Taxonomy (ADR 0004)

| Validation failure | Error category | Retryability | UX surface |
| --- | --- | --- | --- |
| Worker command schema mismatch | `WORKER` | `USER` | persistent banner with retry/reset action |
| Worker event payload mismatch | `WORKER` | `AUTO` then `USER` | banner + diagnostics CTA |
| Device response schema mismatch | `DEVICE` | `AUTO` for transient, then `USER` | banner with reconnect guidance |
| File import schema mismatch | `PERSISTENCE` or `INTERNAL` | `NONE` | inline import error + details affordance |
| Persisted state schema mismatch | `PERSISTENCE` | `NONE` for bad payload, continue with defaults | non-blocking warning and reset-to-default action |
| Unknown boundary parse failure | `INTERNAL` | `NONE` | blocking modal if stream safety is affected |

All `ERROR` and `FATAL` validation failures must include `diagnosticsRef` in exported diagnostics.

## Alternatives Considered

### Alternative A: No runtime validation

Rejected.

- Pros: minimal overhead and code.
- Cons: unsafe boundary trust, hard-to-debug corruption.

### Alternative B: Validate everything including inner DSP loops

Rejected.

- Pros: maximal safety.
- Cons: unacceptable CPU overhead and latency risk.

### Alternative C: Validate boundaries only

Accepted.

- Pros: strong safety at trust boundaries without hot-loop perf cliffs.
- Cons: requires clear envelope contracts and schema maintenance.

## Consequences

- Runtime cost:
  - bounded and predictable because validation is concentrated at envelopes.
- Developer ergonomics:
  - explicit schemas improve debugging and contract clarity.
  - requires schema/version updates when contracts evolve.
- Safety:
  - boundary corruption detected early with deterministic failure behavior.

## Migration / Rollout Plan

- Stage 1:
  - add schemas for worker command/event envelopes.
- Stage 2:
  - add device control response schemas and persistence read validation.
- Stage 3:
  - add file import/recording schemas and sampled production telemetry checks.
- Stage 4:
  - remove permissive legacy parsing once all boundaries are covered and tested.

## Validation Plan

- Correctness:
  - per-boundary positive and negative parse tests.
  - fuzz-like malformed envelope tests for worker and persistence boundaries.
- Performance:
  - measure startup and steady-state CPU impact before and after schema rollout.
  - ensure visual cadence and tune/audio budgets remain within limits.
- Safety:
  - verify every validation failure maps to deterministic category/retryability/UX per ADR 0004.

## Follow-Ups

- Add schema modules (suggested path: `src/contracts/schemas/*`).
- Add shared validation error mapper into radio error envelope pipeline.
- Add CI checks for boundary schema coverage and version compatibility.

Implemented delta (2026-02-23):

- Added versioned runtime telemetry contract module at `src/telemetry/runtimeTelemetryContract.ts`.
- Worker now emits `DSP_TELEMETRY` envelope carrying additive versioned DSP/AGC telemetry fields.
- App diagnostics export includes runtime telemetry schema version and versioned subcontracts.
