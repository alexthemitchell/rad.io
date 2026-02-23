# Session State Contract v1

## Status

- Version: `1.0.0`
- Contract key: `SessionStateV1`
- Top-level version field: `schemaVersion`
- Persistence version field (per ADR 0003): `sessionVersion`

## Purpose

Defines the canonical, versioned session snapshot for browser SDR runtime state in rad.io.

This contract is used for:

- Session restore from `localStorage`.
- Export in diagnostics bundles.
- Deterministic UI plus pipeline reconfiguration after reload.

This contract is not used for:

- Raw IQ or audio sample persistence.
- High-rate telemetry ring buffers.
- Stable hardware fingerprinting.

## Related Documents

- `docs/reference/contracts/frequency-model-v1.md`
- `docs/reference/contracts/rf-chain-model-v1.md`
- `docs/reference/contracts/calibration-disclosure-v1.md`
- `docs/reference/contracts/telemetry-schema-v1.md`
- `docs/reference/contracts/diagnostics-bundle-v1.md`
- `docs/decisions/0003-state-persistence-boundaries.md`
- `docs/decisions/0007-source-dsp-audio-sink-contracts.md`
- `docs/decisions/0008-runtime-schema-validation.md`

## Versioning Conventions

- `schemaVersion` is required and must be `"1.0.0"` for this contract.
- `sessionVersion` is required on persisted payload wrappers and must be `1`.
- Unknown top-level required fields must cause load failure and fallback to defaults.
- Unknown optional fields must be preserved in memory but dropped on re-save in v1.

## TypeScript Shape

```ts
export interface SessionStateV1 {
  schemaVersion: '1.0.0';
  createdAtMs: number;
  updatedAtMs: number;
  source: SessionSourceStateV1;
  tuning: SessionTuningStateV1;
  demod: SessionDemodStateV1;
  visualization: SessionVisualizationStateV1;
  ui: SessionUiStateV1;
  performance: SessionPerformanceStateV1;
  rfChain: SessionRfChainLinkV1;
  calibration: SessionCalibrationLinkV1;
}

export interface SessionSourceStateV1 {
  sourceType: 'mock' | 'rtl-sdr' | 'hackrf' | 'unknown';
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  selectedDevice?: {
    redactedDeviceId?: string;
    label?: string;
  };
  capabilitiesSnapshot: {
    sampleRateMinHz: number;
    sampleRateMaxHz: number;
    gainStages: Array<{
      name: string;
      min: number;
      max: number;
      step: number;
      unit: 'dB';
    }>;
    supportsBiasTee: boolean;
    supportsDirectSampling?: boolean;
  };
}

export interface SessionTuningStateV1 {
  centerRfHz: number;
  sampleRateHz: number;
  tuneStepHz: number;
  fineTuneOffsetHz: number;
  frequencyModel: {
    modelVersion: '1.0.0';
    tunerLoHz: number;
    ifHz: number;
    userOffsetHz: number;
    displayCenterHz: number;
  };
}

export interface SessionDemodStateV1 {
  mode: 'wfm' | 'nfm' | 'am' | 'usb' | 'lsb' | 'cw' | 'raw-iq';
  bandwidthHz: number;
  deemphasisUs: 0 | 50 | 75;
  squelchDbfs: number;
  audioMute: boolean;
  audioGainLinear: number;
}

export interface SessionVisualizationStateV1 {
  fft: {
    size: 1024 | 2048 | 4096 | 8192;
    minDbfs: number;
    maxDbfs: number;
    averagingAlpha: number;
    fpsCap: number;
  };
  waterfall: {
    palette: 'classic' | 'inferno' | 'turbo';
    speedRowsPerSec: number;
    dynamicRangeDb: number;
    paused: boolean;
  };
  scope: {
    enabled: boolean;
    decimation: number;
  };
}

export interface SessionUiStateV1 {
  selectedPrimaryView: 'spectrum' | 'waterfall' | 'scope';
  sidePanelOpen: boolean;
  diagnosticsPanelOpen: boolean;
  compactLayout: boolean;
}

export interface SessionPerformanceStateV1 {
  transportMode: 'transferable' | 'shared-array-buffer';
  degradedMode: boolean;
  workerQueueTargetMs: number;
  audioQueueTargetMs: number;
  renderFpsCap: number;
  telemetryEnabled: boolean;
}

export interface SessionRfChainLinkV1 {
  rfChainContractVersion: '1.0.0';
  activeProfileId?: string;
}

export interface SessionCalibrationLinkV1 {
  calibrationContractVersion: '1.0.0';
  frequencyState: 'uncalibrated' | 'approximate' | 'calibrated';
  levelState: 'uncalibrated' | 'approximate' | 'calibrated';
  timebaseState: 'internal-or-unknown' | 'external-disciplined';
}
```

## Defaults

| Field | Default | Notes |
| --- | --- | --- |
| `schemaVersion` | `"1.0.0"` | Required |
| `source.sourceType` | `"mock"` | No hardware assumption |
| `tuning.centerRfHz` | `99_500_000` | 99.5 MHz startup center |
| `tuning.sampleRateHz` | `2_048_000` | Works for mock plus typical USB SDR |
| `tuning.tuneStepHz` | `10_000` | 10 kHz step |
| `tuning.fineTuneOffsetHz` | `0` | Signed offset |
| `demod.mode` | `"wfm"` | MVP default path |
| `demod.bandwidthHz` | `180_000` | WFM practical default |
| `demod.deemphasisUs` | `75` | Broadcast FM default in NA profile |
| `demod.audioMute` | `false` | Audio enabled unless blocked by browser policy |
| `visualization.fft.size` | `2048` | Balanced cost/clarity |
| `visualization.fft.fpsCap` | `30` | Stable non-SAB baseline |
| `performance.transportMode` | `"transferable"` | Must not assume SAB |
| `performance.degradedMode` | `false` | Enabled when capability or budget gates fail |
| `performance.audioQueueTargetMs` | `100` | Underrun-resistant baseline |
| `performance.telemetryEnabled` | `true` | Local-only telemetry by default |

## Invariants

- Frequency values are in Hz and are finite integers.
- Time values ending in `Ms` are monotonic-clock milliseconds when runtime-produced.
- `updatedAtMs >= createdAtMs`.
- `demod.bandwidthHz > 0`.
- `visualization.fft.minDbfs < visualization.fft.maxDbfs`.
- `performance.transportMode = "shared-array-buffer"` is only valid when `crossOriginIsolated = true` and SAB exists.
- `rfChain.rfChainContractVersion` must match `rf-chain-model-v1` major version.

## Degraded and Disabled Behavior

- If session parse fails, app must load defaults and add a non-blocking diagnostics event.
- If persisted version is unknown future major version, ignore stored payload and continue with defaults.
- If SAB is unavailable, force `performance.transportMode = "transferable"` and allow `performance.degradedMode = true`.
- If telemetry is disabled, `performance.telemetryEnabled = false` is persisted, but diagnostics export still includes static environment metadata.

## Privacy and Redaction

- `selectedDevice.redactedDeviceId` must be a one-way salted hash when exported.
- User-entered labels are optional and treated as sensitive in diagnostics context.
- No persistent storage of raw USB serial strings in v1 session state.

## Exclusions (Explicit Non-Goals)

- No IQ sample buffers.
- No audio PCM blocks.
- No full telemetry history.
- No browser fingerprint fields beyond coarse runtime info in diagnostics bundle.

## Migration Rules

- Additive fields:
  - Allowed in minor versions (`1.x`).
  - Must define default.
- Breaking changes:
  - Require major bump (`2.0.0`) and migration function.
- Downgrade:
  - Unknown fields dropped.
  - Unknown enum values replaced with documented defaults.
- Deprecation policy:
  - Keep alias read support for one minor cycle, then remove.

## Example JSON

```json
{
  "schemaVersion": "1.0.0",
  "createdAtMs": 1708650000000,
  "updatedAtMs": 1708650062000,
  "source": {
    "sourceType": "hackrf",
    "connectionState": "connected",
    "selectedDevice": {
      "redactedDeviceId": "h:8ecf3c9c1d4d",
      "label": "bench-hackrf"
    },
    "capabilitiesSnapshot": {
      "sampleRateMinHz": 2000000,
      "sampleRateMaxHz": 20000000,
      "gainStages": [
        {
          "name": "LNA",
          "min": 0,
          "max": 40,
          "step": 8,
          "unit": "dB"
        }
      ],
      "supportsBiasTee": true,
      "supportsDirectSampling": false
    }
  },
  "tuning": {
    "centerRfHz": 100100000,
    "sampleRateHz": 2048000,
    "tuneStepHz": 10000,
    "fineTuneOffsetHz": -1250,
    "frequencyModel": {
      "modelVersion": "1.0.0",
      "tunerLoHz": 100100000,
      "ifHz": 0,
      "userOffsetHz": 0,
      "displayCenterHz": 100098750
    }
  },
  "demod": {
    "mode": "wfm",
    "bandwidthHz": 180000,
    "deemphasisUs": 75,
    "squelchDbfs": -95,
    "audioMute": false,
    "audioGainLinear": 1
  },
  "visualization": {
    "fft": {
      "size": 2048,
      "minDbfs": -120,
      "maxDbfs": 0,
      "averagingAlpha": 0.2,
      "fpsCap": 30
    },
    "waterfall": {
      "palette": "inferno",
      "speedRowsPerSec": 24,
      "dynamicRangeDb": 80,
      "paused": false
    },
    "scope": {
      "enabled": true,
      "decimation": 8
    }
  },
  "ui": {
    "selectedPrimaryView": "waterfall",
    "sidePanelOpen": true,
    "diagnosticsPanelOpen": false,
    "compactLayout": false
  },
  "performance": {
    "transportMode": "transferable",
    "degradedMode": false,
    "workerQueueTargetMs": 40,
    "audioQueueTargetMs": 100,
    "renderFpsCap": 30,
    "telemetryEnabled": true
  },
  "rfChain": {
    "rfChainContractVersion": "1.0.0",
    "activeProfileId": "profile:vhf-ant-1"
  },
  "calibration": {
    "calibrationContractVersion": "1.0.0",
    "frequencyState": "approximate",
    "levelState": "uncalibrated",
    "timebaseState": "internal-or-unknown"
  }
}
```
