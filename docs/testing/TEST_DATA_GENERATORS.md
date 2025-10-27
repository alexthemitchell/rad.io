# Test Data Generators and Utilities

## Overview

This document describes the test data generators and utilities available for testing rad.io components. These tools help create deterministic, reproducible test data for DSP, visualization, and integration tests.

## Signal Generators (`src/utils/signalGenerator.ts`)

### Basic IQ Signal Generation

#### `generateIQSamples(options)`

Generate a pure sinusoidal IQ signal at a specific frequency.

**Usage:**
```typescript
import { generateIQSamples } from '../utils/signalGenerator';

const samples = generateIQSamples({
  sampleRate: 2048000,   // 2.048 MHz sample rate
  frequency: 100000,     // 100 kHz signal
  amplitude: 0.8,        // 80% amplitude
  duration: 0.1,         // 100ms duration
  phase: 0,              // Optional: phase offset in radians
  noiseLevel: 0.1,       // Optional: add 10% noise
});
```

**Returns:** `ComplexIQSamples` with interleaved I/Q samples.

### Multi-Tone Signals

#### `generateMultiToneIQ(options)`

Generate multiple sinusoids at different frequencies for testing frequency discrimination.

**Usage:**
```typescript
import { generateMultiToneIQ } from '../utils/signalGenerator';

const samples = generateMultiToneIQ({
  sampleRate: 2048000,
  tones: [
    { frequency: 100000, amplitude: 0.8, phase: 0 },
    { frequency: 200000, amplitude: 0.5, phase: Math.PI / 4 },
    { frequency: 300000, amplitude: 0.3 },
  ],
  duration: 0.1,
  noiseLevel: 0.05,
});
```

**Use cases:**
- Testing FFT frequency resolution
- Channel separation tests
- Interference scenarios

### Modulated Signals

#### `generateFMIQ(options)`

Generate FM (Frequency Modulation) signals for testing demodulation.

**Usage:**
```typescript
import { generateFMIQ } from '../utils/signalGenerator';

const fmSignal = generateFMIQ({
  sampleRate: 2048000,
  carrierFreq: 100000,     // Carrier at 100 kHz
  modulationFreq: 1000,    // 1 kHz audio signal
  deviation: 5000,         // 5 kHz deviation
  amplitude: 0.8,
  duration: 0.1,
  noiseLevel: 0.01,
});
```

**Use cases:**
- FM demodulation tests
- Deviation accuracy tests
- Audio quality tests

#### `generateAMIQ(options)`

Generate AM (Amplitude Modulation) signals.

**Usage:**
```typescript
import { generateAMIQ } from '../utils/signalGenerator';

const amSignal = generateAMIQ({
  sampleRate: 2048000,
  carrierFreq: 100000,
  modulationFreq: 1000,
  modulationDepth: 0.5,    // 50% modulation
  amplitude: 0.8,
  duration: 0.1,
});
```

**Use cases:**
- AM demodulation tests
- Envelope detection tests
- Broadcast signal simulation

### Special Signals

#### `generateChirpIQ(options)`

Generate linear frequency sweep (chirp) for testing time-frequency analysis.

**Usage:**
```typescript
import { generateChirpIQ } from '../utils/signalGenerator';

const chirp = generateChirpIQ({
  sampleRate: 2048000,
  startFreq: 50000,     // Start at 50 kHz
  endFreq: 150000,      // End at 150 kHz
  amplitude: 0.8,
  duration: 0.1,
});
```

**Use cases:**
- Spectrogram tests
- Filter response tests
- Time-frequency representation

#### `generateNoiseIQ(options)`

Generate uniform random noise.

**Usage:**
```typescript
import { generateNoiseIQ } from '../utils/signalGenerator';

const noise = generateNoiseIQ({
  sampleRate: 2048000,
  amplitude: 0.1,
  duration: 0.1,
});
```

**Use cases:**
- Noise floor tests
- Signal detection threshold tests
- SNR calculations

### Signal Quality Metrics

#### `calculateSNR(samples, signalFreq, sampleRate)`

Calculate signal-to-noise ratio in dB.

**Usage:**
```typescript
import { calculateSNR, generateIQSamples } from '../utils/signalGenerator';

const samples = generateIQSamples({
  sampleRate: 2048000,
  frequency: 100000,
  amplitude: 0.8,
  duration: 0.1,
  noiseLevel: 0.1,
});

const snr = calculateSNR(samples.samples, 100000, 2048000);
expect(snr).toBeGreaterThan(20); // Expect >20 dB SNR
```

## Test Helpers (`src/utils/testHelpers.ts`)

### Canvas Mocking

#### `createMockCanvasContext()`

Create a mock 2D canvas context for testing visualizations.

**Usage:**
```typescript
import { createMockCanvasContext } from '../utils/testHelpers';

beforeEach(() => {
  const mockContext = createMockCanvasContext();
  HTMLCanvasElement.prototype.getContext = jest.fn(() => mockContext);
});
```

#### `createMockWebGLContext()`

Create a mock WebGL context for testing GPU-accelerated visualizations.

**Usage:**
```typescript
import { createMockWebGLContext } from '../utils/testHelpers';

const gl = createMockWebGLContext();
// Use in tests that need WebGL
```

### Sample Data

#### `createTestSamples(count, pattern)`

Create simple IQ samples for visualization tests.

**Usage:**
```typescript
import { createTestSamples } from '../utils/testHelpers';

const samples = createTestSamples(1000, 'sine');
// patterns: 'sine', 'linear', 'random'
```

### Async Utilities

#### `waitForCondition(condition, timeout, interval)`

Wait for a condition to be true with timeout.

**Usage:**
```typescript
import { waitForCondition } from '../utils/testHelpers';

await waitForCondition(
  () => component.state.isReady === true,
  2000, // 2 second timeout
  50    // check every 50ms
);
```

### Deterministic Random

#### `SeededRandom`

Generate reproducible random numbers for tests.

**Usage:**
```typescript
import { SeededRandom } from '../utils/testHelpers';

const rng = new SeededRandom(42); // Fixed seed for reproducibility

const value1 = rng.next();           // 0 to 1
const value2 = rng.range(10, 20);    // 10 to 20

rng.reset(42); // Reset to initial state
```

### Array Comparison

#### `expectFloat32ArraysClose(actual, expected, tolerance)`

Assert approximate equality of Float32Arrays.

**Usage:**
```typescript
import { expectFloat32ArraysClose } from '../utils/testHelpers';

expectFloat32ArraysClose(
  actualFFT,
  expectedFFT,
  1e-6  // tolerance
);
```

### Console Suppression

#### `suppressConsole(methods)`

Suppress console output during tests.

**Usage:**
```typescript
import { suppressConsole } from '../utils/testHelpers';

test('should handle error gracefully', () => {
  const restore = suppressConsole(['error', 'warn']);
  
  // Test code that generates expected errors
  expect(() => functionThatThrows()).toThrow();
  
  restore();
});
```

### File Mocking

#### `createMockFile(content, filename, mimeType)`

Create mock File objects for upload tests.

**Usage:**
```typescript
import { createMockFile } from '../utils/testHelpers';

const file = createMockFile(
  'IQ sample data',
  'samples.iq',
  'application/octet-stream'
);
```

## Memory Management (`src/utils/testMemoryManager.ts`)

### `clearMemoryPools()`

Clear DSP memory pools between tests.

**Usage:**
```typescript
import { clearMemoryPools } from '../utils/testMemoryManager';

afterEach(() => {
  clearMemoryPools();
});
```

## Best Practices

### 1. Use Deterministic Data

```typescript
// ✅ Good: Deterministic signal
const samples = generateIQSamples({
  sampleRate: 2048000,
  frequency: 100000,
  amplitude: 0.8,
  duration: 0.1,
});

// ❌ Bad: Random data makes tests flaky
const samples = generateNoiseIQ({
  sampleRate: 2048000,
  amplitude: Math.random(),
  duration: Math.random() * 0.2,
});
```

### 2. Choose Appropriate Signal Parameters

```typescript
// ✅ Good: Simple, well-separated frequencies
const samples = generateMultiToneIQ({
  sampleRate: 2048000,
  tones: [
    { frequency: 100000, amplitude: 0.8 },
    { frequency: 200000, amplitude: 0.5 },
  ],
  duration: 0.1,
});

// ❌ Bad: Frequencies too close, aliasing issues
const samples = generateMultiToneIQ({
  sampleRate: 2048000,
  tones: [
    { frequency: 1000000, amplitude: 0.8 },  // Near Nyquist
    { frequency: 1010000, amplitude: 0.5 },  // Too close
  ],
  duration: 0.001, // Too short for FFT
});
```

### 3. Clean Up Between Tests

```typescript
describe('DSP Tests', () => {
  afterEach(() => {
    clearMemoryPools();
    jest.clearAllMocks();
  });
  
  test('should process FFT', () => {
    const samples = generateIQSamples({
      sampleRate: 2048000,
      frequency: 100000,
      amplitude: 0.8,
      duration: 0.1,
    });
    
    const result = calculateFFT(samples.samples);
    expect(result).toBeDefined();
  });
});
```

### 4. Validate Signal Quality

```typescript
test('should maintain high SNR', () => {
  const samples = generateIQSamples({
    sampleRate: 2048000,
    frequency: 100000,
    amplitude: 0.8,
    duration: 0.1,
    noiseLevel: 0.01,
  });
  
  const snr = calculateSNR(samples.samples, 100000, 2048000);
  expect(snr).toBeGreaterThan(30); // High quality signal
});
```

### 5. Use Seeded Random for Edge Cases

```typescript
test('should handle random input reliably', () => {
  const rng = new SeededRandom(42);
  
  // Generate reproducible "random" test cases
  for (let i = 0; i < 100; i++) {
    const amplitude = rng.range(0.1, 1.0);
    const frequency = rng.range(10000, 500000);
    
    const samples = generateIQSamples({
      sampleRate: 2048000,
      frequency,
      amplitude,
      duration: 0.1,
    });
    
    expect(processSamples(samples)).toBeDefined();
  }
});
```

## Common Patterns

### FFT Testing

```typescript
import { generateIQSamples, calculateSNR } from '../utils/signalGenerator';

test('FFT should detect signal frequency', () => {
  const samples = generateIQSamples({
    sampleRate: 2048000,
    frequency: 100000,
    amplitude: 0.8,
    duration: 0.1,
  });
  
  const fft = calculateFFT(samples.samples, 2048);
  const peakBin = findPeakBin(fft);
  const peakFreq = (peakBin * 2048000) / 2048;
  
  expect(peakFreq).toBeCloseTo(100000, -2);
});
```

### Visualization Testing

```typescript
import { createTestSamples, createMockCanvasContext } from '../utils/testHelpers';

test('should render constellation', () => {
  const mockContext = createMockCanvasContext();
  const samples = createTestSamples(1000, 'sine');
  
  renderConstellation(mockContext, samples);
  
  expect(mockContext.fillRect).toHaveBeenCalled();
});
```

### Demodulation Testing

```typescript
import { generateFMIQ } from '../utils/signalGenerator';

test('FM demodulator should extract audio', () => {
  const fmSignal = generateFMIQ({
    sampleRate: 2048000,
    carrierFreq: 100000,
    modulationFreq: 1000,
    deviation: 5000,
    amplitude: 0.8,
    duration: 0.1,
  });
  
  const audio = demodulateF(fmSignal.samples, 2048000);
  
  // Verify audio frequency
  const audioFFT = calculateFFT(audio, 1024);
  const peakBin = findPeakBin(audioFFT);
  const audioFreq = (peakBin * 48000) / 1024; // Assuming 48kHz audio
  
  expect(audioFreq).toBeCloseTo(1000, -1);
});
```
