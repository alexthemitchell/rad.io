# RF Chain Model Contract v1

## Status

- Version: `1.0.0`
- Contract key: `RfChainModelV1`
- Top-level version field: `schemaVersion`

## Purpose

Defines structured RF chain context for rad.io session interpretation and diagnostics:

- Antenna and front-end metadata.
- Gain, attenuation, filter, and bias-tee settings.
- IF and transverter mapping inputs.

This contract ensures frequency math and level disclosure remain consistent across Mock, RTL-SDR, and HackRF paths.

## Related Documents

- `docs/reference/contracts/frequency-model-v1.md`
- `docs/reference/contracts/calibration-disclosure-v1.md`
- `docs/reference/contracts/session-state-v1.md`
- `docs/reference/contracts/diagnostics-bundle-v1.md`
- `docs/decisions/0003-state-persistence-boundaries.md`

## Versioning Conventions

- `schemaVersion` is required and must be `"1.0.0"`.
- Each RF component entry has stable `kind` enum and optional `id`.
- Breaking changes to transverter semantics require major bump.

## TypeScript Shape

```ts
export interface RfChainModelV1 {
  schemaVersion: '1.0.0';
  profileId: string;
  profileName: string;
  sourceCompatibility: Array<'mock' | 'rtl-sdr' | 'hackrf'>;
  antenna?: {
    descriptor?: string;
    polarization?: 'vertical' | 'horizontal' | 'circular' | 'unknown';
    notes?: string;
  };
  lna?: {
    enabled: boolean;
    gainDb: number;
  };
  attenuator?: {
    enabled: boolean;
    attenuationDb: number;
  };
  filters: Array<{
    kind: 'preselector' | 'notch' | 'bandpass' | 'highpass' | 'lowpass';
    label: string;
    enabled: boolean;
    lowCutHz?: number;
    highCutHz?: number;
  }>;
  biasTee: {
    enabled: boolean;
    voltageV?: number;
  };
  ifOffsetHz: number;
  transverter?: {
    enabled: boolean;
    label: string;
    loHz: number;
    direction: 'up' | 'down';
    ifCenterHz: number;
  };
  levelAdjustments: {
    frontEndGainDb: number;
    pathLossDb: number;
    netOffsetDb: number;
  };
  createdAtIso: string;
  updatedAtIso: string;
}
```

## Defaults

| Field | Default | Notes |
| --- | --- | --- |
| `schemaVersion` | `"1.0.0"` | Required |
| `profileId` | `"default"` | Baseline profile |
| `profileName` | `"Default RF Chain"` | UI label |
| `sourceCompatibility` | `['mock', 'rtl-sdr', 'hackrf']` | Cross-source baseline |
| `filters` | `[]` | No filter assumptions |
| `biasTee.enabled` | `false` | Safe startup default |
| `ifOffsetHz` | `0` | Direct model by default |
| `levelAdjustments.frontEndGainDb` | `0` | Explicit neutral gain |
| `levelAdjustments.pathLossDb` | `0` | Explicit neutral path loss |
| `levelAdjustments.netOffsetDb` | `0` | Computed `gain - loss - attenuation` |

## Invariants

- `updatedAtIso >= createdAtIso` by lexical ISO time ordering.
- `attenuationDb >= 0`.
- `ifOffsetHz` is signed and in Hz.
- If `transverter.enabled = true`, then `transverter.loHz > 0` and `transverter.ifCenterHz >= 0`.
- `levelAdjustments.netOffsetDb` must equal:
  - `frontEndGainDb - pathLossDb - attenuationDb` (where missing attenuation means `0`).

## Frequency Mapping Effects

- `ifOffsetHz` feeds `ifHz` in Frequency Model contract.
- `transverter` block maps to `transverterLoHz` and `transverterDirection` in Frequency Model contract.
- Device tune command remains resolved by Frequency Model, not by this contract directly.

## Level Interpretation Effects

- `levelAdjustments.netOffsetDb` contributes to disclosed level interpretation.
- If `netOffsetDb` is unknown or inferred, calibration state must not exceed `approximate`.
- Missing component information must downgrade level confidence.

## Diagnostics Capture Rules

Diagnostics bundle must include:

- Active RF profile full snapshot.
- Source compatibility list.
- Bias-tee state and transverter details.
- `ifOffsetHz` and `levelAdjustments` values.
- Any unsupported settings ignored by current device adapter.

Sensitive optional fields such as user notes must be redacted by default.

## Storage Boundary Rules

Per ADR 0003 boundaries:

- Session-scoped:
  - Active profile selection (`profileId`) and runtime toggles.
- Persisted user profile (durable):
  - RF profile definitions and named chain presets.
- Diagnostics export:
  - Snapshot current resolved profile, including computed fields.

## Degraded Behavior

- Unsupported hardware feature (for example bias-tee on unsupported source):
  - keep requested state in model.
  - mark as not-applied in diagnostics.
  - do not crash stream.
- Invalid transverter config:
  - disable transverter for tuning math.
  - add warning event and keep profile for editing.

## Worked Example: 2 m Band with Downconverter

Configuration:

- `ifOffsetHz = 250_000`
- `transverter.enabled = true`
- `transverter.loHz = 116_000_000`
- `transverter.direction = "down"`
- `tunerLoHz = 29_700_000`
- `attenuationDb = 10`
- `frontEndGainDb = 20`
- `pathLossDb = 4`

Frequency result using Frequency Model:

- `rfHz = (29_700_000 + 250_000) - 116_000_000 = -86_050_000`

This negative result indicates inconsistent direction or LO setup for desired band and must be flagged before command apply.

If corrected to `direction = "up"`:

- `rfHz = (29_700_000 + 250_000) + 116_000_000 = 145_950_000`

Level adjustment:

- `netOffsetDb = 20 - 4 - 10 = +6 dB`

## Privacy and Redaction

- `antenna.notes` and free-form `descriptor` are sensitive by default in diagnostics exports.
- Hardware serials or operator identifiers are not part of RF chain contract.

## Migration Stub for v2+

- Add optional multi-stage chain graph (`components[]` with ordered links).
- Add per-band applicability constraints.
- Add explicit device capability mapping cache for faster validation.
