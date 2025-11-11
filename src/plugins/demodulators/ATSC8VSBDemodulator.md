# ATSC 8-VSB Demodulator

## Overview

The ATSC 8-VSB (8-level Vestigial Sideband) demodulator is designed for processing digital television signals conforming to the ATSC standard used primarily in North America.

## Technical Specifications

### Modulation Parameters

- **Modulation**: 8-VSB (8 discrete amplitude levels)
- **Symbol Rate**: 10.76 Msymbols/sec
- **Channel Bandwidth**: 6 MHz
- **Pilot Tone**: 309.44 kHz offset from lower band edge
- **Symbol Levels**: -7, -5, -3, -1, +1, +3, +5, +7 (normalized)

### Data Structure

- **Data Segment**: 832 symbols
  - 4-symbol sync pattern at start
  - 828 data symbols
- **Field**: 313 data segments
- **Sync Pattern**: [+5, -5, -5, +5] (segment sync)

## Architecture

### 1. Pilot Tone Recovery

The demodulator implements a phase-locked loop (PLL) to:

- Remove the pilot tone at 309.44 kHz
- Correct carrier frequency offset
- Maintain phase coherence

**Algorithm**: Second-order PLL with proportional-integral control

- Loop bandwidth adaptive to signal conditions
- Fast acquisition with stable tracking

### 2. Symbol Timing Recovery

Uses the **Gardner algorithm** for symbol timing recovery:

- Operates on baseband samples
- Provides timing error estimates without requiring training sequences
- Adapts to sample rate variations

**Key Features**:

- Non-data-aided operation
- Robust to noise and interference
- Continuous adaptation

### 3. Adaptive Equalizer

Implements a **Least Mean Squares (LMS)** adaptive equalizer:

- 64 taps for multipath correction
- Compensates for channel distortion
- Adapts to time-varying channels

**Purpose**:

- Mitigate multipath interference (ghosting)
- Correct for frequency-selective fading
- Improve symbol detection accuracy

### 4. Sync Detection

**Segment Sync**:

- Detects 4-symbol pattern at start of each segment
- Provides frame alignment
- Tracks segment boundaries

**Field Sync**:

- Detects field boundaries (every 313 segments)
- Enables proper data framing
- Supports error correction synchronization

### 5. Symbol Slicing

Maps received samples to closest 8-VSB level:

- Minimum distance decision
- Provides soft-decision information for error correction
- Operates on equalized samples

## Usage

### Basic Example

```typescript
import { ATSC8VSBDemodulator } from './plugins/demodulators/ATSC8VSBDemodulator';

// Create demodulator instance
const demodulator = new ATSC8VSBDemodulator();

// Initialize
await demodulator.initialize();
await demodulator.activate();

// Process IQ samples
const iqSamples = [...]; // Your IQ samples
const symbols = demodulator.demodulate(iqSamples);

// Check sync status
if (demodulator.isSyncLocked()) {
  console.log('Sync locked!');
  console.log(`Segment count: ${demodulator.getSegmentSyncCount()}`);
  console.log(`Field count: ${demodulator.getFieldSyncCount()}`);
}
```

### Configuration

```typescript
// Set parameters
demodulator.setParameters({
  audioSampleRate: 10.76e6, // Match symbol rate
  bandwidth: 6e6, // 6 MHz channel
  squelch: 0, // No squelch
  afcEnabled: true, // Enable automatic frequency control
});

// Get current configuration
const config = demodulator.getParameters();
```

### Integration with Plugin System

```typescript
import { pluginRegistry } from "./lib/PluginRegistry";
import { ATSC8VSBDemodulator } from "./plugins/demodulators/ATSC8VSBDemodulator";

// Register demodulator
const demod = new ATSC8VSBDemodulator();
pluginRegistry.register(demod);

// Use with SDR
// ... SDR device setup ...
const samples = await sdrDevice.read();
const symbols = demod.demodulate(samples);
```

## Performance

### Computational Complexity

- **Pilot Recovery**: O(n) per sample
- **Timing Recovery**: O(n) with occasional interpolation
- **Equalization**: O(T) per symbol (T = number of taps)
- **Sync Detection**: O(1) amortized

### Throughput

Designed for real-time processing at 10.76 Msymbols/sec:

- Typical processing time: < 1ms per 1000 samples
- Memory usage: < 1MB for state
- Suitable for live ATSC reception

### Optimization Strategies

1. **Use typed arrays**: Float32Array for efficient processing
2. **Batch processing**: Process samples in chunks
3. **Buffer management**: Automatic memory limiting
4. **Minimal allocations**: Reuse buffers where possible

## Testing

The demodulator includes comprehensive test coverage:

```bash
# Run all demodulator tests
npm test -- --testNamePattern="ATSC8VSBDemodulator"

# Run with coverage
npm test -- --testNamePattern="ATSC8VSBDemodulator" --coverage
```

### Test Categories

- **Metadata**: Plugin identification and configuration
- **Initialization**: State setup and defaults
- **Mode Support**: Demodulation mode handling
- **Parameters**: Configuration management
- **Pilot Recovery**: Carrier tracking
- **Symbol Slicing**: Level detection
- **Sync Detection**: Segment and field sync
- **Equalization**: Multipath correction
- **Lifecycle**: Activation, deactivation, disposal
- **Performance**: Throughput and consistency

## Limitations

1. **Training Sequences**: Current implementation does not use training sequences for equalizer initialization
2. **Error Correction**: Symbol-level demodulation only; no Reed-Solomon or Trellis decoding
3. **Carrier Recovery Range**: PLL has limited acquisition range (±100 kHz typical)
4. **Multipath Depth**: Equalizer handles moderate multipath (< 20 μs delay spread)

## Future Enhancements

1. **Add Trellis Decoder**: Implement 12-phase trellis code decoder
2. **Reed-Solomon FEC**: Add forward error correction
3. **Training Sequences**: Use field sync for equalizer training
4. **Improved PLL**: Wider acquisition range
5. **Blind Equalization**: Initialize equalizer without training
6. **Performance Metrics**: SNR, BER, constellation quality

## References

1. **ATSC Standard A/53**: Digital Television Standard
2. **ATSC Recommended Practice A/54**: Guide to the Use of the ATSC Digital Television Standard
3. Gardner, F.M.: "A BPSK/QPSK Timing-Error Detector for Sampled Receivers"
4. Haykin, S.: "Adaptive Filter Theory" (LMS Algorithm)

## API Reference

### Constructor

```typescript
constructor();
```

Creates new ATSC 8-VSB demodulator instance with default parameters.

### Methods

#### `demodulate(samples: IQSample[]): Float32Array`

Demodulates IQ samples to 8-VSB symbols.

**Parameters**:

- `samples`: Array of IQ samples to demodulate

**Returns**: Float32Array of demodulated symbol levels

#### `getSupportedModes(): string[]`

Returns supported demodulation modes.

**Returns**: `["8vsb"]`

#### `setMode(mode: string): void`

Sets demodulation mode (only "8vsb" supported).

**Throws**: Error if mode is not supported

#### `getParameters(): DemodulatorParameters`

Gets current demodulation parameters.

**Returns**: Object with current configuration

#### `setParameters(params: Partial<DemodulatorParameters>): void`

Updates demodulation parameters.

**Parameters**:

- `params`: Partial configuration object

#### `isSyncLocked(): boolean`

Checks if demodulator has achieved sync lock.

**Returns**: `true` if sync is locked

#### `getSegmentSyncCount(): number`

Gets count of detected segment syncs.

**Returns**: Number of segment syncs detected

#### `getFieldSyncCount(): number`

Gets count of detected field syncs.

**Returns**: Number of field syncs detected

## License

Part of the rad.io project. See project LICENSE for details.
