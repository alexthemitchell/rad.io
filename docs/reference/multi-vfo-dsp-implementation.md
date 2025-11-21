# Multi-VFO DSP Pipeline - Implementation Guide

## Overview

The Multi-VFO DSP pipeline enables simultaneous extraction and demodulation of multiple signals from a single wideband IQ capture. This document describes the implementation details of Phase 3: DSP Multi-Channel Extraction.

## Architecture

### Components

1. **AssemblyScript Multi-Mixer** (`assembly/dsp.ts`)
   - Low-level WASM-accelerated DSP primitives
   - Optimized for 1-2 VFO per-channel mixing strategy
   - Maintains phase coherence across buffer boundaries

2. **MultiVfoProcessor** (`src/lib/dsp/MultiVfoProcessor.ts`)
   - High-level TypeScript orchestrator
   - Hybrid channelization strategy selection
   - Audio buffer delivery and mixing
   - Metrics collection and reporting

3. **Test Suite** (`src/lib/dsp/__tests__/MultiVfoProcessor.test.ts`)
   - Comprehensive validation with synthetic multi-tone signals
   - Strategy selection verification
   - Power metrics validation

## Processing Pipeline

```
Wideband IQ Samples (e.g., 2 MS/s, 2 MHz bandwidth)
         ↓
    [Strategy Selection]
         ↓
    ┌────┴─────┐
    ↓          ↓
 Per-VFO    PFB Channelizer
 (1-2 VFOs) (3+ VFOs)
    ↓          ↓
    └────┬─────┘
         ↓
  Per-VFO Decimated IQ
  (e.g., 20 kHz for AM)
         ↓
  [Demodulator Plugin]
         ↓
    Audio Samples
    (e.g., 48 kHz)
         ↓
   [Audio Mixer]
         ↓
  Final Audio Output
```

## Strategy Selection

The processor automatically selects the optimal channelization strategy based on VFO count:

### Per-VFO Strategy (1-2 VFOs)

**When to use:** VFO count < `pfbThreshold` (default: 3)

**Process:**
1. For each VFO:
   - Frequency shift: Move VFO center to baseband (0 Hz)
   - Low-pass filter: Isolate channel bandwidth
   - Decimate: Reduce sample rate to channel rate

**Advantages:**
- Lower latency
- Simpler processing for few VFOs
- WASM-accelerated when available

**Implementation:** `multiVfoMixer()` in AssemblyScript

### PFB Strategy (3+ VFOs)

**When to use:** VFO count >= `pfbThreshold`

**Process:**
1. Single polyphase filter bank channelization
2. Extract all VFO channels in one pass
3. Amortize FFT cost across all VFOs

**Advantages:**
- More efficient for many VFOs
- Better filter quality
- Shared computational cost

**Implementation:** `pfbChannelize()` from existing codebase

## AssemblyScript Functions

### `frequencyShift()`

Translates IQ samples in frequency domain by complex multiplication with e^(-j·2π·f·t).

```typescript
export function frequencyShift(
  iSamples: Float32Array,      // Input I component
  qSamples: Float32Array,      // Input Q component
  outputI: Float32Array,       // Output I component
  outputQ: Float32Array,       // Output Q component
  size: i32,                   // Number of samples
  frequencyHz: f64,            // Frequency offset in Hz
  sampleRate: f64,             // Sample rate in Hz
  initialPhase: f64,           // Starting NCO phase
): f64                         // Returns final phase
```

**Key features:**
- Maintains NCO phase across buffer boundaries
- Phase wrapping to prevent numerical drift
- Complex multiplication: `(I + jQ) × e^(-j·θ)`

### `movingAverageLowPass()`

Simple low-pass FIR filter for anti-aliasing before decimation.

```typescript
export function movingAverageLowPass(
  iSamples: Float32Array,
  qSamples: Float32Array,
  outputI: Float32Array,
  outputQ: Float32Array,
  size: i32,
  taps: i32,                   // Filter length
): void
```

**Characteristics:**
- Linear phase response
- Simple implementation
- Adequate for basic anti-aliasing

### `decimate()`

Reduces sample rate by integer factor N (keep every Nth sample).

```typescript
export function decimate(
  iSamples: Float32Array,
  qSamples: Float32Array,
  outputI: Float32Array,
  outputQ: Float32Array,
  inputSize: i32,
  factor: i32,                 // Decimation factor
): i32                         // Returns output sample count
```

### `multiVfoMixer()`

Main multi-VFO extraction routine combining shift, filter, and decimate.

```typescript
export function multiVfoMixer(
  iSamples: Float32Array,       // Wideband I samples
  qSamples: Float32Array,       // Wideband Q samples
  inputSize: i32,
  vfoFreqOffsets: Float64Array, // Freq offset for each VFO
  numVfos: i32,
  sampleRate: f64,
  decimationFactor: i32,
  filterTaps: i32,
  vfoPhases: Float64Array,      // Initial phases (state)
  outputBuffer: Float32Array,   // Flat output array
): Float64Array                 // Returns updated phases
```

**Output format:**
```
outputBuffer layout: [vfo0_I[], vfo0_Q[], vfo1_I[], vfo1_Q[], ...]
Each VFO occupies: 2 × ceil(inputSize / decimationFactor) samples
```

**Example usage:**
```typescript
const outputSize = Math.ceil(inputSize / decimationFactor);
const outputBuffer = new Float32Array(numVfos * 2 * outputSize);
const updatedPhases = multiVfoMixer(
  wideband_I,
  wideband_Q,
  inputSize,
  vfoOffsets,
  numVfos,
  sampleRate,
  decimationFactor,
  filterTaps,
  vfoPhases,
  outputBuffer
);
// Save updatedPhases for next buffer iteration
```

## TypeScript MultiVfoProcessor

### Configuration

```typescript
interface MultiVfoProcessorConfig {
  sampleRate: number;              // Wideband sample rate (Hz)
  centerFrequency: number;         // Wideband center frequency (Hz)
  pfbThreshold?: number;           // VFO count to switch to PFB (default: 3)
  maxConcurrentAudio?: number;     // Max simultaneous audio streams (default: 1)
  audioOutputSampleRate?: number;  // Audio output rate (default: 48000)
  enableMetrics?: boolean;         // Collect performance metrics (default: true)
}
```

### Usage Example

```typescript
import { MultiVfoProcessor } from "@/lib/dsp";

// Initialize processor
const processor = new MultiVfoProcessor({
  sampleRate: 2_000_000,        // 2 MS/s
  centerFrequency: 100_000_000, // 100 MHz
  pfbThreshold: 3,
  maxConcurrentAudio: 1,
});

// Add VFOs
const vfo1 = {
  id: "vfo-1",
  centerHz: 99_900_000,  // 99.9 MHz
  modeId: "wbfm",
  bandwidthHz: 200_000,
  audioEnabled: true,
  demodulator: fmDemodulator,
  // ... other VfoState fields
};
processor.addVfo(vfo1);

// Process wideband samples
const widebandSamples: IQSample[] = getWidebandSamples();
const results = await processor.processSamples(
  widebandSamples,
  [vfo1, vfo2, vfo3]
);

// Access per-VFO results
for (const [vfoId, result] of results) {
  console.log(`VFO ${vfoId}:`);
  console.log(`  RSSI: ${result.metrics.rssi.toFixed(1)} dBFS`);
  console.log(`  Samples: ${result.metrics.samplesProcessed}`);
  
  if (result.audio) {
    // Route to audio output
    playAudio(result.audio.audio, result.audio.sampleRate);
  }
}

// Mix multiple audio streams
const audioBuffers = Array.from(results.values())
  .map(r => r.audio)
  .filter(a => a !== null);
const mixed = processor.mixAudioBuffers(audioBuffers);
```

### Audio Buffer Format

```typescript
interface VfoAudioBuffer {
  vfoId: string;           // VFO identifier
  audio: Float32Array;     // Mono audio samples
  sampleRate: number;      // Sample rate (Hz)
  timestamp: number;       // Processing timestamp (ms)
}
```

### Metrics Format

```typescript
interface VfoMetrics {
  rssi: number;                 // Signal strength (dBFS)
  samplesProcessed: number;     // Sample count in this batch
  processingTime: number;       // CPU time (ms)
  timestamp: number;            // Metric timestamp (ms)
  snr?: number;                 // Signal-to-noise ratio (dB)
  custom?: Record<string, unknown>;  // Demodulator-specific metrics
}
```

## Performance Characteristics

### CPU Budget

Based on `docs/reference/multi-vfo-architecture.md`:

| VFOs | Strategy | Est. Time (2048 samples @ 2 MS/s) |
|------|----------|-----------------------------------|
| 1    | Per-VFO  | ~0.3-0.8 ms (mode-dependent)      |
| 2    | Per-VFO  | ~0.6-1.6 ms                       |
| 3    | PFB      | ~1.4 ms (0.5 ms PFB + 3×0.3 ms)   |
| 4    | PFB      | ~1.7 ms                           |
| 8    | PFB      | ~2.9 ms                           |

**Target:** <70% CPU for responsive UI (60 FPS @ 16.67 ms/frame)

### Memory Usage

- **Per-VFO base:** ~400 KB (demodulator + audio buffers)
- **Temp buffers:** ~32 KB per VFO for processing
- **Total estimate:** 50 MB + (numVFOs × 0.4 MB)

## Testing

### Test Coverage

21 comprehensive tests covering:

1. **Initialization:** Default and custom configuration
2. **VFO Management:** Add, remove, update, clear
3. **Single VFO:** Tone extraction, audio routing
4. **Multi-Tone Separation:** Distinct signal extraction, RSSI differentiation
5. **Strategy Selection:** Per-VFO vs PFB verification
6. **Power Metrics:** RSSI accuracy, processing time tracking
7. **Audio Mixing:** Multi-stream mixing with normalization
8. **Edge Cases:** Empty samples, missing demodulators
9. **Resource Management:** Cleanup and disposal

### Synthetic Test Signals

Tests use `generateTone()` and `mixTones()` to create controlled multi-tone signals:

```typescript
// Generate three tones at different frequencies and amplitudes
const tone1 = generateTone(-300_000, sampleRate, 8192, 0.8);
const tone2 = generateTone(0, sampleRate, 8192, 0.5);
const tone3 = generateTone(300_000, sampleRate, 8192, 0.3);
const mixed = mixTones([tone1, tone2, tone3]);

// Extract each tone to its own VFO
const results = await processor.processSamples(mixed, [vfo1, vfo2, vfo3]);

// Validate: VFO1 (strongest) should have highest RSSI
expect(results.get("vfo-1")?.metrics.rssi).toBeGreaterThan(
  results.get("vfo-2")?.metrics.rssi
);
```

## Integration Points

### VFO Store Integration

```typescript
import { useStore } from "@/store";

const vfos = useStore((state) => state.getAllVfos());
const activeVfos = useStore((state) => state.getActiveVfos());

// Add VFOs to processor
for (const vfo of vfos) {
  processor.addVfo(vfo);
}

// Update VFO metrics after processing
for (const [vfoId, result] of results) {
  useStore.getState().updateVfoState(vfoId, {
    metrics: result.metrics,
  });
}
```

### Demodulator Plugin Integration

Each VFO requires a `DemodulatorPlugin` instance:

```typescript
import type { DemodulatorPlugin } from "@/types/plugin";

const demodulator: DemodulatorPlugin = {
  // Plugin interface implementation
  demodulate(samples: IQSample[]): Float32Array {
    // Convert IQ to audio
  },
  // ... other methods
};

const vfo: VfoState = {
  // ... config
  demodulator,
  // ... state
};
```

### Audio Output Integration

```typescript
// Web Audio API integration
const audioContext = new AudioContext();
const sourceNode = audioContext.createBufferSource();

// Convert VfoAudioBuffer to AudioBuffer
const audioBuffer = audioContext.createBuffer(
  1,  // mono
  result.audio.audio.length,
  result.audio.sampleRate
);
audioBuffer.copyToChannel(result.audio.audio, 0);

sourceNode.buffer = audioBuffer;
sourceNode.connect(audioContext.destination);
sourceNode.start();
```

## Future Enhancements

1. **Multiple Audio Streams:** Increase `maxConcurrentAudio` > 1
   - Implement stereo panning per VFO
   - Add per-VFO volume controls
   - Soft limiter to prevent clipping

2. **Adaptive Strategy Threshold:** Dynamic `pfbThreshold` based on CPU load
   - Monitor processing time
   - Adjust strategy when >70% CPU budget used

3. **Better Filters:** Replace moving average with windowed-sinc FIR
   - Higher quality anti-aliasing
   - Sharper transition bands
   - Lower inter-channel crosstalk

4. **SIMD Optimization:** Leverage WASM SIMD for 4x parallelism
   - Already implemented for window functions
   - Extend to frequency shift and filtering

5. **GPU Acceleration:** Offload channelization to WebGL/WebGPU
   - FFT via GPU compute shaders
   - Massive parallel filter bank

## References

- **Architecture:** `docs/reference/multi-vfo-architecture.md`
- **VFO Types:** `src/types/vfo.ts`
- **VFO Store:** `src/store/slices/vfoSlice.ts`
- **Reference Implementation:** `src/utils/multiStationFM.ts`
- **PFB Channelizer:** `src/lib/dsp/pfbChannelizer.ts`
- **Demodulator Plugins:** `src/types/plugin.ts`

## Acceptance Criteria ✅

- [x] Multi-mixer routine in AssemblyScript for per-VFO extraction
- [x] FFT/filter plan reuse across VFOs (via PFB channelizer strategy)
- [x] Audio buffers delivered to JS with routing to active audioEnabled VFOs
- [x] Tests with synthetic multiple tones verify separate extraction
- [x] Multiple VFOs produce distinct power metrics (RSSI)
- [x] Build and all tests pass
