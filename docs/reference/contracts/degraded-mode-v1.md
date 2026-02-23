# Degraded Mode Contract v1

This contract defines deterministic fallback behavior when runtime budgets are exceeded.

## Purpose

- Keep the app usable and truthful under stress.
- Prevent hard failure where a bounded quality reduction is acceptable.
- Make fallback and recovery predictable for users and tests.

## Inputs and Trigger Windows

All triggers are evaluated over explicit windows to avoid flapping.

| Trigger ID | Signal | Window | Threshold | Gate Behavior |
| --- | --- | --- | --- | --- |
| `T-UNDERRUN` | `audio_underrun_rate` | 60s rolling | `> 0.1 events/sec` | Fail closed to audio-safe fallback tier |
| `T-OVERRUN` | `pipeline_queue_overrun_count` | 60s rolling | `>= 3` | Fail closed to lower ingest/load tier |
| `T-FPS` | `fps_median` | 60s rolling | `< 50` for 2 windows | Warn first, then fail closed to render fallback tier |
| `T-WORKER-LAT` | `pipeline_latency_p95` | 60s rolling | `> 80 ms` | Fail closed to lower throughput tier |
| `T-USB-STALL` | `usb_stall_rate_per_min` | 5 min rolling | `> 1 per min` | Fail closed to reconnect + lower sample preset |
| `T-TUNE` | `tune_apply_latency_p95` | 20 tune events | `> 120 ms` | Warn and apply control-priority mode |

## Fallback Ladder

Actions are applied in order until signals return within limits.

| Tier | Action | Primary Effect | User-Visible Impact |
| --- | --- | --- | --- |
| `D0` | Normal operation | Full fidelity | None |
| `D1` | Reduce FFT update rate to 20-30 Hz | Render load drop | Smoother UI, slightly less temporal detail |
| `D2` | Reduce FFT bins/resolution and waterfall row density | CPU/GPU load drop | Lower visual detail |
| `D3` | Increase audio queue-ahead target to 80-140 ms and apply mute ramp on underrun | Underrun suppression | Slightly higher audio latency |
| `D4` | Reduce source sample-rate preset / enforce decimation | Pipeline throughput relief | Reduced bandwidth/detail |
| `D5` | Disable non-critical visual layers (scope first) | Emergency frame recovery | Minimal visual mode |

## Trigger-to-Action Map

| Trigger ID | First Action | Escalation Rule | Recovery Rule |
| --- | --- | --- | --- |
| `T-UNDERRUN` | Enter `D3` immediately | Escalate to `D4` if underruns persist for next window | Recover one tier after 2 consecutive healthy windows |
| `T-OVERRUN` | Enter `D4` | Escalate to `D5` if overrun repeats in next window | Recover one tier after overrun count is zero for 2 windows |
| `T-FPS` | Enter `D1` | Escalate to `D2` then `D5` if `fps_1pct < 30` | Recover one tier after `fps_median >= 52` for 2 windows |
| `T-WORKER-LAT` | Enter `D4` | Escalate to `D5` if p95 remains > 90 ms | Recover after p95 <= 70 ms for 2 windows |
| `T-USB-STALL` | Reconnect attempt + `D4` preset | Escalate to session warning and maintain `D4` for rest of run | Recover only after 10-minute stable stream |
| `T-TUNE` | Enable control-priority scheduling | Escalate to `D1` if UI backlog grows | Recover after 20 tune events all <= 120 ms |

## UX Contract

- Informing users:
  - Show a non-blocking status banner: `Performance protection active`.
  - Show active tier (`D1` to `D5`) and short reason (`audio underruns`, `render overload`, and so on).
- User control:
  - Automatic transitions are default.
  - Advanced panel can expose `Attempt restore` action, but never disables safety triggers.
- Transparency:
  - Diagnostics export must include trigger counts, active tier history, and transport mode (`SAB` or `transferable`).

## Recovery Rules

- Hysteresis:
  - Recovery requires two consecutive healthy windows to prevent oscillation.
- Step-down strategy:
  - Recover one tier per window; never jump directly from `D5` to `D0`.
- Re-entry guard:
  - If any trigger re-fires during recovery, stop recovery and re-apply active fallback tier.

## Failure Semantics

- Fail closed:
  - `T-UNDERRUN`, `T-OVERRUN`, `T-WORKER-LAT`, `T-USB-STALL`
- Warn then enforce:
  - `T-FPS`, `T-TUNE`

## Test Matrix

| Test | Method | Expected Result |
| --- | --- | --- |
| Induce underrun | Artificially pause worker output bursts for 200 ms intervals | `T-UNDERRUN` fires, `D3` applied, audio pop avoided |
| Render overload | Force high FFT + waterfall settings with background CPU load | `T-FPS` fires and `D1` or `D2` restores frame cadence |
| USB stall simulation | Inject transfer timeout/retry path in mock driver | `T-USB-STALL` fires and lower sample-rate preset applied |
| Recovery sanity | Remove induced stress and observe 3 windows | Tier decreases stepwise to `D0` without oscillation |

## Versioning

- Contract version: `v1`
- Backward compatibility requirement:
  - Future changes must keep existing trigger IDs stable or provide migration notes.
