# Phase 0 Spike Plan

This plan retires the highest-risk unknowns using short, measurable spikes.

## Source Requirements

- `docs/roadmap/00_PRODUCT_DEFINITION/00_06_RISK_REGISTER_VALIDATION_SPIKES/P0-06-02_spike-plan-2-3-timeboxed-spikes.md`
- `docs/roadmap/00_PRODUCT_DEFINITION/00_0A_SUCCESS_GATES_MUST_NOT_CHURN/P0-0A-08_architecture-validation-spike.md`
- `docs/reference/risk/phase0-risk-register.md`
- `docs/reference/mvp-quality-budgets.md`

## Measurement Contract (Shared Across Spikes)

| Metric | Definition | Collection Method | Gate Threshold | Telemetry Hook |
| --- | --- | --- | --- | --- |
| `fps_median` / `fps_1pct` | Render frame-rate distribution over 60s windows. | `requestAnimationFrame` frame interval histogram. | `fps_median >= 50`, `fps_1pct >= 30` | `render.fps` histogram in `src/telemetry/` |
| `tune_apply_latency_p95` | Tune request to pipeline-applied timestamp. | Timestamp at UI request and DSP apply ack. | `<= 120 ms` | `pipeline.tune_latency_ms` |
| `audio_underrun_rate` | Audio underruns per second over 5 min. | Audio sink underrun counter delta/time. | `<= 0.1 events/sec` | `audio.underrun_count` |
| `usb_stall_rate_per_min` | USB transfer stalls/timeouts per minute. | Transfer loop error + timeout counters. | `<= 1 per min` | `usb.transfer_stalls` |
| `pipeline_latency_p95` | USB ingest to audio enqueue age. | Correlated sample timestamps through worker. | `<= 80 ms` baseline | `pipeline.e2e_latency_ms` |

## Execution Rules

- Timebox policy: each spike is `<= 3 working days` and has a stop condition.
- Repeats: run each primary scenario three times and use median for verdict.
- Deterministic-first: if hardware is unavailable, execute deterministic subset and mark hardware-only verdicts as `unknown`.
- Status labels: `met`, `partial`, `unknown`.

## Spike S1: WebUSB Sustained Throughput and Stability

- Linked risks: `R-01`, `R-02`, `R-10`
- Timebox: 2 days
- Journey focus: `connect -> stream`
- In scope:
  - Connect/disconnect reliability over repeated sessions
  - 10-minute sustained streaming stall behavior at target rates
- Out of scope:
  - Final UI polish for permission UX
  - Non-Chromium browser fixes
- Tooling:
  - Browser DevTools performance trace
  - Runtime telemetry counters (`usb.transfer_stalls`, `usb.bytes_per_sec`)
- Success criteria:
  - `connect success >= 95%` over 20 attempts
  - `usb_stall_rate_per_min <= 1` during 10-minute run
  - No unrecovered stream stop in baseline run
- Artifacts:
  - `docs/validation/p0-0a-08-spike-report.md` section `S1`
  - Raw traces under `artifacts/validation/p0-0a-08/s1/`
- Stop condition:
  - All three criteria met, or timebox expired with documented blockers

## Spike S2: Worker-to-Audio Latency and Underrun Recovery

- Linked risks: `R-03`, `R-06`, `R-07`, `R-11`
- Timebox: 3 days
- Journey focus: `stream -> tune -> listen`
- In scope:
  - End-to-end latency and tune apply latency under load
  - Induced underrun recovery behavior and mute ramp correctness
  - SAB vs no-SAB comparison for audio-path stability
- Out of scope:
  - Advanced demod feature tuning
- Tooling:
  - Worker and audio timestamp probes
  - Forced fallback flag (`window.__RADIO_FORCE_NO_SAB = true`)
- Success criteria:
  - `tune_apply_latency_p95 <= 120 ms`
  - `audio_underrun_rate <= 0.1 events/sec` over 5 min
  - Recovery from induced underrun within 2s without speaker pop
- Artifacts:
  - `docs/reference/contracts/degraded-mode-v1.md` test mapping
  - `docs/validation/p0-0a-08-spike-report.md` section `S2`
  - Raw logs under `artifacts/validation/p0-0a-08/s2/`
- Stop condition:
  - Thresholds stable for three runs, or explicit issue list opened

## Spike S3: 60 FPS Visualization Feasibility and Memory Pressure

- Linked risks: `R-04`, `R-05`, `R-12`
- Timebox: 2 days
- Journey focus: `render`
- In scope:
  - FFT/waterfall rendering cadence at MVP presets
  - Degraded mode fallback ladder impact on FPS and memory
- Out of scope:
  - Design system and visual styling changes
- Tooling:
  - Browser performance panel
  - Heap snapshots at start, 5 min, 10 min
- Success criteria:
  - `fps_median >= 50`, `fps_1pct >= 30`
  - No sustained heap growth > 15% over 10 min baseline
  - Degraded mode restores FPS above 45 within 5s of activation
- Artifacts:
  - `docs/validation/p0-0a-08-spike-report.md` section `S3`
  - Charts under `artifacts/validation/p0-0a-08/s3/`
- Stop condition:
  - Pass/fail verdict documented with one recommended default preset set

## Optional Spike S4: Persistence and Replay Contract Sanity

- Linked risks: `R-08`, `R-09`
- Timebox: 1 day
- Journey focus: `record -> replay`
- Trigger to run:
  - Execute only if S1-S3 expose state/fixture ambiguity
- Success criteria:
  - At least one migration test path drafted and deterministic replay fixture validated
- Artifact:
  - Follow-up issue and test scaffold PR

## How to Execute

1. Create a branch named `spike/p0-phase0-gates`.
2. Create artifact directories under `artifacts/validation/p0-0a-08/s1`, `s2`, `s3`.
3. Run baseline scenario, then induced-fault scenario, then fallback-mode scenario.
4. Record metrics in `docs/validation/p0-0a-08-spike-report.md` with `met/partial/unknown` verdicts.
5. Open follow-up issues for each `partial` or `unknown` outcome with measurable acceptance criteria.
