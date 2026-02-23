# Calibration and Disclosure Contract v1

## Status

- Version: `1.0.0`
- Contract key: `CalibrationDisclosureV1`
- Top-level version field: `schemaVersion`

## Purpose

Defines calibration taxonomy and disclosure requirements so rad.io does not imply unsupported measurement-grade claims.

Applies to:

- Frequency readouts.
- Level or power-like readouts.
- Exported files, diagnostics bundles, and screenshots with overlays.

## Related Documents

- `docs/reference/contracts/frequency-model-v1.md`
- `docs/reference/contracts/rf-chain-model-v1.md`
- `docs/reference/contracts/session-state-v1.md`
- `docs/reference/contracts/diagnostics-bundle-v1.md`
- `docs/reference/rf-artifacts-and-mitigations.md`

## Versioning Conventions

- `schemaVersion` must be `"1.0.0"`.
- Calibration states are strict enums; unknown values must map to `uncalibrated`.
- Any state meaning change requires major version bump.

## Calibration Taxonomy

### Frequency Calibration State

- `uncalibrated`:
  - No validated ppm correction.
  - Internal oscillator assumed unknown.
- `approximate`:
  - User or heuristic correction applied, but traceability incomplete.
- `calibrated`:
  - Reference traceability documented and recent validation performed.

### Level Calibration State

- `uncalibrated`:
  - Relative dBFS or arbitrary units only.
- `approximate`:
  - Coarse correction applied with known large uncertainty.
- `calibrated`:
  - Gain chain and reference signal support claimed uncertainty bounds.

### Timebase / Reference State

- `internal-or-unknown`:
  - Internal oscillator or unknown reference quality.
- `external-disciplined`:
  - External reference present and verified locked.

## Evidence Requirements for `calibrated`

Frequency must include all:

- Last calibration timestamp.
- Reference source type (`gpsdo`, `lab-counter`, `known-station` with confidence).
- Estimated residual error bound in ppm and Hz at current center.

Level must include all:

- Reference signal metadata (frequency, level, uncertainty).
- Active gain chain snapshot from RF chain model.
- Estimated uncertainty bound in dB.

If any required evidence is missing, state must degrade to `approximate`.

## Required Metadata Fields

```ts
export interface CalibrationDisclosureV1 {
  schemaVersion: '1.0.0';
  frequency: {
    state: 'uncalibrated' | 'approximate' | 'calibrated';
    ppmCorrectionApplied: number;
    residualUncertaintyPpm?: number;
    residualUncertaintyHz?: number;
    calibratedAtIso?: string;
    evidenceRef?: string;
  };
  level: {
    state: 'uncalibrated' | 'approximate' | 'calibrated';
    referenceLevelDbm?: number;
    residualUncertaintyDb?: number;
    calibratedAtIso?: string;
    evidenceRef?: string;
  };
  timebase: {
    state: 'internal-or-unknown' | 'external-disciplined';
    referenceHz?: number;
    lockState?: 'locked' | 'unlocked' | 'unknown';
  };
  disclosureText: {
    uiBadgeShort: string;
    exportSummary: string;
  };
}
```

## UI Disclosure Rules

- Always show frequency calibration badge near main frequency readout.
- Show level calibration badge where absolute or pseudo-absolute level appears.
- On hover or details panel, include assumptions and uncertainty values.
- If state is `uncalibrated`, avoid wording like `accurate`, `exact`, or `measurement-grade`.
- Screenshots with overlays must include calibration badge text when overlay is enabled.

## Export and Diagnostics Disclosure Rules

Required in every export or diagnostics bundle:

- Frequency calibration state and uncertainty fields.
- Level calibration state and uncertainty fields.
- Timebase state and lock metadata.
- Statement if values are relative-only.

If uncertainty is unknown, field must be explicit `null` and add `uncertaintyUnknown: true`.

## Degraded Behavior

- Missing evidence on restore:
  - downgrade `calibrated` to `approximate`.
- Unknown timebase lock state:
  - set `timebase.state = "internal-or-unknown"`.
- Device capability lacking absolute level metadata:
  - force `level.state = "uncalibrated"`.

## Privacy Notes

- Evidence references should use local IDs, not external account identifiers.
- Do not embed operator personal names or location in calibration metadata.

## Compliant Disclosure Examples

### Example A: Frequency approximate, level uncalibrated

UI copy:

- `Frequency: Approximate (+1.8 ppm applied)`
- `Level: Uncalibrated (relative dBFS)`

Metadata snippet:

```json
{
  "schemaVersion": "1.0.0",
  "frequency": {
    "state": "approximate",
    "ppmCorrectionApplied": 1.8,
    "residualUncertaintyPpm": 1.5
  },
  "level": {
    "state": "uncalibrated"
  },
  "timebase": {
    "state": "internal-or-unknown"
  }
}
```

### Example B: Frequency calibrated, external disciplined

UI copy:

- `Frequency: Calibrated (±0.2 ppm, GPSDO locked)`
- `Level: Approximate (±3 dB)`

Metadata snippet:

```json
{
  "schemaVersion": "1.0.0",
  "frequency": {
    "state": "calibrated",
    "ppmCorrectionApplied": 0.1,
    "residualUncertaintyPpm": 0.2,
    "residualUncertaintyHz": 18,
    "calibratedAtIso": "2026-02-23T20:10:00Z",
    "evidenceRef": "cal-evidence-42"
  },
  "level": {
    "state": "approximate",
    "residualUncertaintyDb": 3
  },
  "timebase": {
    "state": "external-disciplined",
    "referenceHz": 10000000,
    "lockState": "locked"
  }
}
```

## Migration Stub for v2+

- Add optional confidence scoring for evidence quality.
- Add explicit per-band calibration applicability ranges.
- Add localization keys for disclosure text while preserving meaning.
