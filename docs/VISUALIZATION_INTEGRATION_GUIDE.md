# Visualization Architecture Integration Guide

## Overview

This guide explains how to integrate with the rad.io visualization architecture, which provides a clean separation between data sources, processing pipelines, and rendering.

## Architecture Layers

The visualization system consists of four distinct layers:

```
┌─────────────────────────────────────────────────────────┐
│                   UI Components                         │
│  (React components that display visualizations)         │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              Visualization Components                   │
│  (IQConstellation, Spectrogram, WaveformVisualizer)     │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│               Frame Processors                          │
│  (FFT, AGC, Spectrogram with windowing/scaling)         │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                  Data Sources                           │
│  (HackRF, MockSDR, SimulatedSource, ReplaySource)       │
└─────────────────────────────────────────────────────────┘
```

## Core Interfaces

### DataSource

Provides IQ samples from hardware, simulations, or recordings.

```typescript
interface DataSource {
  startStreaming(callback: (samples: Sample[]) => void): Promise<void>;
  stopStreaming(): Promise<void>;
  isStreaming(): boolean;
  getMetadata(): DataSourceMetadata;
}
```

**Available Implementations:**
- `SimulatedSource` - Synthetic signals for testing/demos
- `ReplaySource` - Recorded IQ data playback
- `HackRFOne` - Real hardware via WebUSB
- `MockSDRDevice` - E2E testing without hardware

### FrameProcessor

Transforms IQ samples into visualization-ready data.

```typescript
interface FrameProcessor<TInput, TOutput> {
  process(input: TInput): TOutput;
  getConfig(): FrameProcessorConfig;
  updateConfig(config: Partial<FrameProcessorConfig>): void;
}
```

**Available Implementations:**
- `FFTProcessor` - Frequency domain transformation
- `AGCProcessor` - Automatic gain control
- `SpectrogramProcessor` - Time-frequency representation

### Renderer

Draws visualization data to canvas.

```typescript
interface Renderer {
  initialize(canvas: HTMLCanvasElement): Promise<boolean>;
  render(data: unknown): boolean;
  cleanup(): void;
  isReady(): boolean;
}
```

**Available Implementations:**
- `WebGLSpectrum` / `WebGLWaterfall` - GPU-accelerated rendering
- `CanvasSpectrum` / `CanvasWaterfall` - CPU fallback rendering

## Integration Patterns

### Pattern 1: Simple Data Source → Visualization

For basic visualization without complex processing:

```typescript
import { SimulatedSource, IQConstellation } from './visualization';

function MyComponent() {
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    const source = new SimulatedSource({
      pattern: 'sine',
      sampleRate: 2048000,
      amplitude: 0.8,
      updateInterval: 50,
      samplesPerUpdate: 2048,
    });

    void source.startStreaming((newSamples) => {
      setSamples(newSamples);
    });

    return () => {
      void source.stopStreaming();
    };
  }, []);

  return <IQConstellation samples={samples} width={750} height={400} />;
}
```

### Pattern 2: Data Source → Processor → Visualization

For visualizations that need processing:

```typescript
import { SimulatedSource, FFTProcessor, Spectrum } from './visualization';
import type { Sample } from './utils/dsp';

function SpectrumDisplay() {
  const [fftData, setFFTData] = useState<Float32Array>(new Float32Array(1024));
  
  const processorRef = useRef(new FFTProcessor({
    type: 'fft',
    fftSize: 1024,
    windowFunction: 'hann',
    useWasm: true,
    sampleRate: 2048000,
  }));

  useEffect(() => {
    const source = new SimulatedSource({
      pattern: 'multi-tone',
      sampleRate: 2048000,
    });

    void source.startStreaming((samples: Sample[]) => {
      // Process samples through FFT
      const output = processorRef.current.process(samples);
      setFFTData(output.magnitudes);
    });

    return () => {
      void source.stopStreaming();
    };
  }, []);

  return <Spectrum magnitudes={fftData} width={750} height={400} />;
}
```

### Pattern 3: Custom Processor Pipeline

For complex processing chains:

```typescript
import { 
  SimulatedSource, 
  AGCProcessor, 
  FFTProcessor,
  type Sample 
} from './visualization';

function AdvancedProcessor() {
  const [processedData, setProcessedData] = useState<Float32Array>();

  const agcRef = useRef(new AGCProcessor({
    type: 'agc',
    targetLevel: 0.7,
    attackTime: 0.01,
    decayTime: 0.1,
    maxGain: 10.0,
  }));

  const fftRef = useRef(new FFTProcessor({
    type: 'fft',
    fftSize: 2048,
    windowFunction: 'blackman',
    useWasm: true,
    sampleRate: 2048000,
  }));

  useEffect(() => {
    const source = new SimulatedSource({ 
      pattern: 'fm',
      sampleRate: 2048000 
    });

    void source.startStreaming((samples: Sample[]) => {
      // Chain processors
      const agcOutput = agcRef.current.process(samples);
      const fftOutput = fftRef.current.process(agcOutput.samples);
      setProcessedData(fftOutput.magnitudes);
    });

    return () => {
      void source.stopStreaming();
    };
  }, []);

  return <Spectrum magnitudes={processedData} />;
}
```

### Pattern 4: Hardware Integration

For real SDR hardware:

```typescript
import { useHackRFDevice } from './hooks/useHackRFDevice';
import { FFTProcessor, Spectrum } from './visualization';

function HardwareSpectrum() {
  const { device } = useHackRFDevice();
  const [fftData, setFFTData] = useState<Float32Array>();

  const processorRef = useRef(new FFTProcessor({
    type: 'fft',
    fftSize: 2048,
    windowFunction: 'hann',
    useWasm: true,
    sampleRate: 20_000_000,
  }));

  useEffect(() => {
    if (!device) return;

    // Configure device
    void (async () => {
      await device.setFrequency(100e6);
      await device.setSampleRate(20_000_000);
      
      await device.receive((samples) => {
        const output = processorRef.current.process(samples);
        setFFTData(output.magnitudes);
      });
    })();

    return () => {
      void device.stopRx();
    };
  }, [device]);

  return <Spectrum magnitudes={fftData} />;
}
```

## Creating Custom Processors

### Step 1: Define Configuration and Output Types

```typescript
import type { FrameProcessor, FrameProcessorConfig } from '../interfaces';
import type { Sample } from '../../utils/dsp';

export interface MyProcessorConfig extends FrameProcessorConfig {
  type: 'my-processor';
  // Your custom config parameters
  parameter1: number;
  parameter2: string;
}

export interface MyProcessorOutput {
  // Your output data structure
  data: Float32Array;
  metadata: { /* ... */ };
}
```

### Step 2: Implement the Processor

```typescript
export class MyProcessor implements FrameProcessor<Sample[], MyProcessorOutput> {
  private config: MyProcessorConfig;

  constructor(config: MyProcessorConfig) {
    this.validateConfig(config);
    this.config = { ...config };
  }

  process(samples: Sample[]): MyProcessorOutput {
    // Your processing logic here
    const data = new Float32Array(samples.length);
    
    for (let i = 0; i < samples.length; i++) {
      // Process each sample
      data[i] = /* your calculation */;
    }

    return {
      data,
      metadata: { /* ... */ },
    };
  }

  getConfig(): MyProcessorConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<MyProcessorConfig>): void {
    const newConfig = { ...this.config, ...config };
    this.validateConfig(newConfig);
    this.config = newConfig;
  }

  private validateConfig(config: MyProcessorConfig): void {
    // Validation logic
    if (config.parameter1 <= 0) {
      throw new Error('parameter1 must be positive');
    }
  }
}
```

### Step 3: Add Tests

```typescript
import { MyProcessor } from '../MyProcessor';

describe('MyProcessor', () => {
  it('should process samples correctly', () => {
    const processor = new MyProcessor({
      type: 'my-processor',
      parameter1: 42,
      parameter2: 'test',
    });

    const samples = [{ I: 1, Q: 0 }, { I: 0, Q: 1 }];
    const output = processor.process(samples);

    expect(output.data).toHaveLength(samples.length);
  });
});
```

## Best Practices

### 1. Processor State Management

Processors should be **stateless** whenever possible. If state is required:

- Store it in private instance variables
- Provide a `reset()` method to clear state
- Document state behavior clearly

```typescript
class StatefulProcessor implements FrameProcessor<Sample[], Output> {
  private state: number = 0;

  process(samples: Sample[]): Output {
    // Use and update state
    this.state += samples.length;
    return { /* ... */ };
  }

  reset(): void {
    this.state = 0;
  }
}
```

### 2. Configuration Validation

Always validate configuration in the constructor and `updateConfig`:

```typescript
private validateConfig(config: MyConfig): void {
  if (config.fftSize <= 0 || (config.fftSize & (config.fftSize - 1)) !== 0) {
    throw new Error('fftSize must be a positive power of 2');
  }
}
```

### 3. Performance Optimization

- **Reuse TypedArrays** when possible to reduce GC pressure
- **Use WASM** for compute-intensive operations (via `calculateFFTSync` with WASM detection)
- **Avoid allocations** in hot paths (process method called frequently)

```typescript
class OptimizedProcessor implements FrameProcessor<Sample[], Output> {
  private buffer: Float32Array; // Reused buffer

  constructor(config: Config) {
    this.buffer = new Float32Array(config.bufferSize);
  }

  process(samples: Sample[]): Output {
    // Reuse buffer instead of allocating new one
    for (let i = 0; i < samples.length; i++) {
      this.buffer[i] = /* ... */;
    }
    return { data: this.buffer };
  }
}
```

### 4. Error Handling

Handle edge cases gracefully:

```typescript
process(samples: Sample[]): Output {
  if (samples.length === 0) {
    return this.emptyOutput();
  }

  if (samples.length < this.config.minSize) {
    // Pad or handle insufficient data
    return this.processShortInput(samples);
  }

  return this.processNormal(samples);
}
```

### 5. Testing Strategy

Test at multiple levels:

- **Unit tests**: Test processor logic in isolation
- **Integration tests**: Test with real data sources
- **Performance tests**: Measure throughput and memory usage

```typescript
describe('MyProcessor performance', () => {
  it('should process 10k samples in < 10ms', () => {
    const processor = new MyProcessor(config);
    const samples = generateTestSamples(10000);

    const start = performance.now();
    processor.process(samples);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10);
  });
});
```

## Migration from Legacy Code

If you have existing code that processes IQ samples inline:

### Before (Legacy Pattern)

```typescript
function MyComponent() {
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    // Inline processing
    const fft = calculateFFTSync(samples, 1024);
    const windowed = applyWindow(samples, 'hann');
    // ... more processing
  }, [samples]);
}
```

### After (New Pattern)

```typescript
function MyComponent() {
  const [samples, setSamples] = useState<Sample[]>([]);
  
  const processorRef = useRef(new FFTProcessor({
    type: 'fft',
    fftSize: 1024,
    windowFunction: 'hann',
    useWasm: true,
    sampleRate: 2048000,
  }));

  useEffect(() => {
    const output = processorRef.current.process(samples);
    // Use output.magnitudes
  }, [samples]);
}
```

Benefits of the new pattern:
- **Testable**: Processor can be tested independently
- **Reusable**: Same processor used across components
- **Configurable**: Easy to change settings via `updateConfig`
- **Performant**: Processor can optimize internal buffers

## Troubleshooting

### Processor Not Producing Expected Output

1. **Check configuration**: Verify all parameters are correct
2. **Validate input**: Ensure input samples are in expected format
3. **Enable logging**: Add console logs in process method
4. **Compare with legacy**: Test against old implementation

### Performance Issues

1. **Profile hot paths**: Use browser DevTools Performance tab
2. **Check allocations**: Look for unnecessary `new Array()` or `new Float32Array()`
3. **Enable WASM**: Ensure `useWasm: true` when available
4. **Reduce processing rate**: Lower `updateInterval` in data source

### Type Errors

1. **Import types explicitly**: `import type { Sample } from '...'`
2. **Use generic types**: `FrameProcessor<Input, Output>`
3. **Extend base interfaces**: `MyConfig extends FrameProcessorConfig`

## Resources

- **API Reference**: `src/visualization/README.md`
- **Examples**: `src/pages/VisualizationDemo.tsx`
- **Tests**: `src/visualization/processors/__tests__/`
- **Architecture**: `docs/VISUALIZATION_ARCHITECTURE.md`
- **DSP Utilities**: `src/utils/dsp.ts`, `src/utils/dspProcessing.ts`

## Getting Help

- Check existing processor implementations for patterns
- Review test files for usage examples
- See `VISUALIZATION_MODULE_ARCHITECTURE` memory for design decisions
- Ask in project discussions with specific code examples
