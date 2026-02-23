# ADR 0007: Source, DSP, and Audio Sink Contracts

## Status

Proposed

## Date

2026-02-23

## Context

rad.io already has a source abstraction (`ISDRDevice`) plus a worker-based DSP chain and an `AudioSink` scheduler, but contracts are partly implicit and message envelopes are not yet formally versioned.

Phase 0.4 requires a shared pipeline model across Mock, File (future), and WebUSB sources without per-source branching.

## Decision

Define TypeScript-first contracts for Source -> DSP Pipeline -> Sink with explicit capability negotiation, timing metadata, backpressure behavior, and versioning.

### Contract Definitions

#### Source Contract

```ts
interface SourceContract {
  sourceId: string;
  contractVersion: 1;
  capabilities: {
    iqFormat: 'I8Q8_INTERLEAVED' | 'I16Q16_INTERLEAVED' | 'F32IQ';
    minSampleRateHz: number;
    maxSampleRateHz: number;
    gainStages: Array<{ name: string; min: number; max: number; step: number }>;
  };
  configure(config: SourceConfig): Promise<void>;
  start(onChunk: (chunk: SourceChunkEnvelope) => void): Promise<void>;
  stop(): Promise<void>;
}
```

#### DSP Stage Contract

```ts
interface DspStageContract {
  stageId: string;
  contractVersion: 1;
  configure(config: StageConfig): void;
  process(input: SampleBlock, output: SampleBlock): StageMetrics;
}
```

#### Sink Contract (Audio and Non-Audio)

```ts
interface SinkContract {
  sinkId: string;
  kind: 'AUDIO' | 'SPECTRUM' | 'SCOPE' | 'RECORDING';
  contractVersion: 1;
  push(frame: SinkFrameEnvelope): void;
  flush?(): Promise<void>;
}
```

#### Timebase and Metadata Envelope

Every hot-path frame envelope includes:

- `schemaVersion`
- `streamId`
- `sequence`
- `captureTimestampNs` (source timebase)
- `sampleRateHz`
- `centerFrequencyHz`
- `payload`

Invariants:

- `sequence` is strictly monotonic per `streamId`.
- `sampleRateHz` is constant between reconfigure events.
- Envelope metadata is mandatory even if payload format changes.

### Capability Negotiation Handshake

- Startup handshake order:
  1. Source reports capabilities.
  2. Host chooses compatible configuration for pipeline and sink.
  3. Worker acknowledges accepted config with effective parameters.
- Unsupported capability outcome:
  - deterministic error envelope (`DEVICE_UNSUPPORTED_CAPABILITY` or `DSP_CONFIG_UNSUPPORTED`).
  - no partial stream start.

### Backpressure and Buffering Rules

- Source never blocks UI thread waiting on sink.
- Worker owns bounded input queue; overflow policy is drop-oldest with counter metrics.
- Audio sink prioritizes continuity:
  - maintain queue-ahead target and report underruns (`AudioSink.getStats()`).
- Visualization sinks are lossy by design under pressure.

### Versioning Strategy

- Contract envelope uses explicit `schemaVersion` and per-interface `contractVersion`.
- Additive fields are backward-compatible.
- Renames/removals require aliasing or translation layer for one compatibility window.

## Alternatives Considered

### Alternative A: Per-source bespoke pipelines

Rejected.

- Pros: local optimization freedom.
- Cons: duplication, weak testability, high churn.

### Alternative B: Shared strict contracts

Accepted.

- Pros: reproducibility, test matrix clarity, future plugin readiness.
- Cons: upfront interface design and conformance burden.

### Alternative C: Fully plugin-driven pipeline composition now

Rejected for Phase 0.4.

- Pros: maximal flexibility.
- Cons: over-scopes MVP and increases failure surface.

## Consequences

- Testability:
  - enables matrix-based conformance testing across source types.
- Performance:
  - bounded buffering and explicit overflow policy prevent hidden latency growth.
- Extensibility:
  - easier to add File source and new demod stages without rewriting plumbing.

## Migration / Rollout Plan

- Wrap existing `ISDRDevice` implementations with source envelopes first.
- Add worker message envelope version fields while preserving current command set.
- Introduce compatibility adapter for legacy unversioned messages during transition.
- Remove adapter only after all in-repo sources pass contract conformance tests.

## Validation Plan

Use a source compatibility matrix:

| Source | Open/configure/start/stop | Envelope invariants | Capability negotiation | Budget checks |
| --- | --- | --- | --- | --- |
| Mock (`src/devices/MockDevice.ts`) | required | required | required | required |
| WebUSB HackRF (`src/devices/HackRFDevice.ts`) | required | required | required | required |
| File source (future) | required | required | required | required |

Validation activities:

- Contract conformance tests for all required methods and invariants.
- Sequence monotonicity and timestamp sanity checks in worker integration tests.
- Backpressure tests under burst load with overflow counters.
- Budget checks against tune and audio underrun thresholds.

## Follow-Ups

- Add contract types in `src/contracts/pipeline.ts`.
- Add source capability adapters for existing devices.
- Add contract-version compatibility tests to CI.
