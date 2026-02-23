# P0-0A-08 Architecture Validation Spike Plan

## Objective

Validate whether the critical path `WebUSB -> Worker -> WebAudio` meets Phase 0 budgets with reproducible measurement methods.

## Timebox and Stop Condition

- Timebox: 3 working days
- Stop condition:
  - All planned scenarios executed once with artifacts collected, or
  - Timebox expires with blockers documented and follow-up issues filed

## Environment Matrix

| Dimension | Primary Target | Secondary Target |
| --- | --- | --- |
| OS | Windows 11 | N/A |
| Browser | Chrome stable | Edge stable |
| Device | HackRF class USB SDR (if available) | Deterministic mock/file source |
| Mode | Isolated and non-isolated | Forced no-SAB fallback |

## Metrics and Gates

| Metric | Definition | Collection Method | Gate |
| --- | --- | --- | --- |
| `fps_median` | Median render FPS over 60s | rAF histogram | `>= 50` |
| `fps_1pct` | 1% low FPS over 60s | rAF histogram | `>= 30` |
| `tune_apply_latency_p95` | Tune request to applied pipeline state | Timestamp pair in control and DSP apply ack | `<= 120 ms` |
| `audio_underrun_rate` | Underruns per second over 5 min | Audio sink counter/time | `<= 0.1 events/sec` |
| `usb_stall_rate_per_min` | USB stalls/timeouts per minute | Transfer-loop counters | `<= 1/min` |
| `pipeline_latency_p95` | Ingest to audio enqueue age | Correlated sample timestamps | `<= 80 ms` baseline |

## Scenario Plan

### Scenario S1: Baseline Stream and Render

- Journey: `connect -> stream -> render -> listen`
- Inputs:
  - Preferred: physical USB SDR
  - Fallback: deterministic source if hardware unavailable
- Steps:
  1. Start app and connect source.
  2. Stream for 10 minutes at baseline preset.
  3. Capture metrics each 60s window.
- Pass conditions:
  - `fps_median`, `audio_underrun_rate`, and `usb_stall_rate_per_min` all within gate

### Scenario S2: Tune Stress

- Journey: `tune -> listen`
- Steps:
  1. Execute 20 tune operations spaced 2s apart during active stream.
  2. Record latency distribution and user-visible lag observations.
- Pass condition:
  - `tune_apply_latency_p95 <= 120 ms`

### Scenario S3: Induced Fault and Recovery

- Journey: `stream -> listen -> recover`
- Steps:
  1. Induce transient worker slowdown (fault injection or controlled CPU pressure).
  2. Observe trigger activation and degraded tier transitions.
  3. Remove fault and monitor recovery.
- Pass conditions:
  - Triggered fallback is visible in UX
  - Recovery occurs without oscillation within three windows

### Scenario S4: SAB vs Fallback A-B

- Journey: `stream -> render -> listen`
- Steps:
  1. Run scenario in isolated mode.
  2. Re-run with `window.__RADIO_FORCE_NO_SAB = true`.
  3. Compare metrics and verify no hard failure in fallback mode.
- Pass condition:
  - Non-isolated mode remains functional with expected performance reduction

## Tooling and Artifact Locations

- Metrics capture and logs:
  - `artifacts/validation/p0-0a-08/metrics/`
- Browser traces/screens:
  - `artifacts/validation/p0-0a-08/traces/`
- Notes and verdicts:
  - `docs/validation/p0-0a-08-spike-report.md`

## Reporting Contract

- Every metric receives one of: `met`, `partial`, `unknown`.
- Hardware-dependent unknowns must include a follow-up issue with acceptance criteria.
- Report must include environment details, induced fault evidence, and a gate summary table.
