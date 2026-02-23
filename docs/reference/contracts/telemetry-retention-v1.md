# Telemetry Retention Policy v1

## Status

- Version: `1.0.0`
- Contract key: `TelemetryRetentionV1`
- Top-level version field: `schemaVersion`

## Purpose

Defines bounded, privacy-aware retention for local telemetry in rad.io.

Goals:

- Keep enough recent telemetry to triage browser SDR failures.
- Avoid unbounded memory or storage growth.
- Preserve user privacy and local-only diagnostics behavior.

## Related Documents

- `docs/reference/contracts/telemetry-schema-v1.md`
- `docs/reference/contracts/diagnostics-bundle-v1.md`
- `docs/reference/contracts/session-state-v1.md`
- `docs/decisions/0003-state-persistence-boundaries.md`
- `docs/reference/support-diagnostics-entrypoints.md`

## Versioning Conventions

- `schemaVersion` is required and must equal `"1.0.0"`.
- Retention policy changes that alter exported semantics require major bump.
- Pure tuning changes (window length increase without schema changes) are minor.

## Storage Plan

- Primary store: in-memory rolling windows only.
- Default disk persistence: none.
- Export path: user-triggered diagnostics bundle generation only.
- No background uploads in MVP.

## Retention Windows by Signal Class

| Signal class | Examples | Window | Max samples | Aggregation rule |
| --- | --- | --- | --- | --- |
| High-rate histograms | `pipeline.stage_time_ms`, `render.frame_time_ms`, `usb.inter_chunk_jitter_ms` | 120 s | 20,000 observations per signal | Keep bucket counts, drop raw samples |
| Medium-rate gauges | `audio.queue_ahead_ms`, `render.fps`, `clock.audio_drift_ppm` | 15 min | 900 points per signal (1 Hz effective) | Downsample to 1 Hz median |
| Low-rate counters | `audio.underrun_total`, `usb.stall_total`, `pipeline.chunk_drop_total` | Session lifetime | N/A | Monotonic totals with window deltas |
| Events | stalls, retries, mode transitions, schema errors | 30 min | 2,000 events total | Oldest-first eviction |

## Memory Budget

- Soft cap: 8 MiB for telemetry ring buffers.
- Hard cap: 12 MiB.
- At soft cap:
  - reduce gauge cadence.
  - collapse histogram detail for oldest half-window.
- At hard cap:
  - evict oldest events first.
  - retain counters and latest 120 s of critical histograms.
  - emit event `runtime.telemetry_trimmed`.

## Export Bounds

- Diagnostics export must include at most:
  - last 15 min telemetry summary.
  - last 120 s high-rate histogram windows.
  - last 500 events after redaction.
- Maximum telemetry JSON payload target: 1.5 MiB uncompressed.
- If export exceeds limit:
  - strip debug-level events first.
  - coarsen histogram buckets.
  - include `telemetryExportTruncated: true` in manifest notes.

## Degraded and Disabled Behavior

- Telemetry disabled by policy or user:
  - no histogram/event retention.
  - keep static runtime capability flags only.
- Browser memory pressure or quota constraints:
  - disable non-essential gauges.
  - preserve budget-critical counters and histograms.
- Worker disconnected:
  - keep UI-side render and audio stats.
  - mark worker-linked signals as unavailable.

## Privacy and Redaction Requirements

- Never retain raw IQ chunks or audio PCM in telemetry buffers.
- No persistent device serial numbers.
- Hash device IDs only at export time with per-bundle salt.
- Remove free-form user text fields from events by default.
- Keep URL/query strings out of telemetry payloads.

## Implementation Notes

- Counters should be held in fixed object maps.
- Histograms should use fixed bucket arrays per signal.
- Event ring buffer should use bounded circular array.
- Export operation should snapshot buffers without stopping stream.

## Example Policy Object

```ts
export interface TelemetryRetentionV1 {
  schemaVersion: '1.0.0';
  memoryBudgetBytesSoft: 8 * 1024 * 1024;
  memoryBudgetBytesHard: 12 * 1024 * 1024;
  windows: {
    highRateSeconds: 120;
    mediumRateSeconds: 900;
    lowRateCountersSessionScoped: true;
    eventSeconds: 1800;
  };
  export: {
    maxTelemetryBytes: 1_500_000;
    maxEvents: 500;
    includeDebugEvents: false;
  };
}
```

## Migration Stub for v2+

- Introduce per-domain memory budgets (`usb`, `pipeline`, `audio`, `render`).
- Add optional persisted crash-last-window snapshot with explicit user opt-in.
- If persistence is added, define retention days and secure clear operation.
