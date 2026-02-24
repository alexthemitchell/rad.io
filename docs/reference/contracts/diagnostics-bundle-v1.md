# Diagnostics Bundle Contract v1

## Status

- Version: `1.0.0`
- Contract key: `DiagnosticsBundleV1`
- Top-level version field: `bundleVersion`

## Purpose

Defines a versioned, user-exported diagnostics package for triage of browser SDR issues in rad.io.

The bundle answers:

- What app/runtime environment was active?
- What source/device and session configuration were used?
- What telemetry and errors happened recently?
- Is this likely reproducible with current fixtures?

## Related Documents

- `docs/reference/contracts/session-state-v1.md`
- `docs/reference/contracts/telemetry-schema-v1.md`
- `docs/reference/contracts/telemetry-retention-v1.md`
- `docs/reference/contracts/frequency-model-v1.md`
- `docs/reference/contracts/rf-chain-model-v1.md`
- `docs/decisions/0004-error-taxonomy-user-facing-ux.md`
- `docs/decisions/0008-runtime-schema-validation.md`
- `docs/reference/support-diagnostics-entrypoints.md`

## Packaging Format

- Container format: ZIP archive.
- Default filename pattern:
  - `radio-diagnostics-<utcYYYYMMDD>-<hhmmss>-v1.zip`
- Bundle root directory name inside zip:
  - `radio-diagnostics-v1/`

## Versioning Conventions

- `bundleVersion` must be `"1.0.0"`.
- Referenced contract payloads retain their own `schemaVersion` fields.
- Any incompatible manifest rename or required file change requires major bump.

## Required Bundle Files

| Path | Required | Description |
| --- | --- | --- |
| `manifest.json` | yes | Bundle metadata and file index |
| `session-state.json` | yes | Snapshot matching Session State contract |
| `telemetry.json` | yes | Telemetry snapshot with retention limits applied |
| `errors.json` | yes | Error envelopes mapped to ADR 0004 taxonomy |
| `pipeline-config.json` | yes | Effective source, DSP, sink configuration summary |
| `redaction-report.json` | yes | Redaction actions and omitted fields list |

## Optional Bundle Files

| Path | Required | Description |
| --- | --- | --- |
| `screenshots/*.png` | no | User-captured UI state images |
| `exports/*.json` | no | User-exported settings files |
| `artifacts/trace-notes.md` | no | User-authored repro steps |
| `fixtures/*.iqmeta.json` | no | Metadata-only sample references (no raw IQ by default) |

## TypeScript Shape

```ts
export interface DiagnosticsBundleV1 {
  bundleVersion: '1.0.0';
  createdAtIso: string;
  manifest: DiagnosticsManifestV1;
  environment: DiagnosticsEnvironmentV1;
  sessionState: unknown; // Must satisfy SessionStateV1
  telemetry: unknown; // Must satisfy TelemetrySchemaV1
  runtimeTelemetry?: {
    telemetrySchemaVersion: '1.1.0';
    dsp: {
      pipelineTiming: { contractVersion: '1.0.0' };
      amplitude: { contractVersion: '1.0.0' };
      demodQuality: { contractVersion: '1.0.0' };
    };
    agc: { contractVersion: '1.0.0'; implemented: false };
  };
  errors: RadioErrorEnvelopeV1[];
  pipelineConfig: DiagnosticsPipelineConfigV1;
  redactionReport: DiagnosticsRedactionReportV1;
  optionalArtifacts?: DiagnosticsOptionalArtifactsV1;
}

export interface DiagnosticsManifestV1 {
  bundleId: string;
  appVersion: string;
  buildHash: string;
  schemaRefs: {
    sessionState: '1.0.0';
    telemetry: '1.0.0';
    frequencyModel: '1.0.0';
    rfChainModel: '1.0.0';
    calibrationDisclosure: '1.0.0';
  };
  fileIndex: Array<{ path: string; required: boolean; sha256?: string }>;
  telemetryExportTruncated: boolean;
}

export interface DiagnosticsEnvironmentV1 {
  browserUserAgent: string;
  browserName: 'chrome' | 'edge' | 'other';
  browserVersion: string;
  osFamily: 'windows' | 'macos' | 'linux' | 'other';
  secureContext: boolean;
  crossOriginIsolated: boolean;
  sharedArrayBufferAvailable: boolean;
  audioWorkletAvailable: boolean;
  webUsbAvailable: boolean;
  permissionState: {
    usb: 'granted' | 'denied' | 'prompt' | 'unknown';
    microphone: 'granted' | 'denied' | 'prompt' | 'unknown';
  };
}
```

## Manifest Invariants

- `createdAtIso` must be valid UTC ISO-8601 string.
- `manifest.bundleId` must be unique per export.
- `fileIndex` must list all required files.
- If `telemetryExportTruncated = true`, manifest notes must include reason.

## Redaction and Privacy Rules

Must redact or omit by default:

- Raw USB serial numbers, raw device IDs, and full descriptor strings.
- User free-form labels, notes, and local file paths.
- URLs and query strings that can contain personal context.
- Raw IQ and raw audio payloads.

Allowed after transformation:

- Device identity as bundle-local salted hash.
- Capability summaries (`sampleRateMinHz`, gain range, bias-tee support).
- Error codes and categories without personal text payload.

`redaction-report.json` must include:

- Salt strategy used (`bundle-local random salt`, not persisted).
- Count of fields removed.
- Count of fields hashed.
- Paths of omitted optional artifacts.

## Replay vs Inspect Expectations

- Triage guarantee (required):
  - Bundle must allow support to classify issue domain (device, worker, DSP, render, audio).
- Deterministic replay (not guaranteed in v1):
  - Not guaranteed without dedicated fixtures and deterministic source playback.
- Replay-ready subset (future):
  - Session plus telemetry plus fixture references may support partial replay in v2+.

## Degraded or Disabled Telemetry Behavior

- If telemetry is disabled:
  - Include `telemetry.json` with environment-only minimal payload and explicit reason.
- If telemetry retention trimmed data:
  - `manifest.telemetryExportTruncated = true`.
  - Include `redaction-report` entry `trimReason`.

## Runtime Contract Alignment (Current App Export)

The current JSON diagnostics export emitted by the app includes:

- `runtimeTelemetry` top-level object with `telemetrySchemaVersion`.
- Additive `dspTelemetry` section (mirrors `runtimeTelemetry.dsp`) for easy support parsing.
- AGC baseline contract shape (`implemented: false`) for forward-compatible parsing.

These additions are additive and remain compatible with `DiagnosticsBundleV1` readers that ignore unknown fields.

## Example Bundle Skeleton

```text
radio-diagnostics-v1.zip
└── radio-diagnostics-v1/
    ├── manifest.json
    ├── session-state.json
    ├── telemetry.json
    ├── errors.json
    ├── pipeline-config.json
    ├── redaction-report.json
    └── screenshots/
        └── spectrum-at-failure.png
```

## Example `manifest.json`

```json
{
  "bundleVersion": "1.0.0",
  "createdAtIso": "2026-02-23T22:12:03.111Z",
  "bundleId": "diag-20260223-221203-8f29",
  "appVersion": "0.1.0",
  "buildHash": "8a3b7cf",
  "schemaRefs": {
    "sessionState": "1.0.0",
    "telemetry": "1.0.0",
    "frequencyModel": "1.0.0",
    "rfChainModel": "1.0.0",
    "calibrationDisclosure": "1.0.0"
  },
  "fileIndex": [
    { "path": "manifest.json", "required": true },
    { "path": "session-state.json", "required": true },
    { "path": "telemetry.json", "required": true },
    { "path": "errors.json", "required": true },
    { "path": "pipeline-config.json", "required": true },
    { "path": "redaction-report.json", "required": true }
  ],
  "telemetryExportTruncated": false
}
```

## Migration Stub for v2+

- Add optional signed integrity manifest for support workflows.
- Add replay profile metadata with fixture linkage.
- Support selective artifact export profiles (`minimal`, `full-local`).
