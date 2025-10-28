# Visualization Module

The visualization module provides a clean, decoupled architecture for signal visualization in rad.io. It separates data sources, processing, and rendering concerns with well-defined interfaces.

## Architecture

### Core Interfaces

#### DataSource

Provides IQ samples to visualizations. Implementations can be:

- Real hardware devices (HackRF, RTL-SDR)
- Simulated sources (for testing/demos)
- Recorded data playback

```typescript
interface DataSource {
  startStreaming(callback: (samples: Sample[]) => void): Promise<void>;
  stopStreaming(): Promise<void>;
  isStreaming(): boolean;
  getMetadata(): DataSourceMetadata;
}
```

#### FrameProcessor

Transforms IQ samples into visualization-specific data (FFT, amplitude extraction, etc.).

```typescript
interface FrameProcessor<TInput, TOutput> {
  process(input: TInput): TOutput;
  getConfig(): FrameProcessorConfig;
  updateConfig(config: Partial<FrameProcessorConfig>): void;
}
```

#### Renderer

Draws visualization data to a canvas using WebGL, WebGPU, or Canvas2D.

```typescript
interface Renderer<TData> {
  initialize(canvas: HTMLCanvasElement): Promise<boolean>;
  render(data: TData): boolean;
  cleanup(): void;
  isReady(): boolean;
  getName(): string;
}
```

## Components

### Visualization Components

Located in `src/visualization/components/`:

- **IQConstellation**: Scatter plot of I/Q samples
- **Spectrogram**: Time-frequency heatmap with power spectral density
- **WaveformVisualizer**: Time-domain amplitude envelope
- **FFTChart**: Frequency spectrum chart

All components support:

- WebGPU rendering (primary)
- WebGL rendering (fallback)
- Canvas2D rendering (final fallback)
- Background rendering control
- Pan/zoom interaction

### SimulatedSource

A data source implementation for testing and demonstrations without hardware.

**Features:**

- Multiple signal patterns: sine wave, QPSK, FM, noise, multi-tone
- Configurable sample rate, amplitude, and update interval
- Proper streaming lifecycle management

**Example Usage:**

```typescript
import { SimulatedSource } from "./visualization";

const source = new SimulatedSource({
  pattern: "sine",
  sampleRate: 2048000,
  amplitude: 0.8,
  updateInterval: 50,
  samplesPerUpdate: 2048,
});

await source.startStreaming((samples) => {
  // Handle new samples
  console.log(`Received ${samples.length} samples`);
});

// Later...
await source.stopStreaming();
```

### ReplaySource

A data source implementation for deterministic playback of recorded IQ data. Perfect for testing, demos, and analyzing captured signals.

**Features:**

- Plays back recorded IQ data with proper timing
- Pause/resume/seek functionality
- Maintains recording metadata
- Deterministic for repeatable tests

**Example Usage:**

```typescript
import { ReplaySource } from "./visualization";
import { loadRecordingFromFile } from "../utils/iqRecorder";

// Load a recording from file
const recording = await loadRecordingFromFile(file);

// Create replay source
const source = new ReplaySource(recording, 32768);

// Start playback
await source.startStreaming((samples) => {
  // Handle samples, same interface as SimulatedSource
  console.log(`Received ${samples.length} samples`);
});

// Playback controls
source.pause();
source.resume();
source.seek(0.5); // Seek to 50% position

// Get metadata
const metadata = source.getMetadata();
console.log(`Sample rate: ${metadata.sampleRate} Hz`);

// Stop when done
await source.stopStreaming();
```

## Demo Page

Visit `/demo` in the application to see all visualizations working with SimulatedSource. The demo includes:

- Interactive signal pattern selection
- Real-time visualization updates
- Metadata display
- Architecture documentation

## Documentation

- **[Quick Reference](../../docs/VISUALIZATION_QUICK_REF.md)** - Quick start and common patterns
- **[Usage Guide](../../docs/VISUALIZATION_USAGE.md)** - Comprehensive usage examples and best practices
- **[README](./README.md)** - Architecture and component overview (this file)

## Testing

The module includes comprehensive tests:

- **SimulatedSource**: 14 tests covering all signal patterns and lifecycle
- **ReplaySource**: 20 tests covering playback, controls, and edge cases
- **FFTProcessor**: 13 tests covering FFT computation, windowing, configuration
- **AGCProcessor**: 21 tests covering gain control, state management
- **SpectrogramProcessor**: 19 tests covering overlap processing, buffering
- **Component Tests**: Existing tests maintained for backward compatibility
- **Total**: 1671 tests passing

Run tests:

```bash
npm test src/visualization
```

## Backward Compatibility

Original component locations (`src/components/`) now re-export from the visualization module, maintaining full backward compatibility:

```typescript
// Old way (still works)
import IQConstellation from "./components/IQConstellation";

// New way (preferred)
import { IQConstellation } from "./visualization";
```

## Frame Processors

Frame processors transform IQ samples into visualization-ready data. Three implementations are available:

### FFTProcessor

Transforms IQ samples to frequency domain with windowing.

**Features:**

- Configurable FFT size (power of 2)
- Multiple window functions (Hann, Hamming, Blackman, Kaiser, Rectangular)
- WASM acceleration support
- Frequency bin generation

**Example Usage:**

```typescript
import { FFTProcessor } from "./visualization";

const processor = new FFTProcessor({
  type: "fft",
  fftSize: 2048,
  windowFunction: "hann",
  useWasm: true,
  sampleRate: 2048000,
});

// Process samples
const output = processor.process(samples);
console.log(output.magnitudes); // Float32Array of dB values
console.log(output.frequencies); // Float32Array of frequency bins
```

### AGCProcessor

Automatic gain control for signal normalization.

**Features:**

- Configurable attack and decay rates
- Target level control
- Maximum gain limiting
- Stateful gain tracking with reset

**Example Usage:**

```typescript
import { AGCProcessor } from "./visualization";

const processor = new AGCProcessor({
  type: "agc",
  targetLevel: 0.7,
  attackTime: 0.01,
  decayTime: 0.1,
  maxGain: 10.0,
});

// Process samples
const output = processor.process(samples);
console.log(output.samples); // Gain-adjusted IQ samples
console.log(output.currentGain); // Current gain level
```

### SpectrogramProcessor

Time-frequency representation with sliding window FFT.

**Features:**

- Configurable overlap (hopSize)
- Buffered time slices
- Time and frequency bin generation
- Window function support

**Example Usage:**

```typescript
import { SpectrogramProcessor } from "./visualization";

const processor = new SpectrogramProcessor({
  type: "spectrogram",
  fftSize: 1024,
  hopSize: 512, // 50% overlap
  windowFunction: "hann",
  useWasm: true,
  sampleRate: 2048000,
  maxTimeSlices: 100,
});

// Process samples
const output = processor.process(samples);
console.log(output.data); // 2D array: [time][frequency]
console.log(output.times); // Time bins in seconds
console.log(output.frequencies); // Frequency bins in Hz
```

### Chaining Processors

Processors can be chained together for complex pipelines:

```typescript
import { AGCProcessor, FFTProcessor } from "./visualization";

const agc = new AGCProcessor({
  /* config */
});
const fft = new FFTProcessor({
  /* config */
});

// Chain processors
const agcOutput = agc.process(samples);
const fftOutput = fft.process(agcOutput.samples);
```

## Future Extensions

The clean interface design enables:

- **Custom Data Sources**: Implement `DataSource` for any signal source
- **Custom Processors**: Implement `FrameProcessor` for specialized processing
- **Alternative Renderers**: Implement custom rendering strategies
- **Pipeline Composition**: Chain multiple processors in a visualization pipeline

## Files

```text
src/visualization/
├── interfaces.ts              # Core type definitions
├── SimulatedSource.ts         # Simulated data source for testing
├── ReplaySource.ts            # Recorded data playback source
├── compositions.ts            # NEW: Composition helpers and presets
├── index.ts                   # Module exports
├── components/                # Visualization components
│   ├── IQConstellation.tsx
│   ├── Spectrogram.tsx
│   ├── WaveformVisualizer.tsx
│   ├── FFTChart.tsx
│   ├── Spectrum.tsx
│   └── Waterfall.tsx
├── processors/                # Frame processors
│   ├── FFTProcessor.ts
│   ├── AGCProcessor.ts
│   ├── SpectrogramProcessor.ts
│   ├── index.ts
│   └── __tests__/
│       ├── FFTProcessor.test.ts
│       ├── AGCProcessor.test.ts
│       └── SpectrogramProcessor.test.ts
├── renderers/                 # Rendering backends
│   ├── WebGLSpectrum.ts
│   ├── WebGLWaterfall.ts
│   ├── CanvasSpectrum.ts
│   └── CanvasWaterfall.ts
└── __tests__/                 # Test files
    ├── SimulatedSource.test.ts
    ├── ReplaySource.test.ts
    └── compositions.test.ts   # NEW: Composition helper tests
```

## Composition Helpers (NEW)

The module now includes composition helpers that make it easier to create complete visualization pipelines:

### Quick Setup

```typescript
import {
  createVisualizationSetup,
  VisualizationPresets,
} from "./visualization";

// Create a complete FM receiver setup
const setup = createVisualizationSetup({
  preset: "FMBroadcast",
  pattern: "fm",
  enableFFT: true,
  enableAGC: true,
});

// Start streaming
await setup.source.startStreaming((samples) => {
  if (setup.agcProcessor) {
    const normalized = setup.agcProcessor.process(samples);
    samples = normalized.samples;
  }

  if (setup.fftProcessor) {
    const spectrum = setup.fftProcessor.process(samples);
    // Update visualization with spectrum.magnitudes
  }
});

// Cleanup when done
await setup.cleanup();
```

### Configuration Presets

Five presets for common SDR use cases:

- **FMBroadcast** - FM radio (88-108 MHz), 2.048 MHz, 2048 FFT
- **AMBroadcast** - AM radio (530-1700 kHz), 1.024 MHz, 1024 FFT
- **WidebandScanner** - Wide spectrum coverage, 20 MHz, 4096 FFT
- **NarrowbandAnalysis** - High resolution weak signals, 256 kHz, 4096 FFT
- **RealtimeMonitoring** - Balanced general monitoring, 2.048 MHz, 1024 FFT

### Factory Functions

```typescript
// Create processors with sensible defaults
const fft = createFFTPipeline({ fftSize: 2048, sampleRate: 2048000 });
const agc = createAGCPipeline({ targetLevel: 0.7 });
const spec = createSpectrogramPipeline({ fftSize: 1024, hopSize: 512 });
const source = createSimulatedSource({ pattern: "fm", sampleRate: 2048000 });

// Chain processors (cast once for type compatibility)
type ProcessorLike = { process: (input: unknown) => unknown };
const process = chainProcessors([agc as ProcessorLike, fft as ProcessorLike]);
```

See [Usage Guide](../../docs/VISUALIZATION_USAGE.md) for more examples.
