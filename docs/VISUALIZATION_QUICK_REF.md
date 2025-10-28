# Visualization Components - Quick Reference

Quick reference for rad.io's modular SDR visualization components.

## Installation

```typescript
import {
  // Components
  Spectrum,
  Waterfall,
  IQConstellation,
  Spectrogram,
  WaveformVisualizer,
  FFTChart,
  SpectrumExplorer,
  
  // Composition Helpers
  createVisualizationSetup,
  createFFTPipeline,
  createAGCPipeline,
  createSpectrogramPipeline,
  createSimulatedSource,
  chainProcessors,
  
  // Presets
  VisualizationPresets,
  
  // Types
  type SpectrumProps,
  type WaterfallProps,
  type IQConstellationProps,
} from "@/visualization";
```

## Basic Usage

### Spectrum Analyzer

```typescript
<Spectrum 
  magnitudes={fftMagnitudes}  // Float32Array of dB values
  freqMin={0}                 // Min frequency bin
  freqMax={1024}              // Max frequency bin
  width={900}                 // Canvas width
  height={400}                // Canvas height
/>
```

### Waterfall Plot

```typescript
<Waterfall 
  frames={spectrogramFrames}  // Array of Float32Array (magnitude frames)
  freqMin={0}
  freqMax={1024}
  width={900}
  height={600}
/>
```

### IQ Constellation

```typescript
<IQConstellation 
  samples={iqSamples}         // Array of {I, Q} samples
  width={750}
  height={400}
/>
```

## Quick Setup

### FM Receiver (Simulated)

```typescript
const setup = createVisualizationSetup({
  preset: "FMBroadcast",
  pattern: "fm",
  enableFFT: true,
});

await setup.source.startStreaming((samples) => {
  const spectrum = setup.fftProcessor.process(samples);
  setMagnitudes(spectrum.magnitudes);
});

// Cleanup
await setup.cleanup();
```

### AM Receiver (Simulated)

```typescript
const setup = createVisualizationSetup({
  preset: "AMBroadcast",
  pattern: "sine",
  enableFFT: true,
  enableAGC: true,
});
```

### Wideband Scanner

```typescript
const setup = createVisualizationSetup({
  preset: "WidebandScanner",
  pattern: "multi-tone",
  enableFFT: true,
});
```

## Presets

| Preset | Sample Rate | FFT Size | Window | Use Case |
|--------|-------------|----------|--------|----------|
| `FMBroadcast` | 2.048 MHz | 2048 | Hann | FM radio (88-108 MHz) |
| `AMBroadcast` | 1.024 MHz | 1024 | Hann | AM radio (530-1700 kHz) |
| `WidebandScanner` | 20 MHz | 4096 | Blackman | Wide spectrum scanning |
| `NarrowbandAnalysis` | 256 kHz | 4096 | Blackman | Weak signal detection |
| `RealtimeMonitoring` | 2.048 MHz | 1024 | Hann | General monitoring |

## Factory Functions

### FFT Processor

```typescript
const fft = createFFTPipeline({
  fftSize: 2048,
  windowFunction: "hann",
  sampleRate: 2048000,
});

const output = fft.process(samples);
// output.magnitudes: Float32Array (dB)
// output.frequencies: Float32Array (Hz)
```

### AGC Processor

```typescript
const agc = createAGCPipeline({
  targetLevel: 0.7,
  attackTime: 0.01,
  decayTime: 0.1,
});

const output = agc.process(samples);
// output.samples: normalized samples
// output.currentGain: current gain value
```

### Spectrogram Processor

```typescript
const spec = createSpectrogramPipeline({
  fftSize: 1024,
  hopSize: 512,  // 50% overlap
  maxTimeSlices: 100,
});

const output = spec.process(samples);
// output.data: Float32Array[] (2D array)
// output.times: Float32Array (time bins)
// output.frequencies: Float32Array (freq bins)
```

### Simulated Data Source

```typescript
const source = createSimulatedSource({
  pattern: "fm",      // sine, qpsk, fm, noise, multi-tone
  sampleRate: 2048000,
  amplitude: 0.8,
});

await source.startStreaming((samples) => {
  // Process samples
});
```

## Processor Chaining

```typescript
const agc = createAGCPipeline();
const fft = createFFTPipeline();

// Cast once for type compatibility
type ProcessorLike = { process: (input: unknown) => unknown };

const process = chainProcessors([
  agc as ProcessorLike,
  fft as ProcessorLike
]);

const result = process(samples);
```

## Window Functions

Available window functions for FFT:

- `"hann"` - Hann window (default, good general purpose)
- `"hamming"` - Hamming window
- `"blackman"` - Blackman window (better sidelobe suppression)
- `"kaiser"` - Kaiser window (adjustable)
- `"rectangular"` - Rectangular window (no windowing)

## Common Patterns

### React Hook for Visualization

```typescript
function useSDRVisualization(preset: keyof typeof VisualizationPresets) {
  const [magnitudes, setMagnitudes] = useState<Float32Array>(new Float32Array());
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    const setup = createVisualizationSetup({
      preset,
      pattern: "sine",
      enableFFT: true,
    });

    setup.source.startStreaming((newSamples) => {
      setSamples(newSamples.slice(-2048));
      
      if (setup.fftProcessor) {
        const spectrum = setup.fftProcessor.process(newSamples);
        setMagnitudes(spectrum.magnitudes);
      }
    });

    return () => {
      setup.cleanup();
    };
  }, [preset]);

  return { magnitudes, samples };
}

// Usage
function MyComponent() {
  const { magnitudes, samples } = useSDRVisualization("FMBroadcast");
  
  return (
    <>
      <Spectrum magnitudes={magnitudes} />
      <IQConstellation samples={samples} />
    </>
  );
}
```

### Processing Pipeline

```typescript
// Normalize → FFT → Display
const agc = createAGCPipeline();
const fft = createFFTPipeline();

source.startStreaming((samples) => {
  // 1. Normalize amplitude
  const normalized = agc.process(samples);
  
  // 2. Compute spectrum
  const spectrum = fft.process(normalized.samples);
  
  // 3. Display
  setMagnitudes(spectrum.magnitudes);
});
```

## TypeScript Types

```typescript
// Sample format
interface Sample {
  I: number;  // In-phase component
  Q: number;  // Quadrature component
}

// FFT output
interface FFTOutput {
  magnitudes: Float32Array;  // Power in dB
  frequencies: Float32Array; // Frequency bins in Hz
}

// AGC output
interface AGCOutput {
  samples: Sample[];         // Normalized samples
  currentGain: number;       // Current gain value
}

// Spectrogram output
interface SpectrogramOutput {
  data: Float32Array[];      // 2D array [time][freq]
  times: Float32Array;       // Time bins in seconds
  frequencies: Float32Array; // Frequency bins in Hz
}
```

## Performance Tips

1. **Limit buffer size**: `samples.slice(-2048)` to keep only recent data
2. **Use WASM**: Enabled by default in factories for FFT operations
3. **Choose appropriate FFT size**: Smaller = faster, larger = more resolution
4. **Reduce update rate**: Use `updateInterval` to control callback frequency
5. **WebGL rendering**: Automatically used when available for GPU acceleration

## Error Handling

```typescript
try {
  await setup.source.startStreaming(callback);
} catch (error) {
  console.error("Streaming failed:", error);
  // Handle error
}

// Always cleanup
finally {
  await setup.cleanup();
}
```

## Browser Support

- ✅ Chrome/Edge (WebGL, full support)
- ✅ Firefox (WebGL, full support)
- ✅ Safari (WebGL, full support)
- ⚠️  Older browsers (Canvas2D fallback)

## Links

- [Full Documentation](./VISUALIZATION_USAGE.md)
- [API Reference](./API.md)
- [Examples](../examples/)
- [GitHub](https://github.com/alexthemitchell/rad.io)
