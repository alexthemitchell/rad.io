# ADR 0004: Error Taxonomy and User-Facing Error UX

## Status

Accepted

## Date

2026-02-23

## Context

rad.io already has an initial typed device error (`SDRDeviceError`) and normalization logic in `src/devices/errors.ts`, while other layers still emit ad-hoc exceptions and console errors (`src/App.tsx`, `src/dsp/worker.ts`, device adapters).

Without a unified taxonomy, retry behavior and UX surfacing become inconsistent, and diagnostics are harder to correlate across UI, worker, and device boundaries.

## Decision

Define a single typed error envelope and deterministic mapping to UX surface, retry policy, and diagnostics linkage.

### Canonical Error Envelope

```ts
interface RadioErrorEnvelope {
  code: string;
  category: 'DEVICE' | 'DSP' | 'WORKER' | 'PERSISTENCE' | 'NETWORK' | 'INTERNAL';
  severity: 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  retryability: 'AUTO' | 'USER' | 'NONE';
  userActionable: boolean;
  message: string;
  details?: string;
  cause?: unknown;
  diagnosticsRef?: string;
  occurredAt: string;
}
```

### Category Coverage

- `DEVICE`: WebUSB permission, transfer, stream start/runtime failures.
- `DSP`: demod/stage processing failures, invalid sample format.
- `WORKER`: message contract violations, worker bootstrap/termination faults.
- `PERSISTENCE`: localStorage/IndexedDB parse/write/migration failures.
- `NETWORK`: remote fetch or optional service communication failures.
- `INTERNAL`: unexpected code path or uncategorized exception.

### Retryability Rules

- `AUTO`:
  - transient device transfer interruption, temporary worker backpressure.
  - bounded automatic retries with jitter and cap.
- `USER`:
  - permission denied, device busy, recoverable configuration mismatch.
  - explicit user affordance to retry.
- `NONE`:
  - schema incompatibility, unsupported browser capability, corrupted required payload.

### UX Mapping Rules

| Severity and actionability | UX surface | Blocking | Copy pattern |
| --- | --- | --- | --- |
| `INFO` non-actionable | inline status text | no | short state update |
| `WARN` actionable | toast + inline recommendation | no | summary + one clear action |
| `ERROR` actionable | persistent banner with action button | sometimes | summary + action + details disclosure |
| `ERROR` non-actionable | banner + diagnostics CTA | yes if stream cannot continue | summary + export diagnostics |
| `FATAL` | modal dialog and stream stop | yes | summary + next step + diagnostics reference |

Copy guidance:

- First sentence: what failed in plain language.
- Second sentence: exact next action if user-actionable.
- Optional details affordance for technical text and error code.

### Diagnostics Linkage

- Every `ERROR`/`FATAL` event generates a `diagnosticsRef` token.
- Diagnostics export includes:
  - error envelope
  - current source/mode/frequency state
  - recent event timeline (already in `diagnosticEvents`)
- Privacy:
  - no raw IQ/audio payloads
  - no automatic network upload in MVP

## Alternatives Considered

### Alternative A: Keep ad-hoc per-module errors

Rejected.

- Pros: fastest short-term coding.
- Cons: inconsistent UX, poor observability, brittle support playbooks.

### Alternative B: Central typed taxonomy

Accepted.

- Pros: deterministic UX and retry policy, clear diagnostics contracts.
- Cons: requires migration work and developer discipline.

### Alternative C: Adopt external heavy error framework

Rejected.

- Pros: feature-rich out of the box.
- Cons: additional dependency and abstraction overhead not justified for current scope.

## Consequences

- Developer ergonomics:
  - easier to reason about retry behavior and user messaging.
  - requires all subsystem boundaries to map thrown errors into envelope form.
- UX consistency:
  - fewer conflicting message styles, better accessibility and supportability.
- Observability:
  - diagnostics become queryable by category/code/severity.

## Migration / Rollout Plan

- Phase 1:
  - keep existing `SDRDeviceError` codes, wrap into canonical envelope at UI boundary.
- Phase 2:
  - add worker and persistence code mappings.
- Phase 3:
  - disallow raw `Error` display in UI; require envelope normalization before rendering.

## Validation Plan

- Unit tests for category/severity/retryability mapping.
- Contract tests that each known failure path maps to one deterministic UX surface.
- Snapshot tests for copy format (summary + details affordance).
- Manual support flow test: trigger error, export diagnostics, confirm `diagnosticsRef` correlation.

## Follow-Ups

- Add centralized mapper (suggested path: `src/errors/radioError.ts`).
- Extend diagnostics export payload in `src/App.tsx` with `errors` array and `diagnosticsRef`.
- Align runtime schema validation failure mapping with this ADR (see ADR 0008).
