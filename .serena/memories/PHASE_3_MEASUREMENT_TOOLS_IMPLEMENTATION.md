# Phase 3: Professional Measurement & Compliance Tools

## Overview

Phase 3 adds professional-grade measurement and compliance tools for Radio Monitoring Professionals, Academic Researchers, and Broadcast Engineers. This enables rad.io to be used for regulatory compliance, research-grade measurements, and broadcast engineering.

## Implementation Status

**Completed:** Core measurement library with comprehensive testing
**Remaining:** UI components, integration with visualizations, documentation

## Architecture

### Measurement Library (`src/lib/measurement/`)

**Core Modules:**

1. **Frequency Markers** (`frequency-markers.ts`)
   - Place up to 8 markers on spectrum displays
   - Track peaks automatically within search range
   - Calculate delta measurements (frequency, power)
   - Export/import marker configurations

2. **Channel Power** (`channel-power.ts`)
   - Total power integration (rectangular or trapezoidal)
   - Occupied bandwidth (99% power containment)
   - ACPR (Adjacent Channel Power Ratio)
   - CCDF (Complementary Cumulative Distribution Function)

3. **Signal Quality** (`signal-quality.ts`)
   - SNR (Signal-to-Noise Ratio)
   - SINAD (Signal + Noise + Distortion to Noise + Distortion)
   - THD (Total Harmonic Distortion) with configurable harmonic count
   - EVM (Error Vector Magnitude) for digital modes

4. **Calibration** (`calibration.ts`)
   - Frequency calibration (PPM correction from reference)
   - Power calibration (gain offset, frequency-dependent)
   - IQ calibration (DC offset, gain imbalance, phase imbalance)
   - Persistent storage via localStorage
   - Profile versioning and expiration checking

5. **Spectrum Mask Testing** (`spectrum-mask.ts`)
   - Define custom regulatory masks
   - Test spectrum compliance against masks
   - Identify violations with margin calculations
   - Default masks: FCC Part 15, FM Broadcast, P25, LTE, WiFi, NFM, WFM
   - Export/import mask definitions

6. **Measurement Logger** (`measurement-logger.ts`)
   - Log all measurement types with timestamps
   - Filter by type, tag, frequency, time range
   - Calculate statistics (min, max, mean, median, stddev)
   - Export to CSV or JSON
   - Automatic pruning (default: 10,000 entries max)

### Type Definitions (`types.ts`)

All measurement types are fully typed with TypeScript interfaces for type safety.

## Usage Examples

### Frequency Markers

```typescript
import { FrequencyMarkerManager } from "./lib/measurement";

const markers = new FrequencyMarkerManager({ maxMarkers: 8 });

// Add marker
const m1 = markers.addMarker(100e6, "FM Station", "#FF0000");

// Track peak
markers.trackPeakInRange(m1.id, spectrum, frequencies, 50e3);

// Calculate delta
const delta = markers.calculateDelta(m1.id, m2.id);
console.log(`Δf = ${delta.frequencyDelta} Hz, ΔP = ${delta.powerDelta} dB`);
```

### Channel Power

```typescript
import { ChannelPowerMeasurement } from "./lib/measurement";

const channelPower = new ChannelPowerMeasurement();

const result = channelPower.measureChannelPower(
  spectrum,
  frequencies,
  100e6, // Center frequency
  200e3, // Bandwidth
);

console.log(`Total Power: ${result.totalPower} dBFS`);
console.log(`Occupied BW: ${result.occupiedBandwidth} Hz`);
```

### Signal Quality

```typescript
import { SignalQualityAnalyzer } from "./lib/measurement";

const analyzer = new SignalQualityAnalyzer();

const metrics = analyzer.calculateAllMetrics(
  spectrum,
  frequencies,
  100e6, // Signal frequency
  200e3, // Bandwidth
  timeDomain, // Optional for SINAD
  sampleRate, // Optional for SINAD
);

console.log(`SNR: ${metrics.snr} dB`);
console.log(`THD: ${metrics.thd}%`);
```

### Calibration

```typescript
import { CalibrationManager } from "./lib/measurement";

const cal = new CalibrationManager();

// Calibrate frequency (e.g., using WWV 10 MHz)
const freqCal = cal.calculateFrequencyCalibration(
  "device1",
  10e6, // Reference (WWV)
  10.0005e6, // Measured (50 ppm error)
);
cal.setFrequencyCalibration("device1", freqCal);

// Apply correction
const corrected = cal.applyFrequencyCalibration("device1", 100e6);
// Returns: 99.995 MHz (50 ppm correction at 100 MHz = 5 kHz)
```

### Spectrum Mask Testing

```typescript
import { SpectrumMaskTester } from "./lib/measurement";

const tester = new SpectrumMaskTester();

// Use default FCC Part 15 mask
const result = tester.testMask(
  "fcc-part15-classb",
  spectrum,
  frequencies,
  100e6, // Carrier frequency
  0, // Carrier power (dBc reference)
);

console.log(`Passed: ${result.passed}`);
console.log(`Violations: ${result.violations.length}`);
console.log(`Worst Margin: ${result.worstMargin} dB`);
```

### Measurement Logging

```typescript
import { MeasurementLogger } from "./lib/measurement";

const logger = new MeasurementLogger();

// Log measurement
logger.addEntry({
  timestamp: Date.now(),
  measurementType: "channel_power",
  frequency: 100e6,
  tags: ["compliance", "test-run-1"],
  data: {
    totalPower: -30,
    occupiedBandwidth: 180e3,
  },
});

// Get statistics
const entries = logger.getEntriesByTag("compliance");
const stats = logger.calculateStatistics(entries, "totalPower");
console.log(`Mean Power: ${stats.mean} dBFS`);

// Export
const csv = logger.exportToCSV();
// Compatible with Excel, MATLAB
```

## Testing

**Coverage:** 122 tests, all passing

- Frequency markers: 23 tests
- Channel power: 11 tests
- Signal quality: 13 tests
- Calibration: 23 tests
- Spectrum mask: 25 tests
- Measurement logger: 29 tests

**Run tests:**

```bash
npm test -- src/lib/measurement
```

## Configuration

All measurement classes accept optional `MeasurementConfig`:

```typescript
interface MeasurementConfig {
  maxMarkers?: number; // Default: 8
  markerTrackPeak?: boolean; // Default: false
  integrationMethod?: "rectangular" | "trapezoidal"; // Default: trapezoidal
  occupiedBandwidthThreshold?: number; // Default: 0.99 (99%)
  noiseFloorSamples?: number; // Default: 1000
  harmonicCount?: number; // Default: 5 (for THD)
  averagingEnabled?: boolean; // Default: true
  averagingCount?: number; // Default: 10
  averagingMode?: "linear" | "exponential" | "peak-hold"; // Default: exponential
  applyFrequencyCalibration?: boolean; // Default: true
  applyPowerCalibration?: boolean; // Default: true
  applyIQCalibration?: boolean; // Default: true
}
```

## Integration Points

To integrate with existing visualizations:

1. Import measurement classes from `src/lib/measurement`
2. Create instances with appropriate config
3. Call measurement functions with spectrum/frequency data
4. Display results in UI components (to be implemented)
5. Use logger to persist measurement history

## Next Steps for UI Integration

1. **FrequencyMarkersOverlay component:**
   - Render markers on spectrum canvas
   - Click to place/move markers
   - Display marker info (frequency, power)
   - Show delta measurements

2. **MeasurementPanel component:**
   - Display real-time measurements
   - Show signal quality metrics
   - Channel power readouts
   - Mask test results

3. **CalibrationWizard component:**
   - Step-by-step calibration workflow
   - Reference signal selection (WWV, signal generator)
   - Apply and save calibration

4. **SpectrumMaskOverlay component:**
   - Render mask limits on spectrum
   - Highlight violations
   - Pass/fail indicator

5. **MeasurementLogViewer component:**
   - Table view of logged measurements
   - Filter and search
   - Statistics display
   - Export controls

## Performance Considerations

- Calibration profiles stored in localStorage (auto-save on changes)
- Measurement logger limited to 10,000 entries (configurable)
- All computations use typed arrays for performance
- No external dependencies for measurement algorithms

## Known Limitations

- Frequency calibration assumes linear PPM error across spectrum
- Power calibration uses linear interpolation between cal points
- IQ calibration assumes constant imbalance across frequencies
- Measurement logger storage limited by localStorage quota (~5-10 MB)

## References

- ADR-0013: Automatic Signal Detection System (Phase 2)
- ADR-0014: Frequency Scanning (Phase 2)
- ROADMAP.md: Phase 3 specifications
- Location: `src/lib/measurement/`
- Tests: `src/lib/measurement/__tests__/`
