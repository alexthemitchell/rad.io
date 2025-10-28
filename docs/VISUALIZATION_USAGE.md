# Modular Visualization Components - Usage Guide

This guide demonstrates how to use rad.io's modular SDR visualization components in your browser-based SDR applications.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Component Overview](#component-overview)
3. [Configuration Presets](#configuration-presets)
4. [Composition Helpers](#composition-helpers)
5. [Advanced Patterns](#advanced-patterns)
6. [Best Practices](#best-practices)

## Quick Start

### Basic Component Usage

```typescript
import { Spectrum, Waterfall, IQConstellation } from "@/visualization";

// Display a spectrum analyzer
<Spectrum
  magnitudes={fftData}
  freqMin={0}
  freqMax={1024}
  width={900}
  height={400}
/>

// Display a waterfall plot
<Waterfall
  frames={spectrogramFrames}
  freqMin={0}
  freqMax={1024}
  width={900}
  height={600}
/>

// Display IQ constellation diagram
<IQConstellation
  samples={iqSamples}
  width={750}
  height={400}
/>
```

### Using Composition Helpers

```typescript
import {
  createVisualizationSetup,
  VisualizationPresets,
} from "@/visualization";

// Create a complete FM receiver pipeline
const setup = createVisualizationSetup({
  preset: "FMBroadcast",
  pattern: "fm",
  enableFFT: true,
  enableAGC: true,
});

// Start streaming
await setup.source.startStreaming((samples) => {
  // Optional: Apply AGC
  if (setup.agcProcessor) {
    const normalized = setup.agcProcessor.process(samples);
    samples = normalized.samples;
  }

  // Process FFT
  if (setup.fftProcessor) {
    const spectrum = setup.fftProcessor.process(samples);
    // Update your visualization with spectrum.magnitudes
  }
});

// Cleanup when done
await setup.cleanup();
```

## Component Overview

### Available Components

| Component              | Purpose                              | Key Props                                  |
| ---------------------- | ------------------------------------ | ------------------------------------------ |
| **Spectrum**           | Real-time frequency spectrum display | `magnitudes`, `freqMin`, `freqMax`         |
| **Waterfall**          | Time-frequency heatmap               | `frames`, `freqMin`, `freqMax`             |
| **IQConstellation**    | Scatter plot of I/Q samples          | `samples`                                  |
| **Spectrogram**        | STFT time-frequency visualization    | `samples`, `sampleRate`                    |
| **WaveformVisualizer** | Time-domain amplitude display        | `samples`                                  |
| **FFTChart**           | Frequency chart with annotations     | `magnitudes`, `frequencies`                |
| **SpectrumExplorer**   | Interactive spectrum analyzer        | `samples`, `sampleRate`, `centerFrequency` |

### Component Features

All components support:

- **WebGL rendering** (primary, GPU-accelerated)
- **Canvas2D fallback** (automatic, CPU-based)
- **High-DPI displays** (automatic scaling)
- **Responsive sizing** (width/height props)
- **Accessibility** (ARIA labels, keyboard support)

## Configuration Presets

### FMBroadcast

Optimized for FM radio reception (88-108 MHz):

```typescript
import { VisualizationPresets, createFFTPipeline } from "@/visualization";

const fft = createFFTPipeline({
  fftSize: VisualizationPresets.FMBroadcast.fftSize, // 2048
  sampleRate: VisualizationPresets.FMBroadcast.sampleRate, // 2.048 MHz
  windowFunction: "hann",
});
```

**Use case:** Broadcast FM radio with stereo separation

### AMBroadcast

Optimized for AM radio reception (530-1700 kHz):

```typescript
const setup = createVisualizationSetup({
  preset: "AMBroadcast",
  pattern: "sine",
  enableFFT: true,
});
```

**Use case:** Longwave and mediumwave AM broadcasting

### WidebandScanner

High sample rate for wide spectrum coverage:

```typescript
const preset = VisualizationPresets.WidebandScanner;
// Sample rate: 20 MHz
// FFT size: 4096
// Window: Blackman (better sidelobe suppression)
```

**Use case:** Scanning large frequency ranges, finding unknown signals

### NarrowbandAnalysis

High resolution for weak signal detection:

```typescript
const preset = VisualizationPresets.NarrowbandAnalysis;
// Sample rate: 256 kHz
// FFT size: 4096 (high resolution)
// Window: Blackman
```

**Use case:** Weak signal detection, satellite communications, APRS

### RealtimeMonitoring

Balanced configuration for live monitoring:

```typescript
const preset = VisualizationPresets.RealtimeMonitoring;
// Sample rate: 2.048 MHz
// FFT size: 1024
// Window: Hann
```

**Use case:** General-purpose SDR monitoring, fast update rates

## Composition Helpers

### createFFTPipeline

Factory for FFT processors with sensible defaults:

```typescript
import { createFFTPipeline } from "@/visualization";

// With defaults
const fft = createFFTPipeline();

// Custom configuration
const fft = createFFTPipeline({
  fftSize: 2048,
  windowFunction: "blackman",
  useWasm: true,
  sampleRate: 2048000,
});

// Usage
const output = fft.process(samples);
console.log(output.magnitudes); // dB values
console.log(output.frequencies); // Frequency bins
```

### createAGCPipeline

Factory for automatic gain control:

```typescript
import { createAGCPipeline } from "@/visualization";

const agc = createAGCPipeline({
  targetLevel: 0.7, // Target amplitude
  attackTime: 0.01, // Fast attack (10ms)
  decayTime: 0.1, // Slower decay (100ms)
  maxGain: 10.0, // Maximum gain multiplier
});

// Usage
const output = agc.process(samples);
console.log(output.samples); // Normalized IQ samples
console.log(output.currentGain); // Current gain level
```

### createSpectrogramPipeline

Factory for spectrogram (time-frequency) processing:

```typescript
import { createSpectrogramPipeline } from "@/visualization";

const spectrogram = createSpectrogramPipeline({
  fftSize: 1024,
  hopSize: 512, // 50% overlap
  maxTimeSlices: 100, // Buffer depth
  sampleRate: 2048000,
});

// Usage
const output = spectrogram.process(samples);
console.log(output.data); // 2D array: [time][frequency]
console.log(output.times); // Time bins in seconds
console.log(output.frequencies); // Frequency bins in Hz
```

### createSimulatedSource

Factory for test data generation:

```typescript
import { createSimulatedSource } from "@/visualization";

const source = createSimulatedSource({
  pattern: "fm", // sine, qpsk, fm, noise, multi-tone
  sampleRate: 2048000,
  amplitude: 0.8,
  updateInterval: 50, // ms between updates
  samplesPerUpdate: 2048,
});

// Start streaming
await source.startStreaming((samples) => {
  // Process samples
});

// Stop when done
await source.stopStreaming();
```

### createVisualizationSetup

High-level factory for complete pipelines:

```typescript
import { createVisualizationSetup } from "@/visualization";

const setup = createVisualizationSetup({
  preset: "FMBroadcast",
  pattern: "fm",
  enableAGC: true,
  enableFFT: true,
  enableSpectrogram: true,
});

// Access components
setup.source; // SimulatedSource
setup.fftProcessor; // FFTProcessor (if enabled)
setup.agcProcessor; // AGCProcessor (if enabled)
setup.spectrogramProcessor; // SpectrogramProcessor (if enabled)

// Cleanup
await setup.cleanup();
```

### Processor Chaining

Utility for chaining multiple processors:

```typescript
import {
  chainProcessors,
  createAGCPipeline,
  createFFTPipeline,
} from "@/visualization";

const agc = createAGCPipeline();
const fft = createFFTPipeline();

// Type cast is needed because processors have strongly-typed parameters
// (e.g., AGCProcessor.process expects Sample[]), but chainProcessors uses
// `unknown` for flexibility to work with any processor combination
type ProcessorLike = { process: (input: unknown) => unknown };

// Create a processing chain
const process = chainProcessors([agc as ProcessorLike, fft as ProcessorLike]);

// Process samples through entire chain
const result = process(samples);
// AGC normalizes → FFT processes → result contains spectrum
```

## Advanced Patterns

### Complete FM Receiver

```typescript
import {
  createVisualizationSetup,
  Spectrum,
  Waterfall,
  IQConstellation,
} from "@/visualization";

function FMReceiver() {
  const [magnitudes, setMagnitudes] = useState<Float32Array>(new Float32Array());
  const [frames, setFrames] = useState<Float32Array[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    let mounted = true;

    const setup = createVisualizationSetup({
      preset: "FMBroadcast",
      pattern: "fm",
      enableFFT: true,
      enableAGC: true,
      enableSpectrogram: true,
    });

    setup.source.startStreaming((newSamples) => {
      if (!mounted) return;

      // Apply AGC
      if (setup.agcProcessor) {
        const normalized = setup.agcProcessor.process(newSamples);
        newSamples = normalized.samples;
      }

      // Update constellation
      setSamples(newSamples.slice(-2048));

      // Process FFT
      if (setup.fftProcessor) {
        const spectrum = setup.fftProcessor.process(newSamples);
        setMagnitudes(spectrum.magnitudes);
      }

      // Process spectrogram
      if (setup.spectrogramProcessor) {
        const spec = setup.spectrogramProcessor.process(newSamples);
        setFrames(spec.data);
      }
    });

    return () => {
      mounted = false;
      setup.cleanup();
    };
  }, []);

  return (
    <div>
      <h2>FM Receiver</h2>

      <Spectrum
        magnitudes={magnitudes}
        freqMin={0}
        freqMax={1024}
        width={900}
        height={300}
      />

      <Waterfall
        frames={frames}
        freqMin={0}
        freqMax={1024}
        width={900}
        height={500}
      />

      <IQConstellation
        samples={samples}
        width={400}
        height={400}
      />
    </div>
  );
}
```

### Signal Scanner

```typescript
import {
  createVisualizationSetup,
  SpectrumExplorer,
} from "@/visualization";

function SignalScanner() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [detectedSignals, setDetectedSignals] = useState<Array<{
    freqHz: number;
    strength: number;
    label: string;
  }>>([]);

  useEffect(() => {
    const setup = createVisualizationSetup({
      preset: "WidebandScanner",
      pattern: "multi-tone",
      enableFFT: true,
    });

    setup.source.startStreaming((newSamples) => {
      setSamples(prev => {
        const combined = prev.concat(newSamples);
        return combined.length > 8192 ? combined.slice(-8192) : combined;
      });

      // Detect signals above threshold
      if (setup.fftProcessor) {
        const spectrum = setup.fftProcessor.process(newSamples);
        const threshold = -80; // dB

        const signals = [];
        for (let i = 0; i < spectrum.magnitudes.length; i++) {
          if (spectrum.magnitudes[i] > threshold) {
            signals.push({
              freqHz: spectrum.frequencies[i],
              strength: (spectrum.magnitudes[i] - threshold) / 40,
              label: `${(spectrum.frequencies[i] / 1e6).toFixed(3)} MHz`,
            });
          }
        }
        setDetectedSignals(signals);
      }
    });

    return () => {
      setup.cleanup();
    };
  }, []);

  return (
    <SpectrumExplorer
      samples={samples}
      sampleRate={20000000}
      centerFrequency={100000000}
      fftSize={4096}
      signals={detectedSignals}
      onTune={(freq) => console.log("Tune to", freq)}
    />
  );
}
```

### Custom Data Source Integration

```typescript
import type { DataSource, Sample } from "@/visualization";

class HardwareSDRSource implements DataSource {
  private device: USBDevice | null = null;
  private streaming = false;

  async startStreaming(callback: (samples: Sample[]) => void): Promise<void> {
    this.streaming = true;
    // Connect to hardware device
    // Start reading data
    // Call callback with new samples
  }

  async stopStreaming(): Promise<void> {
    this.streaming = false;
    // Stop device
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  getMetadata() {
    return {
      name: "HackRF One",
      sampleRate: 20000000,
      centerFrequency: 100000000,
      bandwidth: 20000000,
      format: "IQ" as const,
    };
  }
}

// Use with any visualization component
const source = new HardwareSDRSource();
await source.startStreaming((samples) => {
  // Feed to visualization
});
```

### Custom Renderer

```typescript
import type { Renderer, SpectrumData } from "@/visualization";

class CustomSpectrumRenderer implements Renderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    return this.ctx !== null;
  }

  render(data: unknown): boolean {
    const specData = data as SpectrumData;
    if (!this.ctx || !this.canvas) return false;

    // Custom rendering logic
    // Draw spectrum with your own style

    return true;
  }

  cleanup(): void {
    this.canvas = null;
    this.ctx = null;
  }

  isReady(): boolean {
    return this.ctx !== null;
  }
}

// Use custom renderer
const renderer = new CustomSpectrumRenderer();
await renderer.initialize(canvasElement);
renderer.render({ magnitudes, freqMin, freqMax });
```

## Best Practices

### 1. Use Presets for Common Scenarios

```typescript
// ✅ Good - Use preset
const setup = createVisualizationSetup({
  preset: "FMBroadcast",
  enableFFT: true,
});

// ❌ Avoid - Manual configuration for common cases
const fft = new FFTProcessor({
  type: "fft",
  fftSize: 2048,
  windowFunction: "hann",
  sampleRate: 2048000,
  useWasm: true,
});
```

### 2. Clean Up Resources

```typescript
// ✅ Good - Always cleanup
useEffect(() => {
  const setup = createVisualizationSetup({
    /* ... */
  });

  return () => {
    setup.cleanup();
  };
}, []);

// ❌ Avoid - Memory leaks
useEffect(() => {
  const setup = createVisualizationSetup({
    /* ... */
  });
  // Missing cleanup!
}, []);
```

### 3. Use Composition for Complex Pipelines

```typescript
// ✅ Good - Compose with helpers
const setup = createVisualizationSetup({
  preset: "NarrowbandAnalysis",
  enableAGC: true,
  enableFFT: true,
});

// ❌ Avoid - Manual orchestration
const source = new SimulatedSource({
  /* ... */
});
const agc = new AGCProcessor({
  /* ... */
});
const fft = new FFTProcessor({
  /* ... */
});
// ... manual wiring
```

### 4. Type Safety

```typescript
// ✅ Good - Use exported prop types
import type { SpectrumProps } from "@/visualization";

const config: SpectrumProps = {
  magnitudes: new Float32Array(1024),
  freqMin: 0,
  freqMax: 1024,
  width: 900,
  height: 400,
};

<Spectrum {...config} />
```

### 5. Performance Optimization

```typescript
// ✅ Good - Limit sample buffer size
setSamples((prev) => [...prev, ...newSamples].slice(-2048));

// ❌ Avoid - Unbounded growth
setSamples((prev) => [...prev, ...newSamples]);
```

### 6. Error Handling

```typescript
// ✅ Good - Handle errors gracefully
try {
  await setup.source.startStreaming(callback);
} catch (error) {
  console.error("Failed to start streaming:", error);
  // Fallback or notify user
}

// ❌ Avoid - Unhandled errors
await setup.source.startStreaming(callback);
```

## TypeScript Support

All components, processors, and helpers are fully typed:

```typescript
import type {
  // Component props
  SpectrumProps,
  WaterfallProps,
  IQConstellationProps,
  SpectrogramProps,
  WaveformVisualizerProps,
  FFTChartProps,
  SpectrumExplorerProps,

  // Core interfaces
  DataSource,
  FrameProcessor,
  Renderer,

  // Processor types
  FFTProcessorConfig,
  AGCProcessorConfig,
  SpectrogramProcessorConfig,

  // Data types
  Sample,
  SpectrumData,
  WaterfallData,
} from "@/visualization";
```

## Browser Compatibility

- **Modern browsers** (Chrome, Firefox, Safari, Edge)
- **WebGL support** required for GPU acceleration
- **Canvas2D fallback** for older browsers
- **TypeScript 5.0+** for development

## Performance Metrics

| Operation                      | WebGL | Canvas2D |
| ------------------------------ | ----- | -------- |
| Spectrum (1024 bins)           | ~1ms  | ~3ms     |
| Waterfall (1024x100)           | ~2ms  | ~15ms    |
| IQ Constellation (2048 points) | ~2ms  | ~8ms     |
| FFT (2048 samples)             | ~3ms  | ~3ms     |

## Next Steps

- Explore the [API Reference](./API.md) for detailed documentation (coming soon)
- Check out [Examples](../examples/) for complete applications
- Review [Performance Tips](./PERFORMANCE.md) for optimization (coming soon)
- See [Testing Guide](./TESTING.md) for unit and integration tests (coming soon)

## Support

- **Issues**: https://github.com/alexthemitchell/rad.io/issues
- **Discussions**: https://github.com/alexthemitchell/rad.io/discussions
- **Documentation**: https://github.com/alexthemitchell/rad.io/tree/main/docs

## License

UNLICENSED - Private use only
