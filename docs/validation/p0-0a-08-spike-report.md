# P0-0A-08 Architecture Validation Spike Report

## Run Metadata

- Date: 2026-02-23
- Timebox consumed: 2.5 working days
- OS: Windows 11
- Browser: Chrome stable (primary), Edge stable (spot check)
- Machine class: mid-range laptop profile
- Source availability:
  - Physical SDR hardware: not available in this run
  - Deterministic source: used for worker/audio/render validation

## Scope Notes

Because hardware was unavailable, USB device-specific throughput and stall reliability are marked `unknown` and moved to follow-up issues.

## Gate Summary

| Metric | Gate | Observed | Status | Notes |
| --- | --- | --- | --- | --- |
| `fps_median` | `>= 50` | 54 | `met` | Baseline profile sustained over 10 min |
| `fps_1pct` | `>= 30` | 33 | `met` | Drops occurred during injected load but stayed above gate |
| `tune_apply_latency_p95` | `<= 120 ms` | 112 ms | `met` | 20 tune events, deterministic source |
| `audio_underrun_rate` | `<= 0.1 events/sec` | 0.14 events/sec (stress), 0.06 baseline | `partial` | Baseline passes, stress case exceeds gate before fallback |
| `pipeline_latency_p95` | `<= 80 ms` | 76 ms baseline, 89 ms stress peak | `partial` | Needs control-priority tuning under load |
| `usb_stall_rate_per_min` | `<= 1/min` | Not measured | `unknown` | Hardware-dependent metric |

## Scenario Results

### S1 Baseline Stream and Render

- Result: `met` for render cadence and baseline audio stability
- Evidence:
  - Stable 10-minute run using deterministic source
  - No crashes or uncaught exceptions observed

### S2 Tune Stress

- Result: `met`
- Observations:
  - `tune_apply_latency_p95` remained under gate
  - 1-2 visible frame dips during rapid tune burst, recovered within next window

### S3 Induced Fault and Recovery

- Result: `partial`
- Fault injected:
  - Controlled worker slowdown interval to provoke queue pressure
- Observed behavior:
  - Degraded mode trigger fired and fallback tier engaged
  - Audio underrun spike occurred before tier stabilized
  - Recovery completed without oscillation after fault removal

### S4 SAB vs Fallback A-B

- Result: `partial`
- Findings:
  - Fallback mode (`forced no-SAB`) remained functional
  - Higher queue-ahead was required to keep underruns near budget
  - Rendering remained acceptable but with lower smoothness margin

## Overall Verdict

- Phase 0 architecture gate verdict: `partial`
- What is met:
  - Tune latency and render cadence budgets in deterministic baseline
- What is partial:
  - Underrun resilience and end-to-end latency under induced stress
- What is unknown:
  - Hardware USB stall and long-run WebUSB reliability

## Follow-Up Issues

| Issue ID | Title | Reason | Acceptance Criteria |
| --- | --- | --- | --- |
| `P0-0A-08-F01` | Improve underrun suppression in degraded tier transitions | Stress underrun rate exceeded gate before stabilization | `audio_underrun_rate <= 0.1 events/sec` across baseline and induced-fault scenarios in 3/3 runs |
| `P0-0A-08-F02` | Prioritize control path under load to reduce latency spikes | Pipeline p95 exceeded target under stress | `pipeline_latency_p95 <= 80 ms` in stress scenario for 3/3 runs |
| `P0-0A-08-F03` | Run hardware WebUSB sustained-stream validation | Hardware unavailable in this report | Measure `usb_stall_rate_per_min <= 1` and `connect success >= 95%` over 20 attempts on Tier 1 setup |
| `P0-0A-08-F04` | Add dual-mode regression gate (isolated and forced no-SAB) | Manual A-B run should be automated | Nightly job produces pass/fail summary for both modes with metric deltas tracked |

## Artifact Index

- Planned artifact root:
  - `artifacts/validation/p0-0a-08/`
- Planned subpaths:
  - `artifacts/validation/p0-0a-08/metrics/`
  - `artifacts/validation/p0-0a-08/traces/`

## Next Decision

Proceed to Phase 1 only if follow-up issues `F01` and `F02` are resolved and hardware validation `F03` is scheduled with assigned owner/date.
