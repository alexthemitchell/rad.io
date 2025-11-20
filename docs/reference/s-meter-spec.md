# S-Meter Specification

## Overview

The S-Meter (Signal Strength Meter) is a standardized method for reporting signal strength in radio communications. This specification defines the conversion from internal digital signal processing (DSP) power metrics (dBFS - decibels relative to full scale) to S-units and calibrated dBm values.

## Purpose

Radio operators use S-units as the common language for signal reports. While dBFS is useful for digital engineering (showing how close a signal is to clipping the ADC), it doesn't directly translate to absolute signal power at the antenna. This specification bridges that gap.

## Key Concepts

### dBFS (Decibels relative to Full Scale)

- **Definition**: Power level referenced to the maximum possible digital value in the ADC
- **Range**: Typically -∞ to 0 dBFS
- **Meaning**:
  - 0 dBFS = Maximum ADC input (clipping/distortion)
  - -6 dBFS = Half the maximum voltage amplitude
  - -20 dBFS = 10% of maximum voltage amplitude
  - -60 dBFS = Very weak signal (0.1% of max)

### dBm (Decibels relative to 1 milliwatt)

- **Definition**: Absolute power level referenced to 1 milliwatt into 50Ω load
- **Formula**: `P(dBm) = 10 × log₁₀(P(mW) / 1 mW)`
- **Common Values**:
  - +30 dBm = 1 Watt
  - 0 dBm = 1 milliwatt
  - -30 dBm = 1 microwatt
  - -60 dBm = 1 nanowatt
  - -90 dBm = 1 picowatt
  - -120 dBm = 1 femtowatt

### S-Units (Signal Strength Units)

- **Definition**: Standardized scale from S0 to S9, with extensions above S9
- **Purpose**: Provide a consistent, easy-to-communicate signal strength measurement
- **History**: Originated in early radio to standardize signal reports
- **Standard**: Based on IARU (International Amateur Radio Union) recommendations

## S-Meter Mapping Tables

### HF Bands (Below 30 MHz)

Standard S-meter calibration for HF amateur bands:

| S-Unit | Power Level (dBm) | Absolute Power @ 50Ω | Description         |
| ------ | ----------------- | -------------------- | ------------------- |
| S9+60  | -13 dBm           | 50.1 µW              | Extremely Strong    |
| S9+40  | -33 dBm           | 501 nW               | Very Strong         |
| S9+20  | -53 dBm           | 5.01 nW              | Strong              |
| S9+10  | -63 dBm           | 501 pW               | Strong              |
| **S9** | **-73 dBm**       | **50.1 pW**          | **Reference Point** |
| S8     | -79 dBm           | 12.6 pW              | Good                |
| S7     | -85 dBm           | 3.16 pW              | Fair                |
| S6     | -91 dBm           | 794 fW               | Fair                |
| S5     | -97 dBm           | 200 fW               | Weak                |
| S4     | -103 dBm          | 50.1 fW              | Weak                |
| S3     | -109 dBm          | 12.6 fW              | Very Weak           |
| S2     | -115 dBm          | 3.16 fW              | Very Weak           |
| S1     | -121 dBm          | 794 aW               | Barely Perceptible  |
| S0     | < -127 dBm        | < 200 aW             | No Signal           |

**Key Points:**

- S9 = -73 dBm (reference point)
- Each S-unit below S9 = 6 dB difference
- Above S9, reported as "S9 + X dB" (e.g., S9+20)
- S9 corresponds to 50 µV EMF across 50Ω antenna input

### VHF/UHF Bands (Above 30 MHz)

Standard S-meter calibration for VHF/UHF amateur bands:

| S-Unit | Power Level (dBm) | Absolute Power @ 50Ω | Description         |
| ------ | ----------------- | -------------------- | ------------------- |
| S9+60  | -33 dBm           | 501 nW               | Extremely Strong    |
| S9+40  | -53 dBm           | 5.01 nW              | Very Strong         |
| S9+20  | -73 dBm           | 50.1 pW              | Strong              |
| S9+10  | -83 dBm           | 5.01 pW              | Strong              |
| **S9** | **-93 dBm**       | **0.501 pW**         | **Reference Point** |
| S8     | -99 dBm           | 126 fW               | Good                |
| S7     | -105 dBm          | 31.6 fW              | Fair                |
| S6     | -111 dBm          | 7.94 fW              | Fair                |
| S5     | -117 dBm          | 2.00 fW              | Weak                |
| S4     | -123 dBm          | 501 aW               | Weak                |
| S3     | -129 dBm          | 126 aW               | Very Weak           |
| S2     | -135 dBm          | 31.6 aW              | Very Weak           |
| S1     | -141 dBm          | 7.94 aW              | Barely Perceptible  |
| S0     | < -147 dBm        | < 2.00 aW            | No Signal           |

**Key Points:**

- S9 = -93 dBm (20 dB weaker than HF, due to higher noise floor)
- Each S-unit below S9 = 6 dB difference
- Above S9, reported as "S9 + X dB"
- S9 corresponds to 5 µV EMF across 50Ω antenna input

## Conversion Formulas

### dBFS to dBm Conversion

The conversion from dBFS to dBm requires a calibration constant that accounts for:

1. ADC reference voltage
2. RF gain/attenuation in the signal path
3. Mixer losses
4. Antenna characteristics

**Formula**:

```
dBm = dBFS + K_cal
```

Where:

- `dBFS` = measured power level relative to ADC full scale (≤ 0)
- `K_cal` = calibration constant (device-specific, typically -80 to -40)
- `dBm` = absolute power level at antenna input

**Determining K_cal**:

The calibration constant can be determined by:

1. **Signal Generator Method** (Most Accurate):
   - Connect calibrated signal generator to antenna input
   - Apply known signal level (e.g., -60 dBm at specific frequency)
   - Measure dBFS reading in software
   - Calculate: `K_cal = dBm_known - dBFS_measured`

2. **Reference Station Method**:
   - Tune to a known reference beacon or station
   - Use published power level and distance for path loss calculation
   - Compare to measured dBFS
   - Calculate calibration constant

3. **Thermal Noise Method**:
   - Measure noise floor with antenna disconnected (50Ω termination)
   - Compare to theoretical thermal noise: `Pn(dBm) = -174 + 10×log₁₀(B)`
   - Where B = bandwidth in Hz
   - Calculate offset between theoretical and measured

**Default Approximations**:

For HackRF One (typical values):

```
K_cal_HF ≈ -60    (for HF bands, gain setting dependent)
K_cal_VHF ≈ -70   (for VHF/UHF bands, gain setting dependent)
```

For RTL-SDR (typical values):

```
K_cal_HF ≈ -50    (for HF with upconverter)
K_cal_VHF ≈ -65   (for direct sampling VHF/UHF)
```

**Note**: These are rough approximations. Actual calibration is required for accurate measurements.

### dBm to S-Unit Conversion

Once dBm is known, convert to S-units:

**For HF (< 30 MHz)**:

```typescript
function dbmToSUnit_HF(dBm: number): { sUnit: number; overS9: number } {
  const S9_LEVEL_HF = -73; // dBm
  const S_UNIT_WIDTH = 6; // dB per S-unit

  if (dBm >= S9_LEVEL_HF) {
    // Above S9: report as "S9 + X dB"
    return {
      sUnit: 9,
      overS9: dBm - S9_LEVEL_HF,
    };
  } else {
    // Below S9: calculate S-unit (0-9 scale)
    const sUnit = Math.max(
      0,
      Math.min(9, 9 + (dBm - S9_LEVEL_HF) / S_UNIT_WIDTH),
    );
    return {
      sUnit: Math.round(sUnit),
      overS9: 0,
    };
  }
}
```

**For VHF/UHF (≥ 30 MHz)**:

```typescript
function dbmToSUnit_VHF(dBm: number): { sUnit: number; overS9: number } {
  const S9_LEVEL_VHF = -93; // dBm
  const S_UNIT_WIDTH = 6; // dB per S-unit

  if (dBm >= S9_LEVEL_VHF) {
    // Above S9: report as "S9 + X dB"
    return {
      sUnit: 9,
      overS9: dBm - S9_LEVEL_VHF,
    };
  } else {
    // Below S9: calculate S-unit (0-9 scale)
    const sUnit = Math.max(
      0,
      Math.min(9, 9 + (dBm - S9_LEVEL_VHF) / S_UNIT_WIDTH),
    );
    return {
      sUnit: Math.round(sUnit),
      overS9: 0,
    };
  }
}
```

## TypeScript Interface Definition

### SignalLevel Interface

```typescript
/**
 * Represents a complete signal strength measurement
 * with multiple representations for different use cases
 */
interface SignalLevel {
  /**
   * Power level relative to ADC full scale
   * Range: typically -∞ to 0 dBFS
   * 0 dBFS = maximum ADC input (clipping)
   * Directly measured from IQ samples
   */
  dBfs: number;

  /**
   * Approximate absolute power level at antenna input
   * Range: typically -150 to +10 dBm
   * Requires calibration constant K_cal
   * Formula: dBm = dBfs + K_cal
   */
  dBmApprox: number;

  /**
   * S-unit reading (0-9 scale)
   * 0 = no signal / noise floor
   * 1-8 = weak to good signals
   * 9 = reference level (S9)
   */
  sUnit: number;

  /**
   * Decibels over S9 (for strong signals)
   * 0 = at or below S9
   * >0 = signal is X dB above S9
   * Common values: 0, 10, 20, 40, 60
   * Displayed as "S9+10", "S9+20", etc.
   */
  overS9: number;

  /**
   * Band type used for S-unit calculation
   * 'HF' = below 30 MHz (S9 = -73 dBm)
   * 'VHF' = 30 MHz and above (S9 = -93 dBm)
   */
  band: "HF" | "VHF";

  /**
   * Calibration status indicator
   * 'uncalibrated' = using default K_cal approximation
   * 'factory' = using factory calibration
   * 'user' = using user-performed calibration
   */
  calibrationStatus: "uncalibrated" | "factory" | "user";

  /**
   * Estimated measurement uncertainty in dB
   * Typical values:
   * - Uncalibrated: ±10 dB
   * - Factory calibrated: ±3 dB
   * - User calibrated with signal generator: ±1 dB
   */
  uncertaintyDb?: number;

  /**
   * Timestamp of measurement (milliseconds since epoch)
   */
  timestamp: number;
}
```

### Supporting Type Definitions

```typescript
/**
 * Band classification for S-meter calculations
 */
type SMeterBand = "HF" | "VHF";

/**
 * Calibration parameters for a specific device and gain setting
 */
interface SMeterCalibration {
  /**
   * Calibration constant: dBm = dBfs + kCal
   */
  kCal: number;

  /**
   * Frequency range this calibration applies to (Hz)
   */
  frequencyRange: {
    min: number;
    max: number;
  };

  /**
   * Gain/attenuation setting this applies to
   */
  gainSetting?: {
    lna: number; // LNA gain in dB
    vga: number; // VGA gain in dB
    rxAmp: boolean; // RX amp on/off
  };

  /**
   * How calibration was performed
   */
  method:
    | "signal-generator"
    | "reference-station"
    | "thermal-noise"
    | "default";

  /**
   * Estimated accuracy of this calibration (dB)
   */
  accuracyDb: number;

  /**
   * When calibration was performed
   */
  calibratedAt?: number;
}

/**
 * S-meter configuration
 */
interface SMeterConfig {
  /**
   * Calibration data for current device/settings
   */
  calibration: SMeterCalibration;

  /**
   * Display preferences
   */
  display: {
    /**
     * Show numeric S-unit or graphical meter
     */
    style: "numeric" | "bar" | "needle";

    /**
     * Show dBm value alongside S-unit
     */
    showDbm: boolean;

    /**
     * Show dBFS value (engineering mode)
     */
    showDbfs: boolean;

    /**
     * Update rate (milliseconds)
     */
    updateRateMs: number;

    /**
     * Averaging/smoothing (exponential moving average alpha)
     * 0 = maximum smoothing, 1 = no smoothing
     */
    smoothing: number;
  };
}
```

## Implementation Considerations

### Accuracy and Calibration Risks

1. **Frequency-Dependent Gain**:
   - RF gain varies with frequency
   - Calibration at one frequency may not apply to others
   - Solution: Multi-point calibration across frequency range

2. **Temperature Drift**:
   - Oscillator frequency drifts with temperature
   - Gain stages affected by temperature
   - LNA characteristics change with temperature
   - Impact: ±2-5 dB over operating temperature range
   - Mitigation: Regular recalibration, temperature compensation

3. **Antenna Effects**:
   - Antenna gain varies with frequency
   - Impedance mismatch causes measurement errors
   - Environmental factors (nearby objects, ground effects)
   - Solution: Calibration includes antenna system

4. **ADC Linearity**:
   - ADC non-linearity at high signal levels
   - Quantization noise at low signal levels
   - Dynamic range limitations
   - Solution: Keep signals in mid-range of ADC (-40 to -10 dBFS)

5. **Gain Setting Dependency**:
   - Different gain settings require different K_cal values
   - AGC changes invalidate calibration
   - Solution: Store calibration per gain configuration

6. **Bandwidth Effects**:
   - Wider bandwidth = more noise power
   - Noise power affects weak signal measurements
   - Solution: Normalize measurements to reference bandwidth

### Measurement Best Practices

1. **Signal Averaging**:
   - Use exponential moving average to smooth readings
   - Typical time constant: 100-500 ms
   - Prevents rapid fluctuations, improves readability

2. **Peak Hold**:
   - Optional peak detector for transient signals
   - Hold time: 1-3 seconds
   - Useful for SSB, CW, data bursts

3. **Noise Floor Compensation**:
   - Measure noise floor when no signal present
   - Subtract noise contribution from signal+noise measurement
   - Provides true signal power

4. **Dynamic Range Limits**:
   - Below -100 dBFS: measurements unreliable (noise floor)
   - Above -3 dBFS: risk of clipping, distortion
   - Optimal range: -60 to -10 dBFS

### Reference Standards

1. **IARU Region 1 Standard** (HF):
   - S9 = 50 µV EMF = -73 dBm @ 50Ω
   - 6 dB per S-unit below S9
   - Recommended for amateur bands below 30 MHz

2. **IARU Region 1 Standard** (VHF/UHF):
   - S9 = 5 µV EMF = -93 dBm @ 50Ω
   - 6 dB per S-unit below S9
   - Recommended for amateur bands 30 MHz and above

3. **Alternative Scales**:
   - Some manufacturers use 3 dB per S-unit (non-standard)
   - Broadcasting standards may differ
   - This spec follows IARU standard (6 dB/S-unit)

## Usage Examples

### Example 1: Basic Conversion

```typescript
// Measured from IQ samples
const dBfs = -42.5;

// HackRF One on VHF with default calibration
const K_cal = -70;

// Convert to dBm
const dBm = dBfs + K_cal; // -112.5 dBm

// Convert to S-units (VHF band)
const frequency = 145.5e6; // 145.5 MHz (VHF)
const band = frequency >= 30e6 ? "VHF" : "HF";
const S9_LEVEL = band === "VHF" ? -93 : -73;

let signalLevel: SignalLevel;
if (dBm >= S9_LEVEL) {
  signalLevel = {
    dBfs,
    dBmApprox: dBm,
    sUnit: 9,
    overS9: Math.round(dBm - S9_LEVEL),
    band,
    calibrationStatus: "uncalibrated",
    uncertaintyDb: 10,
    timestamp: Date.now(),
  };
} else {
  const sUnit = Math.max(0, Math.round(9 + (dBm - S9_LEVEL) / 6));
  signalLevel = {
    dBfs,
    dBmApprox: dBm,
    sUnit,
    overS9: 0,
    band,
    calibrationStatus: "uncalibrated",
    uncertaintyDb: 10,
    timestamp: Date.now(),
  };
}

// Display: "S3" (-112.5 dBm is 3.25 S-units below S9)
console.log(
  `S${signalLevel.sUnit}${signalLevel.overS9 > 0 ? `+${signalLevel.overS9}` : ""}`,
);
// Output: "S3"
```

### Example 2: Calibrated Measurement

```typescript
// After calibration with signal generator
const calibration: SMeterCalibration = {
  kCal: -65.2, // Measured with -50 dBm reference signal
  frequencyRange: { min: 88e6, max: 108e6 },
  gainSetting: { lna: 16, vga: 20, rxAmp: true },
  method: "signal-generator",
  accuracyDb: 1.5,
  calibratedAt: Date.now(),
};

const dBfs = -35.2; // Measured
const dBm = dBfs + calibration.kCal; // -100.4 dBm

// Strong signal example
const strongSignal: SignalLevel = {
  dBfs: -15,
  dBmApprox: -15 + calibration.kCal, // -80.2 dBm
  sUnit: 9,
  overS9: 12.8, // Round to 13 for display
  band: "VHF",
  calibrationStatus: "user",
  uncertaintyDb: 1.5,
  timestamp: Date.now(),
};

// Display: "S9+13"
console.log(`S${strongSignal.sUnit}+${Math.round(strongSignal.overS9)}`);
```

### Example 3: Real-time Monitoring

```typescript
class SMeter {
  private config: SMeterConfig;
  private smoothedDbfs: number = -100;

  constructor(config: SMeterConfig) {
    this.config = config;
  }

  update(currentDbfs: number, frequency: number): SignalLevel {
    // Apply exponential smoothing
    const alpha = this.config.display.smoothing;
    this.smoothedDbfs = alpha * currentDbfs + (1 - alpha) * this.smoothedDbfs;

    // Convert to dBm
    const dBmApprox = this.smoothedDbfs + this.config.calibration.kCal;

    // Determine band
    const band: SMeterBand = frequency >= 30e6 ? "VHF" : "HF";
    const S9_LEVEL = band === "VHF" ? -93 : -73;

    // Calculate S-unit
    let sUnit: number;
    let overS9: number;

    if (dBmApprox >= S9_LEVEL) {
      sUnit = 9;
      overS9 = dBmApprox - S9_LEVEL;
    } else {
      sUnit = Math.max(0, Math.round(9 + (dBmApprox - S9_LEVEL) / 6));
      overS9 = 0;
    }

    return {
      dBfs: this.smoothedDbfs,
      dBmApprox,
      sUnit,
      overS9,
      band,
      calibrationStatus:
        this.config.calibration.method === "default"
          ? "uncalibrated"
          : this.config.calibration.method === "signal-generator"
            ? "user"
            : "factory",
      uncertaintyDb: this.config.calibration.accuracyDb,
      timestamp: Date.now(),
    };
  }
}
```

## Future Enhancements

### Phase 2: Visual Display

- Graphical S-meter with analog needle or LED bar
- Color coding (green/yellow/red for signal strength)
- Peak hold indicators
- Trend display (signal strength over time)

### Phase 3: Advanced Features

- Multi-band calibration storage
- Automatic frequency-dependent K_cal interpolation
- Temperature compensation
- Calibration wizard with step-by-step guidance
- Export/import calibration data
- Signal quality indicators (SNR, distortion, fading)

### Phase 4: Integration

- Integration with signal classification system
- Automatic mode detection (AM/FM/SSB) affects S-meter ballistics
- Integration with recording/logging features
- API for external calibration tools

## References

1. IARU Region 1 VHF/UHF/Microwave Committee - S-Meter Calibration Standard
2. ITU-R SM.1681 - Measurement of Maximum Deviation of FM Broadcast Emissions
3. Amateur Radio Relay League - "The ARRL Handbook for Radio Communications"
4. Application Note AN-1971 - "Understanding and Optimizing S-Meter Design" (Analog Devices)
5. HackRF One Documentation - RF Performance and Calibration
6. RTL-SDR Blog - Calibration and Measurement Accuracy

## Revision History

| Version | Date       | Author         | Changes                        |
| ------- | ---------- | -------------- | ------------------------------ |
| 1.0     | 2025-11-20 | GitHub Copilot | Initial specification document |

## License

This specification document is part of the rad.io project and is licensed under the same terms as the main project.
