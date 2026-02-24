# ADR 0002: SharedArrayBuffer Strategy

## Status

Accepted

## Date

2026-02-23

## Context

rad.io currently moves IQ and analysis payloads across the UI and DSP worker boundary using `postMessage` and transferable `ArrayBuffer` objects (`src/App.tsx`, `src/dsp/worker.ts`).

At 2 MSPS IQ input plus FFT, scope, audio, and RDS side channels, transport overhead and GC pressure can consume meaningful frame budget and increase underrun risk. `SharedArrayBuffer` (SAB) can reduce copy churn and improve timing stability, but it is only available in cross-origin-isolated contexts (COOP/COEP) and is therefore a deployment constraint.

Phase 0 requires contracts first and degraded mode support. SAB cannot be a mandatory runtime prerequisite for MVP.

## Decision

SAB is optional in Phase 0.4 and must always have a supported fallback path.

### Prerequisites and Policy

- SAB path requires cross-origin isolation:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`
- Fallback path remains first-class when `crossOriginIsolated` is `false`.
- Build, CI, and release checks must test both modes.

### Runtime Detection and Gating Rules

- Detect once during app bootstrap and cache capability in runtime config.
- Required check:
  - `typeof SharedArrayBuffer === 'function'`
  - `self.crossOriginIsolated === true`
- Add an explicit test override for deterministic validation:
  - `window.__RADIO_FORCE_NO_SAB = true` in dev/test harness.
- Effective mode selection:
  - `sabEnabled = detectedSab && !forcedNoSab`

### Data Transport Rules

- SAB enabled:
  - IQ hot path uses fixed-size ring buffer in shared memory.
  - Control/event channels remain versioned message envelopes over `postMessage`.
  - Audio/FFT snapshots may stay transferable when cheaper than shared ownership.
- SAB disabled:
  - Existing transferable `ArrayBuffer` transport remains authoritative.
  - Avoid structured-clone copies for bulk sample payloads.

### Degraded Mode Contract (No SAB)

When SAB is unavailable, app remains functional with explicit budgets and feature behavior:

- Max source sample rate defaults to 2.0 MSPS; no higher experimental rate presets.
- FFT update cadence target reduces to 20-30 Hz (from 40-60 Hz goal in SAB mode).
- Scope updates remain sampled/throttled.
- Audio queue target increases (for example 80-140 ms ahead) to reduce underruns.
- Diagnostics marks transport mode so bug reports can distinguish SAB vs non-SAB.

## Alternatives Considered

### Alternative A: Require COOP/COEP and SAB always

Rejected.

- Pros: simpler code path, best throughput headroom.
- Cons: excludes many hosting setups, introduces security header rollout risk, violates degraded mode requirement.

### Alternative B: Optional SAB with fallback

Accepted.

- Pros: preserves compatibility while enabling performance optimization when available.
- Cons: dual-path complexity and expanded test matrix.

### Alternative C: Never use SAB

Rejected.

- Pros: simplest deployment and debugging.
- Cons: leaves avoidable copy overhead in hot paths and limits scaling headroom.

## Consequences

- Deployment and security:
  - Hosting profiles must explicitly document COOP/COEP configuration and third-party asset constraints.
  - Security posture tightens under cross-origin isolation, but integration complexity rises.
- Runtime and performance:
  - SAB path reduces transport jitter and GC churn in sustained streaming sessions.
  - Fallback path may see higher CPU overhead and lower visualization cadence, but remains within MVP budgets.
- Product and support:
  - Users on non-isolated hosts get degraded mode, not hard failure.
  - Diagnostics must include transport mode to speed triage.

## Migration / Rollout Notes

- Phase 0.4 rollout sequence:
  1. Introduce transport capability flag and diagnostics field.
  2. Keep transferable-only path as default until dual-mode test coverage is green.
  3. Enable SAB ring buffer path behind capability gate.
  4. Publish hosting guidance for COOP/COEP rollout and fallback behavior.
- If hosting cannot satisfy COOP/COEP, no rollback is needed; fallback remains supported.

## Validation Plan

- Functional:
  - Run stream start/stop, tune, demod mode switch, and diagnostics export in both modes.
  - Verify no-SAB forced mode works in local dev and CI.
- Performance budgets:
  - Track tune apply latency p95 (`<= 120 ms`) and underrun rate (`<= 0.1 events/sec over 5 min`) from `docs/reference/mvp-quality-budgets.md`.
  - Compare UI render FPS and queue-ahead telemetry between modes.
- Safety:
  - Confirm mode detection is deterministic and never crashes when SAB is unavailable.

## Follow-Ups

- Define transport capability module (suggested path: `src/runtime/capabilities.ts`).
- Add transport mode field to diagnostics payload in `src/App.tsx` export bundle.
- Add CI scenario for forced no-SAB execution path.
