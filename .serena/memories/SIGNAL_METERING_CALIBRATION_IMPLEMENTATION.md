# Signal Metering Calibration Implementation

## Overview
Signal metering Phase 4 implementation adds user-adjustable calibration offset and automatic band-aware S9 baseline selection for accurate signal strength measurements.

## Key Components

### Settings Storage
- **File**: `src/store/slices/settingsSlice.ts`
- **Field**: `calibrationOffsetDb: number` (default: 0)
- **Validation**: -50 to +50 dB range
- **Persistence**: localStorage via Zustand

### Signal Measurement
- **File**: `src/lib/measurement/signalMeasurement.ts`
- **Function**: `convertDbfsToDbm(dbfs, kCal, calibrationOffset?)`
- **Formula**: `dBm = dBFS + K_cal + calibrationOffset`

### Signal Level Service
- **File**: `src/lib/measurement/signal-level-service.ts`
- **Config**: `SignalLevelServiceConfig.calibrationOffsetDb`
- **Usage**: Applied in `calculateSignalLevel()` method
- **Update**: `updateConfig({ calibrationOffsetDb })` for runtime changes

### UI Component
- **File**: `src/components/RenderingSettingsModal.tsx`
- **Location**: "Signal Meter Calibration" section
- **Controls**: Number input (-50 to +50 dB, 0.5 step) + Reset button

## Band Detection (Already Implemented)
- **Threshold**: 30 MHz (const BAND_THRESHOLD_HZ = 30e6)
- **HF**: < 30 MHz → S9 = -73 dBm
- **VHF**: ≥ 30 MHz → S9 = -93 dBm
- **Implementation**: `SignalLevelService.getBand(frequencyHz)`
- **Conversion**: `dbmToSUnit()` in `signalMeasurement.ts`

## Testing
- **Calibration offset tests**: `src/lib/measurement/__tests__/signalMeasurement.test.ts`
- **Band detection tests**: `src/lib/measurement/__tests__/signal-level-service.test.ts`
- **Coverage**: 10 new tests added (6 for offset, 4 for band detection)

## Documentation
- **Spec**: `docs/reference/s-meter-spec.md`
- **Section**: "User Calibration Workflow"
- **Includes**: Procedures, band considerations, storage, validation, examples

## Usage Pattern
```typescript
// In component using signal level service
const { settings } = useSettings();
const service = new SignalLevelService({
  calibration: { kCal: -70, ... },
  frequencyHz: 100e6, // VHF → S9 = -93 dBm
  calibrationOffsetDb: settings.calibrationOffsetDb, // User adjustment
});
```

## Future Considerations
- Band-specific calibration offsets (HF vs VHF)
- Calibration wizard/assistant UI
- Import/export calibration profiles
- Temperature compensation
