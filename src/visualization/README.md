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

## Testing

The module includes comprehensive tests:

- **SimulatedSource**: 14 tests covering all signal patterns and lifecycle
- **ReplaySource**: 20 tests covering playback, controls, and edge cases
- **Component Tests**: Existing tests maintained for backward compatibility

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

## Future Extensions

The clean interface design enables:

- **Custom Data Sources**: Implement `DataSource` for any signal source
- **Advanced Processors**: Add specialized frame processors (demodulation, decoding, etc.)
- **Alternative Renderers**: Implement custom rendering strategies
- **Pipeline Composition**: Chain multiple processors in a visualization pipeline

## Files

```text
src/visualization/
├── interfaces.ts              # Core type definitions
├── SimulatedSource.ts         # Simulated data source for testing
├── ReplaySource.ts            # Recorded data playback source
├── index.ts                   # Module exports
├── components/                # Visualization components
│   ├── IQConstellation.tsx
│   ├── Spectrogram.tsx
│   ├── WaveformVisualizer.tsx
│   └── FFTChart.tsx
└── __tests__/                 # Test files
    ├── SimulatedSource.test.ts
    └── ReplaySource.test.ts
```

## Contributing

When adding new visualizations:

1. Create the component in `src/visualization/components/`
2. Update `src/visualization/index.ts` to export it
3. Add comprehensive tests
4. Update this README with usage examples
