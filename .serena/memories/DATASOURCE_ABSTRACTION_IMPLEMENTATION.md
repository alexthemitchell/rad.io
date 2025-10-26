# DataSource Abstraction Implementation

## Purpose
Documents the DataSource abstraction and source implementations for decoupling visualizations from data sources.

## Architecture

### DataSource Interface (`src/visualization/interfaces.ts`)
Contract for all data sources (hardware, simulated, recorded):
- `startStreaming(callback)`: Begin streaming samples
- `stopStreaming()`: End streaming
- `isStreaming()`: Check streaming state
- `getMetadata()`: Get source metadata

### Implementations

#### SimulatedSource (`src/visualization/SimulatedSource.ts`)
Generates synthetic signals for testing:
- Patterns: sine, QPSK, FM, noise, multi-tone
- Configurable: sampleRate, amplitude, updateInterval, samplesPerUpdate
- Coverage: 93.81% (14 tests)

#### ReplaySource (`src/visualization/ReplaySource.ts`)
Plays back recorded IQ data deterministically:
- Wraps IQPlayback with DataSource interface
- Features: pause/resume/seek, metadata access
- Perfect for repeatable test scenarios
- Coverage: 97.29% (20 tests)

## Usage Pattern

```typescript
// SimulatedSource
const source = new SimulatedSource({ 
  pattern: "sine", 
  sampleRate: 2048000 
});

// ReplaySource  
const recording = await loadRecordingFromFile(file);
const source = new ReplaySource(recording, 32768);

// Both use same interface
await source.startStreaming((samples) => {
  // Visualizations consume samples uniformly
});
```

## Key Decisions

1. **Uniform Interface**: All sources implement DataSource, enabling polymorphic use
2. **Callback-Based**: Streaming uses callbacks for real-time data delivery
3. **Metadata Access**: All sources provide metadata (sampleRate, frequency, etc.)
4. **Deterministic Testing**: ReplaySource enables repeatable test scenarios

## Testing Strategy

- Unit tests: 20 for ReplaySource, 14 for SimulatedSource
- Integration tests: 7 tests verifying visualizations work with both sources
- Test deterministic replay: Verify same samples delivered on each playback

## Visualization Integration

All visualization components accept samples as props:
- `<IQConstellation samples={samples} />`
- `<WaveformVisualizer samples={samples} />`
- `<Spectrogram samples={samples} />`

This decouples visualizations from data acquisition, enabling:
- Testing without hardware
- Deterministic test scenarios
- Easy mocking for unit tests

## Files

- Interface: `src/visualization/interfaces.ts`
- Sources: `src/visualization/{SimulatedSource,ReplaySource}.ts`
- Tests: `src/visualization/__tests__/{SimulatedSource,ReplaySource,DataSourceIntegration}.test.{ts,tsx}`
- Docs: `src/visualization/README.md`

## References

- Issue: Implement DataSource abstraction
- ADR: Visualization module architecture
- Memory: VISUALIZATION_MODULE_ARCHITECTURE
