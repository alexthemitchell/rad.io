# Frequency Model Contract v1

## Status

- Version: `1.0.0`
- Contract key: `FrequencyModelV1`
- Top-level version field: `schemaVersion`

## Purpose

Defines canonical frequency math and naming across UI readouts, device tuning commands, exports, and diagnostics for rad.io.

This contract prevents sign-direction and offset interpretation bugs between:

- RF on-air frequency.
- Device LO settings.
- IF offsets and transverter offsets.
- Displayed center frequency.

## Related Documents

- `docs/reference/contracts/rf-chain-model-v1.md`
- `docs/reference/contracts/session-state-v1.md`
- `docs/reference/contracts/diagnostics-bundle-v1.md`
- `docs/reference/contracts/calibration-disclosure-v1.md`
- `docs/decisions/0001-receiver-mental-model.md`

## Versioning Conventions

- `schemaVersion` is required and must be `"1.0.0"`.
- Numeric fields are signed 64-bit-safe integer Hz values in implementation.
- Breaking equation changes require major version bump.

## Canonical Fields

| Field | Unit | Sign convention | Meaning |
| --- | --- | --- | --- |
| `rfHz` | Hz | absolute | Physical on-air center frequency of interest |
| `tunerLoHz` | Hz | absolute | LO frequency commanded to device tuner |
| `ifHz` | Hz | signed | IF offset relative to tuner LO (`rfHz - tunerLoHz`) |
| `userOffsetHz` | Hz | signed | User-defined display correction offset |
| `displayCenterHz` | Hz | absolute | Center frequency shown in UI |
| `transverterLoHz` | Hz | absolute | External transverter oscillator frequency |
| `transverterDirection` | enum | `up` or `down` | Defines RF conversion direction |

## Core Equations

Without transverter:

- `rfHz = tunerLoHz + ifHz`
- `displayCenterHz = rfHz + userOffsetHz`

With transverter:

- Upconverter (`transverterDirection = up`):
  - `rfHz = (tunerLoHz + ifHz) + transverterLoHz`
- Downconverter (`transverterDirection = down`):
  - `rfHz = (tunerLoHz + ifHz) - transverterLoHz`
- In both cases:
  - `displayCenterHz = rfHz + userOffsetHz`

Derived inverse for retune from desired display center:

- `rfHz = desiredDisplayCenterHz - userOffsetHz`
- Then solve for `tunerLoHz` given `ifHz` and optional transverter configuration.

## Invariants

- All frequency fields are finite integers in Hz.
- `Math.abs(ifHz) <= sampleRateHz / 2` for valid in-band center assumptions.
- `displayCenterHz` is always derived from `rfHz` and `userOffsetHz`; it is not independent state.
- Device command path always uses `tunerLoHz` as authoritative tuned value.

## Retune and Command Rules

- UI interaction updates desired display center.
- Runtime computes canonical `rfHz` and then `tunerLoHz`.
- Device adapters receive only `tunerLoHz` plus sample rate and gain settings.
- Session persistence stores both user intent (`displayCenterHz`) and resolved model fields.

## Export and Diagnostics Rules

- Exports must include:
  - `rfHz`
  - `tunerLoHz`
  - `ifHz`
  - `userOffsetHz`
  - transverter fields if active
- Diagnostics must record both display and commanded values to disambiguate bugs.
- Any unavailable field must be `null` with explicit reason; never silently omitted.

## Degraded Behavior

- If source does not expose explicit tuner LO readback:
  - use last commanded `tunerLoHz`.
  - mark `loReadbackState: "commanded-only"`.
- If RF chain profile invalid:
  - ignore transverter math.
  - log warning event.
  - continue with direct model.

## Worked Examples

### Example 1: Direct sampling, no IF

Inputs:

- `tunerLoHz = 99_500_000`
- `ifHz = 0`
- `userOffsetHz = 0`

Result:

- `rfHz = 99_500_000`
- `displayCenterHz = 99_500_000`

### Example 2: Quadrature with IF offset

Inputs:

- `tunerLoHz = 100_000_000`
- `ifHz = -250_000`
- `userOffsetHz = 1_250`

Result:

- `rfHz = 99_750_000`
- `displayCenterHz = 99_751_250`

### Example 3: 125 MHz upconverter for HF

Inputs:

- `transverterDirection = "up"`
- `transverterLoHz = 125_000_000`
- `tunerLoHz = 14_200_000`
- `ifHz = 0`
- `userOffsetHz = 0`

Result:

- `rfHz = 139_200_000`
- `displayCenterHz = 139_200_000`

Retune target for display `140_000_000`:

- desired `rfHz = 140_000_000`
- solved `tunerLoHz = 15_000_000`

## Example TypeScript Shape

```ts
export interface FrequencyModelV1 {
  schemaVersion: '1.0.0';
  rfHz: number;
  tunerLoHz: number;
  ifHz: number;
  userOffsetHz: number;
  displayCenterHz: number;
  transverter?: {
    enabled: boolean;
    transverterLoHz: number;
    direction: 'up' | 'down';
    label?: string;
  };
  loReadbackState: 'readback-valid' | 'commanded-only' | 'unavailable';
}
```

## Migration Stub for v2+

- Add explicit sideband model fields for USB/LSB display alignment.
- Add optional ppm correction decomposition from calibration profile.
- Keep v1 equations available for compatibility import.
