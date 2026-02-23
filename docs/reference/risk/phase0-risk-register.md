# Phase 0 Risk Register

This register tracks Phase 0 risks that can block the critical user journey:
`connect -> stream -> render -> tune -> listen -> record -> replay`.

## Scope and Usage

- Source requirements:
  - `docs/roadmap/00_PRODUCT_DEFINITION/00_06_RISK_REGISTER_VALIDATION_SPIKES/P0-06-01_top-risks-register.md`
  - `docs/reference/mvp-quality-budgets.md`
  - `docs/roadmap/00_PRODUCT_DEFINITION/00_0A_SUCCESS_GATES_MUST_NOT_CHURN/P0-0A-08_architecture-validation-spike.md`
- Spike linkage: `docs/reference/spikes/phase0-spike-plan.md`
- Degraded behavior contract: `docs/reference/contracts/degraded-mode-v1.md`

## Rating Scale

- Impact: `H` (user-visible failure), `M` (degraded UX), `L` (limited impact)
- Likelihood: `H` (probable in baseline), `M` (possible), `L` (edge case)
- Priority score: `Impact x Likelihood`, where `H/H` is highest

## Risk Register

| ID | Journey Step | Risk | Owner | Impact | Likelihood | Mitigation | Measurable Validation Artifact | Tripwire Signal | Linked Spike |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | `connect` | WebUSB permission prompt churn or denied permissions prevent device session start. | WebUSB | H | M | Cache device selection intent, provide reconnect affordance, and improve denial copy with retry path. | `docs/validation/p0-0a-08-spike-report.md` must show `connect success >= 95%` over 20 attempts on Tier 1. | `webusb.connect_failures_per_min > 0.5` or repeated `NotAllowedError`. | S1 |
| R-02 | `stream` | Sustained USB throughput is unstable, causing stalls or sample gaps at target rates. | WebUSB | H | M | Add bounded queueing, backpressure telemetry, and sample-rate fallback presets in degraded mode. | S1 artifact captures `usb_throughput_bytes_per_sec` and `usb_stall_rate_per_min <= 1` for 10 min. | `usb.stall_rate_per_min > 1` or `queue_depth` saturation > 80% for 30s. | S1 |
| R-03 | `stream -> listen` | Worker-to-audio latency jitter produces underruns and audible artifacts. | DSP | H | M | Increase queue-ahead target under pressure and apply audio mute ramps on underrun recovery. | S2 artifact shows `audio_underrun_rate <= 0.1 events/sec` over 5 min and recovery in < 2s. | `audio.underruns_per_sec > 0.1`, `worker.audio_latency_p95 > 40 ms`. | S2 |
| R-04 | `render` | Rendering cadence drops below usable threshold with target FFT + waterfall settings. | UI/Perf | M | H | Dynamic FFT decimation, waterfall row thinning, and visual layer shedding in degraded mode. | S3 artifact shows `fps_median >= 50` and `fps_1pct >= 30` over 60s. | `render.fps_median < 50` for 60s or frame-time p95 > 25 ms. | S3 |
| R-05 | `stream -> render` | Cross-origin isolation not enabled, blocking SAB optimization path and causing extra copy overhead. | Infra | M | M | Keep SAB optional, preserve transferable path, and surface runtime transport mode diagnostics. | `docs/reference/deploy/cross-origin-isolation.md` plus S2/S3 A-B results in SAB and no-SAB modes. | `runtime.cross_origin_isolated == false` in environments tagged as production-like. | S2, S3 |
| R-06 | `stream -> render -> listen` | Degraded mode triggers are inconsistent or missing, causing either silent quality collapse or abrupt hard failures. | UX + DSP | H | M | Adopt explicit trigger thresholds and deterministic fallback ladder with user-visible status. | Contract defined in `docs/reference/contracts/degraded-mode-v1.md` and exercised in spike report fault tests. | Missing or unbounded trigger counters; no status banner during fallback actions. | S2, S3 |
| R-07 | `tune` | Tune apply latency exceeds budget under load and leads to unusable control response. | DSP | H | M | Prioritize control messages, timestamp tune pipeline stages, and enforce p95 budget gate. | Spike report must show `tune_apply_latency_p95 <= 120 ms` in baseline scenario. | `tune.apply_latency_p95 > 120 ms` for two consecutive windows. | S2 |
| R-08 | `replay` | Deterministic fixtures are insufficient to reproduce regressions, making CI gates noisy or weak. | QA/Infra | M | M | Expand deterministic source coverage and codify required scenarios in validation plan. | `docs/validation/p0-0a-08-spike-plan.md` scenario list maps each gate to deterministic source where possible. | Regressions labeled unreproducible in 2+ consecutive issues. | S2, S3 |
| R-09 | `record -> replay` | Persistence schema drift breaks saved sessions or diagnostics compatibility. | App State | M | M | Version persisted schemas and add migration tests for at least one backward hop. | `npm test` includes state migration tests before Phase 1 gate acceptance (issue tracked below). | Parse/migration failures in startup logs or diagnostics export import errors. | S4 |
| R-10 | `connect -> stream` | Browser support regression (Chrome/Edge channel changes) breaks WebUSB or audio behavior unexpectedly. | Infra | M | M | Maintain browser matrix smoke checks and document known constraints per release. | Spike report environment matrix plus follow-up issue for nightly smoke on stable/beta. | Failures isolated to one browser channel after version bump. | S1 |
| R-11 | `listen` | Audio output policy/user-gesture requirements block start on first attempt. | UX | M | M | Enforce explicit audio-enable UX step and report policy errors with guided recovery. | Validation report must include 10-run check with `time_to_audio <= 3.0s` after user action. | `audio.start_policy_errors > 0` or `time_to_audio_p95 > 3.0s`. | S2 |
| R-12 | `render -> listen` | Memory pressure from large frame buffers causes GC pauses and cascading underruns. | Perf | H | M | Cap retained history, pool allocations, and cap waterfall depth in degraded mode. | S3 report includes memory trend and no sustained heap growth > 15% during 10-min run. | Heap climb > 15%/10 min plus coincident FPS/underrun regressions. | S3 |

## Open Follow-Up Issues (Seed List)

- `P0-RISK-01`: Add connect reliability telemetry counters for permission denial and reconnect loops.
- `P0-RISK-02`: Add throughput + stall instrumentation in `src/telemetry/` for USB pipeline.
- `P0-RISK-03`: Add state migration test scaffold for persisted session schema.
- `P0-RISK-04`: Add browser matrix smoke check job for Chrome and Edge.

## Review Cadence

- Update cadence: weekly in Phase 0, then before each Phase 1 gate review.
- Exit condition for Phase 0: no `H/H` risk remains without an accepted mitigation and validation artifact.
