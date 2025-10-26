# Codebase Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Documentation](#component-documentation)
3. [Device Implementation](#device-implementation)
4. [DSP Algorithms](#dsp-algorithms)
5. [Testing Strategy](#testing-strategy)
6. [Performance Optimization](#performance-optimization)

## Architecture Overview

### Design Patterns

**Model-View-Hook Pattern:**

```
Models (Device Logic) → Hooks (React Integration) → Views (Components)
```

- **Models**: Device implementations (`src/models/`)
- **Hooks**: React state management (`src/hooks/`)
- **Views**: UI components (`src/components/`, `src/pages/`)

**Universal Interface Pattern:**

- All SDR devices implement `ISDRDevice` interface
- Plug-and-play hardware support
- Consistent API across different hardware

> Agent note: For guidance on minimizing context noise when navigating this architecture, see the Serena memory "SERENA_MEMORY_BEST_PRACTICES" (use list_memories then read_memory to retrieve). Prefer symbol-first exploration over full-file reads.

### Data Flow

```
User Action → Hook → Device Model → WebUSB API → Hardware
                ↓
         State Update → Component Re-render → Canvas Update
```

### Component Hierarchy

```
App
└── Visualizer (Page)
    ├── RadioControls
    │   ├── SignalTypeSelector
    │   ├── PresetStations
    │   └── FrequencyInput
    ├── DSPPipeline
    └── Visualizations
        ├── IQConstellation (Canvas)
        ├── WaveformVisualizer (Canvas)
        └── Spectrogram (Canvas)
```

## Component Documentation

### Core Components

#### `Visualizer.tsx` (Main Page)

**Purpose**: Top-level application container

**State Management**:

- `device`: HackRFOne instance
- `listening`: Reception state flag
- `signalType`: FM/AM selection
- `frequency`: Current tuning frequency

**Key Functions**:

```typescript
handleSetFrequency(newFrequency: number)
  // Updates state and device configuration

handleSignalTypeChange(type: SignalType)
  // Switches between FM/AM with default frequencies

startListening()
  // Initializes device and starts reception

stopListening()
  // Stops reception and updates state
```

**Responsibilities**:

- Device lifecycle management
- Global state coordination
- Layout composition

---

#### `IQConstellation.tsx` (Visualization)

**Purpose**: Canvas-based IQ constellation diagram

**Algorithm**:

1. Calculate density map for sample points
2. Sort samples by density (low → high for Z-ordering)
3. Render with gradient colors based on density
4. Draw grid, axes, and statistics

**Rendering Layers**:

1. Background (dark theme)
2. Grid lines (fine + major)
3. Axes (centered at origin)
4. Sample points (density-colored gradients)
5. Color legend
6. Statistics overlay

**Performance Optimizations**:

- Density calculation with spatial binning
- Sorted rendering for proper Z-order
- GPU acceleration hints
- High-DPI scaling

**Configuration**:

```typescript
{
  width: 750,
  height: 400,
  gridSize: 0.01,        // Unit spacing
  densityGridSize: 0.003 // Density calculation resolution
}
```

---

#### `Spectrogram.tsx` (Visualization)

**Purpose**: Power spectral density with Viridis colormap

**Algorithm**:

1. Calculate FFT for each frame
2. Convert to dB scale
3. Normalize across all frames (global min/max)
4. Map to Viridis color scale
5. Render as heatmap

**Viridis Colormap** (11 control points):

```
[68,1,84]     → Dark purple (low)
[41,120,142]  → Blue
[34,167,132]  → Cyan-green
[121,209,81]  → Green
[253,231,37]  → Yellow (high)
```

**Features**:

- Dynamic range compression (5% threshold)
- Proper frequency bin mapping
- Time/frequency grid overlay
- Color scale legend
- Frame/bin count metadata

**Configuration**:

```typescript
{
  width: 750,
  height: 800,
  fftSize: 1024,
  frequencyRange: [1000, 1100] // Hz
}
```

---

#### `WaveformVisualizer.tsx` (Visualization)

**Purpose**: Time-domain amplitude envelope

**Algorithm**:

1. Calculate amplitude envelope from IQ samples
2. Adaptive downsampling for performance
3. Compute min/max/avg statistics
4. Render with triple-layer effects

**Rendering Layers**:

1. Background grid (fine + major)
2. Reference lines (min/max/avg)
3. Outer glow effect
4. Main waveform line
5. Inner highlight
6. Gradient fill
7. Statistics and legend

**Performance**:

- Adaptive downsampling: `min(samples.length, chartWidth * 2)`
- Efficient canvas operations
- Debounced resize handling

**Configuration**:

```typescript
{
  width: 750,
  height: 300,
  downsampleFactor: 2, // Points per pixel
  gridLevels: { fine: 8, major: 4 }
}
```

---

### Control Components

#### `RadioControls.tsx`

**Purpose**: Frequency input with unit conversion

**Features**:

- Automatic MHz/kHz conversion based on signal type
- Range validation
- Number input with step control
- Real-time frequency updates

**Signal Type Ranges**:

- FM: 88.1 - 107.9 MHz
- AM: 530 - 1700 kHz

---

#### `SignalTypeSelector.tsx`

**Purpose**: FM/AM toggle button

**Behavior**:

- Toggle between FM and AM modes
- Triggers frequency range adjustment
- Updates preset station list
- Visual active state indicator

---

#### `PresetStations.tsx`

**Purpose**: Quick-access station buttons

**Preset Lists**:

```typescript
FM: [
  { name: "NPR", frequency: 88.5e6 },
  { name: "Classic Rock", frequency: 95.5e6 },
  { name: "Pop", frequency: 100.3e6 },
  { name: "Jazz", frequency: 101.9e6 },
  { name: "Alternative", frequency: 103.1e6 },
  { name: "Country", frequency: 106.7e6 },
];

AM: [
  { name: "News", frequency: 660e3 },
  { name: "Talk Radio", frequency: 710e3 },
  { name: "Sports", frequency: 1010e3 },
  { name: "Music", frequency: 1130e3 },
  { name: "Public Radio", frequency: 1450e3 },
  { name: "Religious", frequency: 1600e3 },
];
```

**Features**:

- Grid layout (responsive)
- Active station highlighting
- One-click tuning
- Keyboard navigation support

---

#### `DSPPipeline.tsx`

**Purpose**: Visual representation of signal flow

**Pipeline Stages**:

1. **RF Input**: Antenna signal
2. **Tuner**: Frequency selection
3. **I/Q Sampling**: Digital conversion
4. **FFT**: Frequency analysis
5. **Demodulation**: Signal extraction
6. **Audio Output**: Speaker/headphones

**Educational Value**:

- Helps users understand signal processing
- Shows data flow through system
- Explains each stage's purpose

---

## Device Implementation

### Universal Interface (`ISDRDevice`)

**Required Methods**:

```typescript
// Lifecycle
async open(): Promise<void>
  // Initialize USB connection
  // Claim interface
  // Configure initial settings

async close(): Promise<void>
  // Stop streaming
  // Release interface
  // Close USB connection

isOpen(): boolean
  // Check connection state

// Configuration
async setFrequency(frequencyHz: number): Promise<void>
  // Validate range
  // Send control transfer
  // Update internal state

async getFrequency(): Promise<number>
  // Return current frequency

async setSampleRate(sampleRateHz: number): Promise<void>
  // Validate supported rates
  // Configure device

async setLNAGain(gainDb: number): Promise<void>
  // Set IF gain (0-40 dB typical)

async setAmpEnable(enabled: boolean): Promise<void>
  // Enable/disable amplifier

// Streaming
async receive(callback?: IQSampleCallback): Promise<void>
  // Start reception
  // Loop: read transfers → parse → callback
  // Handle errors gracefully

async stopRx(): Promise<void>
  // Stop streaming loop
  // Set transceiver to OFF

isReceiving(): boolean
  // Check streaming state

// Metadata
async getDeviceInfo(): Promise<SDRDeviceInfo>
  // Return device identification

getCapabilities(): SDRCapabilities
  // Return device specifications

// Data Parsing
parseSamples(data: DataView): IQSample[]
  // Convert raw bytes to IQ pairs
  // Handle device-specific formats
```

---

### HackRF One Implementation

**USB Configuration**:

```typescript
Vendor ID: 0x1d50
Product ID: 0x6089
Interface: 0
Endpoint (RX): 1 (bulk in)
```

**Critical Initialization Pattern**:

```typescript
// MUST configure in this order before streaming:
await device.setSampleRate(20_000_000);  // 1. Sample rate first (CRITICAL)
await device.setFrequency(freq);         // 2. Center frequency
await device.setBandwidth(bw);           // 3. Bandwidth (optional)
await device.setLNAGain(gain);           // 4. Gain (optional)
await device.setAmpEnable(enable);       // 5. Amplifier (optional)
await device.receive(callback);          // 6. Start streaming (sets RX mode)
```

**Why Order Matters**:
- Sample rate MUST be set first - device hangs without it
- Other settings may depend on sample rate
- Matches libhackrf C reference implementation

**Control Transfer Commands**:

```typescript
enum RequestCommand {
  SET_FREQ = 16, // Set center frequency
  AMP_ENABLE = 17, // Enable amplifier
  SET_LNA_GAIN = 19, // Set IF gain
  SAMPLE_RATE_SET = 6, // Set sample rate
  SET_TRANSCEIVER_MODE = 1, // OFF/RX/TX
  UI_ENABLE = 37, // Enable UI mode
}
```

**Transfer Pattern**:

```typescript
// Control Transfer
await device.controlTransferOut(
  {
    requestType: "vendor",
    recipient: "device",
    request: command,
    value,
    index,
  },
  data,
);

// Bulk Transfer (IQ data)
const result = await device.transferIn(endpoint, bufferSize);
```

**Sample Format**:

- Type: Signed 8-bit integers (Int8Array)
- Layout: Interleaved I/Q pairs
- Conversion: value / 128.0 (normalize to ±1.0)

**Critical Implementation Details**:

1. **State Management**: Use flags (`streaming`, `closing`)
2. **Mutex Locking**: Prevent concurrent control transfers
3. **Retry Logic**: Handle `InvalidStateError` with delays
4. **Cleanup**: Proper shutdown sequence (stop RX → set OFF → UI enable)
5. **Timeout Protection**: 5s timeout on transferIn() to prevent hangs
6. **Automatic Recovery**: After 3 consecutive timeouts, attempt device reset
7. **Health Validation**: Check device state before configuration changes

**Configuration State Tracking**:

Device maintains last-known configuration for recovery:
- `lastSampleRate`: For restoring after reset
- `lastFrequency`: Current tuning
- `lastBandwidth`: Filter setting
- `lastLNAGain`: Amplification level
- `lastAmpEnabled`: Amplifier state

**Device Health APIs**:

```typescript
// Check configuration status
device.getConfigurationStatus(): {
  isOpen: boolean;
  isStreaming: boolean;
  sampleRate: number | null;
  frequency: number | null;
  // ... other settings
  isConfigured: boolean;  // true if sample rate set
}

// Validate ready for streaming
device.validateReadyForStreaming(): {
  ready: boolean;
  issues: string[];  // Specific problems if not ready
}

// Manual recovery
await device.fastRecovery();  // Reset with config restore
await device.reset();          // Full reset (requires reconfig)
```

**See Also**:
- Memory: HACKRF_DEVICE_INITIALIZATION_BUG_FIX (initialization requirements)
- Memory: HACKRF_PROTECTIVE_MEASURES_IMPLEMENTATION (timeout/recovery)
- Memory: HACKRF_ERROR_HANDLING_ENHANCEMENT_2025 (health APIs)
- Doc: docs/reference/hackrf-troubleshooting.md (user-facing guide)

---

## DSP Algorithms

### Manual DFT Implementation

**Purpose**: Synchronous FFT calculation without external libraries

**Algorithm**:

```typescript
function calculateFFTSync(samples: IQSample[], fftSize: number): Float32Array {
  const output = new Float32Array(fftSize);

  for (let k = 0; k < fftSize; k++) {
    let real = 0,
      imag = 0;

    for (let n = 0; n < fftSize; n++) {
      const angle = (-2 * Math.PI * k * n) / fftSize;
      real += samples[n].I * Math.cos(angle) - samples[n].Q * Math.sin(angle);
      imag += samples[n].I * Math.sin(angle) + samples[n].Q * Math.cos(angle);
    }

    // Magnitude
    const magnitude = Math.sqrt(real * real + imag * imag);

    // Convert to dB
    output[k] = 20 * Math.log10(magnitude + 1e-10);
  }

  return output;
}
```

**Complexity**: O(N²) - acceptable for N ≤ 2048

**Optimizations**:

- Pre-compute trig functions for common sizes
- Use typed arrays (Float32Array)
- Parallel execution with Web Workers (future)

---

### Frequency Shifting

**Purpose**: Center zero frequency in FFT output

**Algorithm**:

```typescript
function shiftFFT(fft: Float32Array): Float32Array {
  const half = fft.length / 2;
  const shifted = new Float32Array(fft.length);

  // Negative frequencies → start
  shifted.set(fft.slice(half), 0);

  // Positive frequencies → end
  shifted.set(fft.slice(0, half), half);

  return shifted;
}
```

**Result**: Index `N/2` contains DC component

---

### Waveform Analysis

**Purpose**: Extract amplitude envelope and phase

**Algorithm**:

```typescript
function calculateWaveform(samples: IQSample[]) {
  const amplitude = new Float32Array(samples.length);
  const phase = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const { I, Q } = samples[i];
    amplitude[i] = Math.sqrt(I * I + Q * Q);
    phase[i] = Math.atan2(Q, I);
  }

  return {
    amplitude,
    phase,
    maxAmplitude: Math.max(...amplitude),
    minAmplitude: Math.min(...amplitude),
    avgAmplitude: amplitude.reduce((a, b) => a + b) / amplitude.length,
  };
}
```

---

## Testing Strategy

### Test Pyramid

```
    E2E Tests (Manual)
         /\
        /  \
   Integration Tests (Hooks)
      /      \
     /        \
  Unit Tests (Components, DSP, Devices)
```

### Test Coverage by Category

**1. DSP Utilities (29 tests)**

- Sine wave generation accuracy
- FFT frequency detection (±1 bin tolerance)
- Amplitude response verification
- Multi-tone resolution
- Phase continuity
- Parseval's theorem validation
- Edge cases and robustness

**2. Component Tests (24 tests)**

- Canvas rendering validation
- Dimension handling
- Sample pattern accuracy
- Boundary conditions
- Large dataset performance
- High-DPI support
- Component lifecycle

**3. Device Interface (43 tests)**

- Lifecycle operations
- Configuration validation
- Format conversion correctness
- Frequency range enforcement
- Sample rate support
- Gain control validation
- Visualization compatibility

**4. Realistic Signal Data (26 tests)**

- FM modulation characteristics
- AM envelope detection
- QPSK constellation points
- Noise floor verification
- Multi-tone peaks
- Pulsed signal timing
- Cross-visualization consistency

### Test Data Generators

**Sine Wave Generation**:

```typescript
function generateSineWave(
  frequency: number, // Hz
  amplitude: number, // 0-1 range
  sampleCount: number,
  phase: number = 0, // radians
): IQSample[];
```

**Modulation Schemes**:

```typescript
generateFMSignal(); // 75kHz deviation
generateAMSignal(); // 80% modulation index
generateQPSKSignal(); // 4-point constellation
generateMultiToneSignal(); // Multiple carriers
generatePulsedSignal(); // Radar/burst patterns
generateNoiseSignal(); // Thermal noise floor
```

### Assertion Patterns

**FFT Accuracy**:

```typescript
// Expect peak at specific bin (±1 tolerance)
const peakBin = findPeakBin(fft);
expect(peakBin).toBeGreaterThanOrEqual(expectedBin - 1);
expect(peakBin).toBeLessThanOrEqual(expectedBin + 1);
```

**Canvas Rendering**:

```typescript
// Verify canvas context created
const ctx = canvas.getContext("2d");
expect(ctx).not.toBeNull();

// Verify drawing operations called
expect(ctx.fillRect).toHaveBeenCalled();
expect(ctx.stroke).toHaveBeenCalled();
```

**Device Validation**:

```typescript
// Ensure frequency in valid range
await expect(device.setFrequency(0)).rejects.toThrow();
await expect(device.setFrequency(10e9)).rejects.toThrow();
await device.setFrequency(100e6); // Should succeed
```

---

## Performance Optimization

### Canvas Rendering

**High-DPI Support**:

```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
ctx.scale(dpr, dpr);
```

**GPU Acceleration**:

```typescript
const ctx = canvas.getContext("2d", {
  alpha: false, // Opaque rendering
  desynchronized: true, // GPU hint
});
```

**Sub-Pixel Rendering**:

```typescript
// Crisp lines at integer coordinates
ctx.translate(0.5, 0.5);
ctx.moveTo(Math.floor(x), Math.floor(y));
```

### DSP Processing

**Typed Arrays**:

- Use `Float32Array` for numerical operations
- Avoid array allocations in hot paths
- Pre-allocate buffers where possible

**Adaptive Downsampling**:

```typescript
const maxPoints = chartWidth * 2;
if (samples.length > maxPoints) {
  const step = Math.floor(samples.length / maxPoints);
  samples = samples.filter((_, i) => i % step === 0);
}
```

### Memory Management

**Object Pooling**:

```typescript
// Reuse buffers for FFT calculations
const bufferPool = new Map<number, Float32Array>();

function getBuffer(size: number): Float32Array {
  if (!bufferPool.has(size)) {
    bufferPool.set(size, new Float32Array(size));
  }
  return bufferPool.get(size)!;
}
```

**Cleanup**:

```typescript
useEffect(() => {
  // Setup
  return () => {
    // Cleanup: release resources
    device?.close();
    bufferPool.clear();
  };
}, [device]);
```

### Bundle Size Optimization

**Code Splitting**:

- Lazy load heavy components
- Dynamic imports for optional features
- Tree shaking enabled in webpack

**Dependency Reduction**:

- Removed: D3, visx, webfft (saved ~400KB)
- Using: Native WebAudio API, Canvas API
- Result: 4.9MB total, 1.2MB gzipped

---

## API Reference

### Hooks

**`useHackRFDevice()`**

```typescript
Returns: {
  device: HackRFOne | undefined
  initialize: () => Promise<void>
  cleanup: () => void
}
```

**`useUSBDevice(filters: USBDeviceFilter[])`**

```typescript
Returns: {
  device: USBDevice | undefined;
  requestDevice: () => Promise<void>;
}
```

### Utility Functions

**`convertInt8ToIQ(data: DataView): IQSample[]`**

- Converts HackRF Int8 samples to IQ pairs
- Normalizes to ±1.0 range

**`convertUint8ToIQ(data: DataView): IQSample[]`**

- Converts RTL-SDR Uint8 samples to IQ pairs
- Handles 127 offset
- Normalizes to ±1.0 range

**`validateFrequency(freq: number): boolean`**

- Returns true if 10 kHz ≤ freq ≤ 6 GHz

**`validateSampleRate(rate: number, supported: number[]): boolean`**

- Checks if rate is in supported list

---

## Debugging Guide

### Common Issues

**Device Not Opening**:

```typescript
// Check device state
console.log("Opened:", device.opened);
console.log("Configuration:", device.configuration);

// Verify interface claim
try {
  await device.claimInterface(0);
} catch (err) {
  console.error("Failed to claim interface:", err);
}
```

**Invalid State Errors**:

```typescript
// Add mutex locking
private transferMutex = Promise.resolve();

private async acquireLock() {
  let release;
  const prev = this.transferMutex;
  this.transferMutex = new Promise(r => release = r);
  await prev;
  return release;
}

// Use in transfers
const release = await this.acquireLock();
try {
  await device.controlTransferOut(...);
} finally {
  release();
}
```

**Canvas Not Updating**:

```typescript
// Force re-render
useEffect(() => {
  const render = () => {
    drawVisualization();
    requestAnimationFrame(render);
  };
  render();
}, [samples]);
```

### Logging

**Device Operations**:

```typescript
console.debug("Set Frequency", { frequency, mhz, hz });
console.debug("Received data", { byteLength: data.byteLength });
```

**Performance Metrics**:

```typescript
const start = performance.now();
calculateFFT(samples);
const duration = performance.now() - start;
console.log(`FFT took ${duration.toFixed(2)}ms`);
```

**State Tracking**:

```typescript
console.log("Device state:", {
  opened: device.opened,
  streaming,
  frequency,
  sampleRate,
});
```

---

## Best Practices

### Code Organization

- One component per file
- Group related utilities
- Separate concerns (UI / logic / data)
- Use index files for clean imports

### Type Safety

- Enable strict mode
- Explicit return types
- No `any` without justification
- Proper error types

### Performance

- Memoize expensive calculations
- Debounce event handlers
- Use `useMemo` and `useCallback`
- Profile with React DevTools

### Testing

- Test public APIs
- Mock external dependencies
- Use realistic test data
- Aim for high coverage

### Documentation

- JSDoc for public functions
- Inline comments for complex logic
- README for usage instructions
- Architecture docs for design decisions

---

This documentation provides comprehensive coverage of the codebase architecture, implementation details, and best practices for maintaining and extending the rad.io SDR visualizer application.
