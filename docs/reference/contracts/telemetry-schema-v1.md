# Telemetry Schema Contract v1

## Status

- Version: `1.0.0`
- Contract key: `TelemetrySchemaV1`
- Top-level version field: `schemaVersion`

## Purpose

Defines local-only telemetry signals for budgets, diagnostics, and triage in browser SDR runtime.

The schema covers:

- USB/WebUSB health for HackRF and RTL-SDR adapters.
- DSP worker pipeline timing and drops.
- Audio sink underrun and continuity state.
- Render cadence and dropped-frame pressure.
- Capability context such as cross-origin isolation and SAB availability.

## Related Documents

- `docs/reference/contracts/telemetry-retention-v1.md`
- `docs/reference/contracts/diagnostics-bundle-v1.md`
- `docs/reference/contracts/session-state-v1.md`
- `docs/decisions/0002-sharedarraybuffer-strategy.md`
- `docs/decisions/0004-error-taxonomy-user-facing-ux.md`
- `docs/reference/mvp-quality-budgets.md`

## Versioning Conventions

- `schemaVersion` is required and must be `"1.0.0"`.
- Signal identifier format is stable: `<domain>.<name>`.
- Signal metadata carries `unit`, `kind`, and `aggregation`.
- New signals in v1 minor versions must be additive and optional for readers.

## Signal Kinds

- Counter: monotonic increasing integer, reset only on process restart.
- Gauge: current value sample.
- Histogram: bounded bucket distribution in a rolling window.
- Event: point-in-time envelope with context payload.

## Time Base

- `tsMonoMs` uses monotonic runtime clock (`performance.now()` basis).
- `windowStartMonoMs` and `windowEndMonoMs` bound rolling aggregates.
- Wall-clock time is not used for in-process timing math.

## TypeScript Shape

```ts
export interface TelemetrySchemaV1 {
  schemaVersion: '1.0.0';
  streamId: string;
  captureMode: 'mock' | 'rtl-sdr' | 'hackrf';
  environment: {
    crossOriginIsolated: boolean;
    sharedArrayBufferAvailable: boolean;
    transportMode: 'transferable' | 'shared-array-buffer';
    telemetryEnabled: boolean;
    degradedMode: boolean;
  };
  counters: TelemetryCounterV1[];
  gauges: TelemetryGaugeV1[];
  histograms: TelemetryHistogramV1[];
  events: TelemetryEventV1[];
}

export interface TelemetryCounterV1 {
  signal: string;
  unit: 'count' | 'bytes';
  value: number;
  windowStartMonoMs: number;
  windowEndMonoMs: number;
}

export interface TelemetryGaugeV1 {
  signal: string;
  unit:
    | 'ms'
    | 'hz'
    | 'bytes_per_sec'
    | 'frames_per_sec'
    | 'samples_per_sec'
    | 'ratio';
  value: number;
  tsMonoMs: number;
}

export interface TelemetryHistogramV1 {
  signal: string;
  unit: 'ms' | 'samples' | 'bytes';
  bucketBounds: number[];
  bucketCounts: number[];
  samples: number;
  p50: number;
  p95: number;
  p99: number;
  windowStartMonoMs: number;
  windowEndMonoMs: number;
}

export interface TelemetryEventV1 {
  signal: string;
  severity: 'debug' | 'info' | 'warn' | 'error';
  tsMonoMs: number;
  attrs?: Record<string, string | number | boolean | null>;
}
```

## Canonical Signals

| Signal | Kind | Unit | Default sampling | Meaning |
| --- | --- | --- | --- | --- |
| `usb.bytes_rx_total` | counter | bytes | per USB chunk | Total bytes received from device USB stream |
| `usb.stall_total` | counter | count | on WebUSB stall | Count of stalled control or bulk transactions |
| `usb.retry_total` | counter | count | on retry | Retry attempts after transient transfer errors |
| `usb.inter_chunk_jitter_ms` | histogram | ms | each chunk | Inter-arrival jitter for source chunks |
| `pipeline.chunk_drop_total` | counter | count | on drop | Dropped source chunks before worker consume |
| `pipeline.overrun_total` | counter | count | on queue overflow | Worker input queue overrun count |
| `pipeline.underrun_total` | counter | count | on sink starvation | Pipeline starvation observed downstream |
| `pipeline.stage_time_ms` | histogram | ms | per stage frame | Processing duration per DSP stage |
| `worker.msg_latency_ms` | histogram | ms | each message pair | UI-to-worker and worker-to-UI envelope latency |
| `audio.underrun_total` | counter | count | on underrun | Audio sink underruns from scheduler stats |
| `audio.mute_ramp_total` | counter | count | on ramp | Mute ramp or click-prevention ramp triggers |
| `audio.queue_ahead_ms` | gauge | ms | 5 Hz | Current scheduled audio horizon |
| `render.frame_time_ms` | histogram | ms | each frame | Render loop frame time |
| `render.dropped_frame_total` | counter | count | on miss | Dropped or skipped UI frames |
| `render.fps` | gauge | frames_per_sec | 1 Hz | Smoothed frame rate |
| `clock.audio_drift_ppm` | gauge | ratio | 1 Hz | Relative drift proxy between audio and source clocks |
| `runtime.cross_origin_isolated` | gauge | ratio | on change | `1` if isolated, else `0` |
| `runtime.telemetry_backpressure_total` | counter | count | on trim | Number of times telemetry had to discard high-rate samples |

## Budget-to-Signal Mapping

| Budget gate | Primary signal | Secondary signal | Pass interpretation |
| --- | --- | --- | --- |
| Tune apply latency p95 <= 120 ms | `worker.msg_latency_ms` p95 | `pipeline.stage_time_ms` p95 | Worker apply path remains within threshold |
| Audio underrun <= 0.1 events/sec | `audio.underrun_total` rate | `audio.queue_ahead_ms` | Low underruns and healthy queue horizon |
| Visual cadence >= 50 FPS median | `render.fps` | `render.frame_time_ms` p50 | Sustained frame cadence without excessive misses |
| Reconnect <= 5 s | `usb.retry_total` events | `worker.msg_latency_ms` | Recovery sequence completes quickly |
| Streaming stability | `pipeline.chunk_drop_total` | `usb.inter_chunk_jitter_ms` p95 | Drops and jitter remain bounded |

## Defaults and Sampling Rules

- Counter initialization is `0` on app start or stream restart.
- Gauge default is absent until first sample.
- Histogram buckets must be fixed per signal for whole major version.
- Recommended defaults:
  - `worker.msg_latency_ms` buckets: `[1, 2, 4, 8, 16, 32, 64, 128, 256]`.
  - `pipeline.stage_time_ms` buckets: `[0.25, 0.5, 1, 2, 4, 8, 16]`.
  - `render.frame_time_ms` buckets: `[4, 8, 12, 16, 20, 33, 50, 66]`.

## Invariants

- All counters are non-negative integers.
- Histogram `bucketCounts.length === bucketBounds.length + 1`.
- Histogram percentiles must be non-decreasing: `p50 <= p95 <= p99`.
- Signal identifiers are lowercase ASCII with dot separators.
- `transportMode = "shared-array-buffer"` implies `crossOriginIsolated = true`.

## Degraded or Disabled Telemetry Behavior

- If telemetry is disabled by user setting:
  - Keep minimal `environment` block only.
  - Do not accumulate counters, gauges, histograms, or events.
- If telemetry memory budget is exceeded:
  - Preserve counters.
  - Downsample gauges.
  - Merge histogram buckets using retention policy.
  - Emit `runtime.telemetry_backpressure_total` and event `runtime.telemetry_trimmed`.
- If worker timing hooks fail:
  - Mark stage timing unavailable using event `pipeline.stage_timing_unavailable`.
  - Continue stream processing.

## Privacy and Redaction

- Device identifiers are never raw in telemetry attributes.
- User labels, free-form notes, and URLs are excluded from high-rate event payloads.
- No IQ payload fragments or PCM samples are allowed in telemetry signals.

## Example JSON

```json
{
  "schemaVersion": "1.0.0",
  "streamId": "stream-20260223-001",
  "captureMode": "hackrf",
  "environment": {
    "crossOriginIsolated": false,
    "sharedArrayBufferAvailable": false,
    "transportMode": "transferable",
    "telemetryEnabled": true,
    "degradedMode": false
  },
  "counters": [
    {
      "signal": "usb.bytes_rx_total",
      "unit": "bytes",
      "value": 50331648,
      "windowStartMonoMs": 1200,
      "windowEndMonoMs": 81200
    },
    {
      "signal": "audio.underrun_total",
      "unit": "count",
      "value": 2,
      "windowStartMonoMs": 1200,
      "windowEndMonoMs": 81200
    }
  ],
  "gauges": [
    {
      "signal": "render.fps",
      "unit": "frames_per_sec",
      "value": 53,
      "tsMonoMs": 81192
    }
  ],
  "histograms": [
    {
      "signal": "worker.msg_latency_ms",
      "unit": "ms",
      "bucketBounds": [1, 2, 4, 8, 16, 32, 64, 128],
      "bucketCounts": [4, 19, 122, 403, 78, 9, 1, 0, 0],
      "samples": 636,
      "p50": 6.8,
      "p95": 13.1,
      "p99": 21.4,
      "windowStartMonoMs": 1200,
      "windowEndMonoMs": 81200
    }
  ],
  "events": [
    {
      "signal": "usb.stall_detected",
      "severity": "warn",
      "tsMonoMs": 53222,
      "attrs": {
        "source": "hackrf",
        "recoverable": true
      }
    }
  ]
}
```

## Migration Stub for v2+

- Reserve new top-level `capabilities` block for negotiated telemetry feature flags.
- Introduce per-signal `revision` when semantics evolve without renaming.
- If histogram model changes, keep v1 compatibility export for one minor cycle.
