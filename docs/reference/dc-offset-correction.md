# DC Offset Correction

## Overview

DC offset (also called DC bias) is a constant component added to a signal. In SDR receivers, DC offset appears as an unwanted spike at the center frequency and is one of the most common impairments in direct conversion and zero-IF receivers.

## The DC Offset Problem in SDR

### Causes

1. **LO (Local Oscillator) Leakage**: In direct conversion receivers, the local oscillator signal leaks into the mixer and appears as a DC component in the baseband signal.

2. **Component Mismatch**: Slight imbalances between I and Q paths in the analog frontend create DC offsets.

3. **Self-Mixing**: The LO signal can mix with itself, producing a DC component.

4. **ADC Offset**: Analog-to-digital converters may have inherent offset errors.

### Effects

- **Spectrum Spike**: A large spike appears at the center of the spectrum display
- **Dynamic Range Reduction**: DC offset reduces the effective dynamic range of the ADC
- **Demodulation Problems**: Interferes with AM demodulation and other signal processing
- **False Signal Detection**: May be mistaken for an actual signal

## rad.io DC Correction Implementation

rad.io provides three industry-standard DC correction algorithms:

### 1. Static DC Offset Removal

**Algorithm**: Subtracts the mean (average) of I and Q components from all samples.

**When to Use**:

- Large, constant DC offsets
- Initial calibration
- When processing pre-recorded files

**Characteristics**:

- Fast: O(n) complexity
- Simple and predictable
- Works well for batch processing
- Does not track time-varying offsets

**Example**:

```typescript
import { removeDCOffsetStatic } from "@/utils/dspProcessing";

const correctedSamples = removeDCOffsetStatic(samples);
```

### 2. IIR DC Blocker

**Algorithm**: First-order IIR high-pass filter that removes DC component while preserving signal.

**Transfer Function**: `H(z) = (1 - z^-1) / (1 - α*z^-1)`

**When to Use**:

- Real-time streaming applications
- Time-varying DC offset
- Continuous operation

**Characteristics**:

- Tracks slow DC drift
- Minimal phase distortion
- Requires state management for continuous operation
- Cutoff frequency controlled by α parameter

**Alpha (α) Parameter**:

- Typical values: 0.95 - 0.999
- Higher α = lower cutoff frequency = slower response
- Lower α = higher cutoff frequency = faster response

**Cutoff Frequency**: `fc ≈ fs * (1 - α) / (2π)`

Examples:

- α = 0.99 at 100 kHz sample rate → fc ≈ 160 Hz
- α = 0.99 at 2 MHz sample rate → fc ≈ 3.2 kHz
- α = 0.995 at 100 kHz sample rate → fc ≈ 80 Hz

**Example**:

```typescript
import { removeDCOffsetIIR } from "@/utils/dspProcessing";

// Initialize state (must be preserved between calls)
const state = {
  prevInputI: 0,
  prevInputQ: 0,
  prevOutputI: 0,
  prevOutputQ: 0,
};

// Process first block
const corrected1 = removeDCOffsetIIR(samples1, state, 0.99);

// Process second block (state is updated)
const corrected2 = removeDCOffsetIIR(samples2, state, 0.99);
```

### 3. Combined DC Correction

**Algorithm**: Two-stage approach combining static removal followed by IIR blocking.

**When to Use**:

- Best overall performance
- When both large static and time-varying offsets are present
- Production applications

**Characteristics**:

- Stage 1: Removes bulk DC offset efficiently
- Stage 2: Tracks residual and time-varying DC
- Recommended for most applications

**Example**:

```typescript
import { removeDCOffsetCombined } from "@/utils/dspProcessing";

const state = {
  prevInputI: 0,
  prevInputQ: 0,
  prevOutputI: 0,
  prevOutputQ: 0,
};

const corrected = removeDCOffsetCombined(samples, state, 0.99);
```

## Integration with DSP Pipeline

DC correction is integrated into the IQ sampling stage of the DSP pipeline:

```typescript
import { processIQSampling } from "@/utils/dspProcessing";

// Basic usage (backward compatible)
const result = processIQSampling(samples, {
  sampleRate: 2048000,
  dcCorrection: true, // Uses static mode by default
  iqBalance: false,
});

// Advanced usage with specific mode
const state = {
  prevInputI: 0,
  prevInputQ: 0,
  prevOutputI: 0,
  prevOutputQ: 0,
};

const result = processIQSampling(samples, {
  sampleRate: 2048000,
  dcCorrection: true,
  dcCorrectionMode: "combined", // or 'static', 'iir', 'none'
  dcBlockerState: state,
  iqBalance: true,
});
```

## Performance Optimization

### WASM Acceleration

All DC correction algorithms have WASM-accelerated versions with SIMD support:

**Performance Benefits**:

- Static removal: 2-4x speedup for large blocks
- IIR blocker: Significant speedup for continuous streaming
- Automatic fallback to JavaScript if WASM unavailable

**Usage**:

```typescript
// WASM is used automatically if available
// To disable WASM (for testing):
const corrected = removeDCOffsetStatic(samples, false);
```

### SIMD Optimization

The WASM implementations use SIMD (Single Instruction, Multiple Data) to process 4 samples in parallel:

- Available when browser supports WebAssembly SIMD
- Provides additional 2x speedup over scalar WASM
- Automatic fallback to scalar WASM if SIMD unavailable

## Best Practices

### Choosing a Mode

| Scenario                   | Recommended Mode     | Alpha      |
| -------------------------- | -------------------- | ---------- |
| Initial calibration        | Static               | N/A        |
| Live streaming             | IIR or Combined      | 0.99-0.995 |
| Recorded file processing   | Static               | N/A        |
| Varying DC offset          | Combined             | 0.99       |
| Low sample rate (<100 kHz) | Combined with α=0.95 | 0.95       |
| High sample rate (>1 MHz)  | Combined with α=0.99 | 0.99       |

### State Management

For streaming applications using IIR or combined mode:

1. **Initialize state once** at the start of streaming
2. **Preserve state** between sample blocks
3. **Reset state** when changing frequency or restarting device

```typescript
class SDRProcessor {
  private dcState = {
    prevInputI: 0,
    prevInputQ: 0,
    prevOutputI: 0,
    prevOutputQ: 0,
  };

  processBlock(samples: Sample[]) {
    return removeDCOffsetIIR(samples, this.dcState, 0.99);
  }

  resetState() {
    this.dcState = {
      prevInputI: 0,
      prevInputQ: 0,
      prevOutputI: 0,
      prevOutputQ: 0,
    };
  }
}
```

### Tuning Alpha Parameter

Start with α = 0.99 and adjust based on:

- **Increase α** (0.995-0.999) if:
  - DC offset changes very slowly
  - You need to preserve very low frequencies
  - Seeing unwanted signal attenuation

- **Decrease α** (0.90-0.95) if:
  - DC offset changes quickly
  - Seeing slow convergence
  - Low sample rate applications

### Avoiding Signal Distortion

The IIR DC blocker acts as a high-pass filter. To avoid affecting your signal:

1. **Ensure cutoff is below signal bandwidth**:
   - For 100 kHz channel: fc < 1 kHz (α ≈ 0.999 at 2 MHz sample rate)
   - For 1 MHz channel: fc < 10 kHz (α ≈ 0.99 at 2 MHz sample rate)

2. **Monitor settling time**:
   - IIR filter needs ~1/fc seconds to settle
   - For fc = 160 Hz, settling time ≈ 6ms
   - Discard or reduce weight of initial samples if needed

## Industry Standards

rad.io's DC correction implementation follows industry best practices:

### References

1. **GNU Radio**: `gr::blocks::dc_blocker_cc`
   - Uses similar IIR design
   - Industry-standard α values

2. **Julius O. Smith III**: "Introduction to Digital Filters"
   - DC blocker design and theory
   - Transfer function analysis

3. **SDR# (SDRSharp)**:
   - Combined static + adaptive DC removal
   - Real-time DC tracking

4. **HDSDR**:
   - Multiple DC correction modes
   - User-configurable parameters

## Troubleshooting

### DC Spike Still Visible

**Possible causes**:

1. DC correction disabled
2. Alpha too high (0.999+) for sample rate
3. AGC not adapting to removed DC

**Solutions**:

- Verify `dcCorrection: true`
- Try lower α value (0.95-0.98)
- Use combined mode
- Check AGC settings

### Signal Distortion

**Possible causes**:

1. Cutoff frequency too high
2. Alpha too low
3. Signal bandwidth overlaps DC

**Solutions**:

- Increase α to 0.995 or higher
- Use static mode if signal is narrowband near DC
- Consider frequency shifting signal away from DC

### Slow Convergence

**Possible causes**:

1. Alpha too high
2. Very large initial DC offset
3. Not enough settling time

**Solutions**:

- Reduce α to 0.95-0.98
- Use combined mode (static + IIR)
- Allow more samples for settling

### Performance Issues

**Possible causes**:

1. WASM not loading
2. Processing too many samples at once
3. JavaScript fallback mode

**Solutions**:

- Check browser console for WASM errors
- Process samples in smaller blocks (1024-4096)
- Verify WASM module loaded successfully

## Technical Details

### Mathematical Foundation

**Static DC Removal**:

```
DC_I = (1/N) * Σ I[n]
DC_Q = (1/N) * Σ Q[n]
I'[n] = I[n] - DC_I
Q'[n] = Q[n] - DC_Q
```

**IIR DC Blocker**:

```
y[n] = x[n] - x[n-1] + α*y[n-1]

Where:
- x[n] = input sample
- y[n] = output sample
- α = pole location (0 < α < 1)
```

**Transfer Function**:

```
H(z) = (1 - z^-1) / (1 - α*z^-1)

Frequency Response:
|H(f)| = sqrt[(2 - 2*cos(2πf/fs)) / (1 + α² - 2α*cos(2πf/fs))]

At DC (f=0): |H(0)| = 0 (perfect rejection)
At Nyquist: |H(fs/2)| ≈ 1 (minimal attenuation)
```

### Implementation Details

**WASM Module**: `assembly/dsp.ts`

- `removeDCOffsetStatic()`: Scalar implementation
- `removeDCOffsetStaticSIMD()`: SIMD implementation (4-way parallel)
- `removeDCOffsetIIR()`: Stateful IIR filter

**JavaScript Bindings**: `src/utils/dspWasm.ts`

- `removeDCOffsetStaticWasm()`: Wrapper with fallback
- `removeDCOffsetIIRWasm()`: Wrapper with state management

**High-Level API**: `src/utils/dspProcessing.ts`

- `removeDCOffsetStatic()`: Public API
- `removeDCOffsetIIR()`: Public API
- `removeDCOffsetCombined()`: Public API
- `processIQSampling()`: Integrated pipeline

## Future Enhancements

Planned improvements for DC correction:

1. **Adaptive alpha**: Automatically adjust α based on DC drift rate
2. **Fast Settling Mode**: Rapid convergence for initial samples
3. **Calibration Wizard**: GUI tool for DC offset measurement and correction
4. **Hardware-Specific Profiles**: Optimized parameters for different SDR devices
5. **DC Offset Monitoring**: Real-time display of DC offset levels
6. **Automatic Mode Selection**: Choose best algorithm based on signal characteristics

## See Also

- [DSP Fundamentals](./dsp-fundamentals.md)
- [SDR Basics](./sdr-basics.md)
- [Signal Analysis](./signal-analysis.md)
- [Performance Optimization](./performance-optimization.md)
