# Visualization Module Architecture

## Purpose
Documents the new visualization module structure established to decouple visualizations from device I/O and improve testability.

## Location
Primary module: `src/visualization/`
- `interfaces.ts`: Core interfaces (DataSource, FrameProcessor, Renderer, VisualizationPipeline)
- `SimulatedSource.ts`: Test data source with multiple signal patterns
- `components/`: Migrated visualization components (IQConstellation, Spectrogram, WaveformVisualizer, FFTChart)
- `README.md`: Detailed documentation

## Key Design Decisions

### 1. Interface-Based Architecture
Three core interfaces establish separation of concerns:
- **DataSource**: Provides IQ samples (hardware, simulated, or recorded data)
- **FrameProcessor**: Transforms samples to visualization data (FFT, amplitude, etc.)
- **Renderer**: Draws to canvas (WebGL/WebGPU/Canvas2D)

### 2. Component Migration
All visualization components moved to `src/visualization/components/` with:
- Updated import paths (../../ for nested modules)
- Backward-compatible re-exports in original locations
- Exported prop types for external use

### 3. SimulatedSource Implementation
Test data source supporting multiple patterns:
- sine, QPSK, FM, noise, multi-tone
- Configurable: sample rate, amplitude, update interval
- Proper async streaming lifecycle (returns Promise<void>)

## Testing Strategy
- SimulatedSource: 14 tests, 93.5% coverage
- Component tests: Maintained existing test infrastructure
- Demo page: `/demo` route shows all visualizations with SimulatedSource

## Backward Compatibility
Original component paths maintained via re-exports:
```typescript
// Old: import IQConstellation from './components/IQConstellation'
// New: import { IQConstellation } from './visualization'
// Both work! Re-exports ensure no breaking changes.
```

## Common Patterns

### Using SimulatedSource
```typescript
const source = new SimulatedSource({ pattern: 'sine', sampleRate: 2048000 });
await source.startStreaming((samples) => setSamples(samples));
// Later: await source.stopStreaming();
```

### Component Usage
All visualization components accept samples as props:
```typescript
<IQConstellation samples={samples} width={750} height={400} />
<Spectrogram samples={samples} sampleRate={2048000} />
<WaveformVisualizer samples={samples} />
```

## Migration Notes
- Fixed EmptyState import in FFTChart (now uses ../../components/EmptyState)
- Lint fixes: removed inferrable type annotations, added return types
- Build warnings about dynamic imports (`../utils/webgl`, `../utils/webgpu`) are expected and harmless

## Future Extensions
Clean interfaces enable:
- Custom data sources (recordings, network streams)
- Advanced frame processors (demodulation, decoding)
- Alternative renderers (SVG, server-side)
- Pipeline composition (chained processors)

## References
- Demo page: `src/pages/VisualizationDemo.tsx`
- Module README: `src/visualization/README.md`
- Tests: `src/visualization/__tests__/SimulatedSource.test.ts`
- Issue acceptance: App builds, visualizations work with SimulatedSource, all tests pass
