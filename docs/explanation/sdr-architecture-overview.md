# SDR Architecture Overview

This document explains the high-level architecture of rad.io and the reasoning behind key design decisions. If you want to understand "why" the system is built the way it is, you're in the right place.

## What is rad.io?

rad.io is a browser-based Software-Defined Radio (SDR) application that enables real-time signal analysis, visualization, and demodulation directly in the web browser. Unlike traditional SDR applications that require native desktop software, rad.io leverages modern web technologies to provide a universal, cross-platform experience.

## Core Design Principles

### 1. Browser-Native Architecture

**Decision**: Build entirely with web technologies rather than creating a desktop application.

**Why?**
- **Universal Access**: Works on any device with a modern browser
- **No Installation**: Users can start analyzing signals immediately
- **Automatic Updates**: Deploy once, all users get updates instantly
- **Security Sandboxing**: Browser security model protects user systems
- **Cross-Platform**: Same experience on Windows, macOS, Linux

**Trade-offs**:
- ✅ Easier distribution and deployment
- ✅ Built-in security through browser sandbox
- ⚠️ Limited to WebUSB-supporting browsers (Chrome, Edge, Opera)
- ⚠️ Performance constraints vs native code (mitigated with WebAssembly)

### 2. Separation of Concerns

The architecture is layered with clear boundaries:

```
┌─────────────────────────────────────────┐
│         User Interface (React)          │
│  Pages, Controls, Status Displays       │
└─────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────┐
│    Visualization Components              │
│  IQConstellation, Spectrogram, etc.     │
└─────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────┐
│         Rendering Layer                  │
│  WebGPU / WebGL / Canvas2D              │
└─────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────┐
│      Signal Processing (DSP)            │
│  FFT, Demodulation, Filtering           │
└─────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────┐
│         Data Sources                     │
│  HackRF, RTL-SDR, Simulated, Replay     │
└─────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────┐
│       Hardware Layer (WebUSB)           │
│  USB Communication, Device Control      │
└─────────────────────────────────────────┘
```

**Why this structure?**
- **Testability**: Each layer can be tested independently
- **Flexibility**: Swap implementations without affecting other layers
- **Maintainability**: Clear boundaries reduce coupling
- **Extensibility**: Add new devices or visualizations without modifying core logic

### 3. Type Safety First

**Decision**: Use TypeScript with strict mode enabled throughout.

**Why?**
- **Catch Errors Early**: Type errors found at compile time, not runtime
- **Better Tooling**: IDE autocomplete, refactoring tools, inline documentation
- **Self-Documenting**: Types serve as always-up-to-date documentation
- **Confidence in Refactoring**: Change code knowing types will catch mistakes

**Example**: Device interface guarantees all devices have the same API:

```typescript
interface ISDRDevice {
  open(): Promise<void>;
  setFrequency(frequency: number): Promise<void>;
  // ... other methods
}
```

Any device implementation must satisfy this contract.

## Key Architectural Components

### Hardware Abstraction Layer

**Problem**: Different SDR devices have completely different USB protocols, command structures, and data formats.

**Solution**: The `ISDRDevice` interface provides a unified API:

```typescript
// Same code works with ANY device
async function tuneToStation(device: ISDRDevice, frequency: number) {
  await device.setFrequency(frequency);
  await device.startReceiving();
}

// Works with HackRF
await tuneToStation(hackrf, 100e6);

// Also works with RTL-SDR
await tuneToStation(rtlsdr, 100e6);
```

**Benefits**:
- UI code doesn't know or care about hardware specifics
- Add new devices without changing UI
- Test with simulated devices
- Mock devices for unit tests

See [ADR-0023: SDR Driver Abstraction API](../decisions/0023-sdr-driver-abstraction-api.md) for details.

### DSP Pipeline

**Problem**: Signal processing is CPU-intensive and blocks the UI if done on the main thread.

**Solution**: Multi-level approach:

1. **Web Workers**: Offload FFT computation to background threads
2. **WebAssembly**: Use compiled code for critical paths (FFT, filtering)
3. **Batching**: Process data in chunks to amortize overhead
4. **Shared Buffers**: Minimize data copying with `SharedArrayBuffer`

```
Main Thread          Web Worker           WASM Module
    │                    │                     │
    │─────samples───────>│                     │
    │                    │───FFT params───────>│
    │                    │<──FFT result────────│
    │<───spectrum────────│                     │
    │                    │                     │
    └─> Render           └─> Process Next      └─> Available
```

**Why this matters**:
- UI stays responsive even with high sample rates
- Multi-core CPUs are utilized effectively
- Performance approaches native SDR applications

See [ADR-0002: Web Worker DSP Architecture](../decisions/0002-web-worker-dsp-architecture.md) for details.

### Visualization Strategy

**Problem**: Real-time signal visualization requires high frame rates (60 FPS) with large datasets.

**Solution**: Progressive enhancement with multiple rendering backends:

1. **WebGPU** (preferred): Modern GPU API, best performance
2. **WebGL** (fallback): Broad support, good performance
3. **Canvas 2D** (last resort): Works everywhere, acceptable performance

**Why three backends?**
- **Compatibility**: Works on maximum number of devices
- **Performance**: Use fastest available option
- **Future-Proof**: Adopt new technologies as they become available

All three share the same component interface:

```typescript
interface IVisualizationRenderer {
  render(data: RenderData): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
```

See [ADR-0015: Visualization Rendering Strategy](../decisions/0015-visualization-rendering-strategy.md) for details.

### State Management

**Problem**: Complex state (device status, frequency, gain, streaming state) must stay synchronized across components.

**Solution**: React Context + Hooks pattern:

```typescript
// Centralized device context
const DeviceContext = React.createContext<DeviceState>();

// Components access shared state
function FrequencyControl() {
  const { frequency, setFrequency } = useDeviceContext();
  // ...
}
```

**Benefits**:
- Single source of truth
- Automatic UI updates when state changes
- No prop drilling
- Easy to test with mock contexts

See [ADR-0009: State Management Pattern](../decisions/0009-state-management-pattern.md) for details.

## Data Flow

Let's trace how data flows from antenna to visualization:

### 1. Hardware Acquisition

```
Antenna → HackRF Hardware → USB Cable → Browser (WebUSB)
```

- Radio waves hit antenna
- HackRF samples I/Q at configured rate (e.g., 20 MS/s)
- Data transferred via USB in 256 KB chunks
- Browser receives via WebUSB `transferIn()` API

### 2. Parsing and Buffering

```
USB Transfer → Device Driver → Sample Buffer → Ring Buffer
```

- Device driver parses binary format to `IQSample[]`
- Samples buffered to smooth out USB jitter
- Ring buffer prevents memory growth

### 3. Signal Processing

```
Samples → Web Worker → FFT (WASM) → Spectrum Data
```

- Samples sent to Web Worker via `postMessage()`
- WASM FFT computes frequency spectrum
- Results sent back to main thread

### 4. Visualization

```
Spectrum → Visualization Component → Renderer → Canvas/WebGL
```

- React component receives new spectrum data
- Renderer updates GPU buffers or canvas
- Browser displays at 60 FPS

### 5. Audio Output (if demodulation enabled)

```
Samples → Demodulator → Audio Buffer → Web Audio → Speakers
```

- Parallel path for audio
- FM/AM demodulation extracts audio signal
- Web Audio API plays through speakers

## Performance Characteristics

### Throughput

- **Sample Rate**: Up to 20 MS/s (HackRF One)
- **FFT Rate**: 60 FPS with 2048-point FFT
- **Latency**: ~100-200ms antenna to display

### Memory Usage

- **Sample Buffers**: ~10-50 MB depending on buffer size
- **FFT Output**: ~8 KB per frame
- **Waterfall History**: ~8 MB for 100 frames
- **Total**: ~50-100 MB typical usage

### CPU Usage

- **Main Thread**: 10-20% (UI updates, rendering)
- **Web Workers**: 30-50% (DSP processing)
- **Total**: 40-70% on modern multi-core CPU

## Scalability Considerations

### Adding New Devices

1. Implement `ISDRDevice` interface
2. Add USB descriptors
3. Write tests
4. Register in device factory

~200 lines of code for typical device. See [How-To: Add New SDR Device](../how-to/add-new-sdr-device.md).

### Adding New Visualizations

1. Create React component
2. Implement renderer (WebGL/Canvas)
3. Add to layout
4. Write tests

~300-500 lines for typical visualization.

### Adding New Demodulation Modes

1. Implement demodulation algorithm
2. Add to DSP pipeline
3. Wire to audio output
4. Add UI controls

~100-200 lines for typical mode.

## Security Considerations

### Browser Sandbox

- All code runs in browser security sandbox
- No direct file system access
- WebUSB requires user permission
- HTTPS required for production

### USB Device Access

- User must explicitly approve each device
- Browser enforces same-origin policy
- Permissions can be revoked anytime

### Data Privacy

- No data leaves the browser
- No analytics or tracking
- All processing happens locally

## Testing Strategy

### Unit Tests

- Pure functions (DSP algorithms)
- Device drivers (mocked USB)
- React components (rendered in jsdom)

### Integration Tests

- DSP pipeline (workers + WASM)
- Device lifecycle (open → configure → stream → close)
- Visualization rendering (canvas/WebGL mocking)

### E2E Tests

- Full application flow with simulated device
- Optional: Real hardware testing
- Accessibility compliance (axe-core)

See [ADR-0006: Testing Strategy](../decisions/0006-testing-strategy-framework-selection.md) for details.

## Deployment Model

### GitHub Pages

- Static hosting on GitHub's CDN
- Automatic deployment on push to main
- HTTPS by default (required for WebUSB)

### Progressive Web App (PWA)

- Service worker for offline support
- Can be installed as standalone app
- App-like experience on mobile devices

See [Deployment Guide](../DEPLOYMENT.md) for details.

## Evolution and Future Direction

### Planned Enhancements

- **More Devices**: RTL-SDR Blog V4, Airspy, PlutoSDR
- **More Modes**: SSB, CW, PSK31, RTTY
- **Recording**: Save I/Q samples to file
- **Playback**: Analyze recorded signals
- **Waterfall Export**: Save spectrograms as images

### Experimental Features

- **WebNN**: Neural network API for ML-based demodulation
- **WebCodecs**: Hardware video encoding for recording
- **WebRTC**: Remote SDR sharing
- **WebTransport**: Lower latency streaming

## Learn More

- **[Tutorials](../tutorials/)** - Step-by-step learning
- **[How-To Guides](../how-to/)** - Solve specific problems
- **[Reference](../reference/)** - Technical details
- **[ADRs](../decisions/)** - Detailed design decisions

## Questions?

- [GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)
- [Architecture Decision Records](../decisions/)
- [Contributing Guide](../../CONTRIBUTING.md)
