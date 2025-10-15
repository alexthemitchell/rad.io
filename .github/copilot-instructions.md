# rad.io - SDR Visualizer Project Guide

## Tools

- **It is incredibly important to use the tools available to you when implementing your solutions.**
- Look for tools like #problems, #runTasks, #runTests, #usages and #executePrompt to help you interact with the development environment
- Use #microsoft/playwright-mcp's #browser commands to test your code in a browser environment. Take screenshots and analyze them to verify your work.
- Use #oraios/serena to help you with code generation and understanding.
- **Prefer to read symbol data with serena tools over reading entirety of files**: use #find_referencing_symbols #get_symbols_overview #search_for_pattern
- **Maintain Long Term Memory**: use #read_memory when thinking about how to solve problems and #write_memory when you have learned something new that will be valuable for a future Agent.

## Getting Started

**🚀 NEW TO THIS PROJECT?** Read the [Copilot Agent Setup Steps](workflows/copilot-setup-steps.md) first for:

- Environment setup instructions
- Essential commands and workflows
- Memory management guidelines for testing
- Common issues and solutions

## Project Overview

rad.io is a professional browser-based Software Defined Radio (SDR) visualizer built with React + TypeScript. It provides industry-standard visualizations for IQ constellation diagrams, spectrograms, and waveform analysis with zero external visualization dependencies.

**Key Technologies:**

- React 19 with TypeScript (strict mode)
- WebUSB API for hardware communication
- HTML Canvas with WebAudio API for visualizations
- Jest for comprehensive testing (122+ tests)
- GitHub Actions for CI/CD quality control
- **Device Memory API** for efficient buffer management and testing optimization

## Architecture & Design Patterns

### Core Architecture Principles

1. **Universal Device Interface (`ISDRDevice`)**: All SDR hardware implements a standardized interface for plug-and-play compatibility
2. **Hook-First UI**: Device lifecycle and interactions managed through React hooks
3. **Separation of Concerns**: Clear boundaries between UI, device control, and DSP processing
4. **Hardware Abstraction**: Device-specific implementations hidden behind common interface
5. **Canvas-Based Visualizations**: Native browser APIs for high-performance rendering

### Directory Structure

```
src/
├── components/          # UI components and visualizations
│   ├── IQConstellation.tsx    # Canvas-based IQ diagram
│   ├── Spectrogram.tsx         # Power spectral density visualization
│   ├── WaveformVisualizer.tsx  # Time-domain amplitude display
│   ├── RadioControls.tsx       # Frequency/gain controls
│   ├── PresetStations.tsx      # Quick station presets
│   ├── SignalTypeSelector.tsx  # AM/FM toggle
│   ├── DSPPipeline.tsx         # Signal flow visualization
│   └── __tests__/              # Component tests
├── models/              # Device implementations
│   ├── SDRDevice.ts            # Universal interface definition
│   ├── HackRFOne.ts            # HackRF device implementation
│   ├── HackRFOneAdapter.ts     # ISDRDevice adapter
│   └── __tests__/              # Device tests
├── hooks/               # React hooks for device management
│   ├── useHackRFDevice.ts      # HackRF-specific hook
│   └── useUSBDevice.ts         # Generic WebUSB hook
├── utils/               # Utility functions
│   ├── dsp.ts                  # DSP algorithms (FFT, waveform)
│   ├── testMemoryManager.ts    # Memory management for tests
│   └── __tests__/              # DSP and memory tests
├── pages/               # Top-level page components
│   └── Visualizer.tsx          # Main application page
└── styles/              # CSS styling
    └── main.css                # Global styles and utilities
```

### Key Entry Points

1. **Application Entry**: `src/index.tsx` → `src/App.tsx` → `src/pages/Visualizer.tsx`
2. **Device Discovery**: `useUSBDevice` hook requests WebUSB access
3. **Device Initialization**: `useHackRFDevice` creates and configures device instance
4. **Visualization Pipeline**: Raw IQ samples → DSP processing → Canvas rendering

## Critical Implementation Details

### Universal SDR Interface (`src/models/SDRDevice.ts`)

All SDR devices MUST implement `ISDRDevice` interface:

```typescript
interface ISDRDevice {
  // Lifecycle
  open(): Promise<void>;
  close(): Promise<void>;
  isOpen(): boolean;

  // Configuration
  setFrequency(frequencyHz: number): Promise<void>;
  getFrequency(): Promise<number>;
  setSampleRate(sampleRateHz: number): Promise<void>;
  setLNAGain(gainDb: number): Promise<void>;
  setAmpEnable(enabled: boolean): Promise<void>;

  // Streaming
  receive(callback?: IQSampleCallback): Promise<void>;
  stopRx(): Promise<void>;
  isReceiving(): boolean;

  // Metadata
  getDeviceInfo(): Promise<SDRDeviceInfo>;
  getCapabilities(): SDRCapabilities;

  // Data parsing
  parseSamples(data: DataView): IQSample[];

  // Memory Management (NEW)
  getMemoryInfo(): DeviceMemoryInfo; // Query buffer usage
  clearBuffers(): void; // Release memory
}
```

**Memory Management API** (see `MEMORY_API.md` for details):

```typescript
type DeviceMemoryInfo = {
  totalBufferSize: number; // Total buffer capacity in bytes
  usedBufferSize: number; // Current memory usage
  activeBuffers: number; // Number of active sample buffers
  maxSamples: number; // Maximum samples that can be buffered
  currentSamples: number; // Current samples in buffers
};
```

The memory API enables:

- Real-time buffer usage monitoring
- Automatic cleanup when exceeding thresholds (16MB default for HackRF)
- Test optimization to prevent heap overflow
- Performance tuning for large dataset processing

**Supported Devices:**

- HackRF One (0x1d50:0x6089) - Native implementation
- RTL-SDR (0x0bda:0x2838, 0x0bda:0x2832) - Format converters available
- Airspy (0x1d50:0x60a1) - Database entry included

### WebUSB Communication Pattern

**Security Context Required**: HTTPS only (WebUSB restriction)

```typescript
// 1. Request device access
const device = await navigator.usb.requestDevice({
  filters: [{ vendorId: 0x1d50 }],
});

// 2. Open and claim interface
await device.open();
await device.claimInterface(interfaceNumber);

// 3. Control transfers (vendor commands)
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

// 4. Bulk transfers (IQ data streaming)
const result = await device.transferIn(endpoint, bufferSize);

// 5. Cleanup
await device.releaseInterface(interfaceNumber);
await device.close();
```

**Critical Gotchas:**

- Always check `device.opened` before transfers
- Use mutex/locking for concurrent control transfers
- Handle `InvalidStateError` with retries
- Add delays after state changes (50-100ms)
- Set `streaming` flags to prevent race conditions

### Visualization Components

**Design Principles Applied:**

1. **Perceptually Uniform Colormaps**: Viridis (11-point interpolation) for spectrograms
2. **Density-Based Rendering**: Z-ordering (low→high) for IQ constellations
3. **GPU Acceleration**: `desynchronized: true` canvas context hint
4. **High-DPI Support**: Automatic `devicePixelRatio` scaling
5. **Professional Typography**: System font stack (SF Pro, Segoe UI)

**Canvas Optimization Techniques:**

```typescript
const canvas = canvasRef.current;
const ctx = canvas.getContext("2d", {
  alpha: false, // Opaque for performance
  desynchronized: true, // GPU acceleration hint
});

// High DPI scaling
const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
ctx.scale(dpr, dpr);

// Sub-pixel rendering for crisp lines
ctx.translate(0.5, 0.5);
```

### DSP Processing (`src/utils/dsp.ts`)

**WebAudio API Integration:**

- Manual DFT implementation for synchronous FFT
- Proper frequency shifting (zero at center)
- dB scaling: `20 * log10(magnitude)`
- Parseval's theorem validation in tests

**Signal Processing Chain:**

1. Raw IQ samples (Int8/Uint8/Int16) → Float32
2. Interleaved I/Q → Complex pairs
3. DFT → Frequency domain
4. Frequency shift → Centered spectrum
5. Magnitude → dB conversion

## Development Workflows

### Build & Test Commands

```bash
# Development
npm start              # HTTPS dev server with HMR

# Build
npm run build          # Production webpack build

# Quality Control
npm run lint           # ESLint validation
npm run lint:fix       # Auto-fix linting issues
npm run format         # Prettier code formatting
npm run format:check   # Validate formatting
npm run type-check     # TypeScript compiler check

# Testing
npm test               # Run all 122+ tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### CI/CD Quality Gates

**All PRs to `main` must pass:**

1. ✅ Lint Code (ESLint)
2. ✅ Run Tests (Jest - 122 tests)
3. ✅ Check Formatting (Prettier)
4. ✅ Build Application (Webpack)
5. ✅ TypeScript Type Check (tsc)

Workflow: `.github/workflows/quality-checks.yml`
Execution time: ~2-4 minutes (parallel jobs)

### Testing Strategy

**Test Coverage: 122 tests across 5 suites**

1. **DSP Utilities (29 tests)**: Sine wave generation, FFT accuracy, mathematical properties
2. **IQ Constellation (11 tests)**: Canvas rendering, patterns, boundary conditions
3. **Spectrogram (13 tests)**: FFT data, frequency ranges, multi-tone signals
4. **SDR Device Interface (43 tests)**: Lifecycle, configuration, format conversion, validation
5. **Realistic SDR Data (26 tests)**: FM/AM/QPSK/noise signals, cross-visualization consistency
6. **Memory Manager (10 tests)**: Buffer pooling, chunked generation, batch processing, monitoring

**Test Data Generation:**

```typescript
// Sine wave for FFT accuracy testing
generateSineWave(frequency, amplitude, sampleCount, phase);

// Realistic modulation schemes
generateFMSignal(); // 75kHz deviation
generateAMSignal(); // 80% modulation index
generateQPSKSignal(); // 4-point constellation
generateMultiToneSignal();
generatePulsedSignal();
generateNoiseSignal();

// Memory-optimized generation (NEW)
generateSamplesChunked(count, generator, chunkSize); // For large datasets
processSamplesBatched(samples, processor, batchSize); // Batch processing
```

**Memory Management in Tests:**

```typescript
import { clearMemoryPools } from '../../utils/testMemoryManager';

describe("Test Suite", () => {
  beforeEach(() => {
    if (global.gc) global.gc();  // Force GC when available
  });

  afterEach(() => {
    clearMemoryPools();  // Clean up buffer pools
  });

  it("test", () => {
    const { unmount } = render(<Component />);
    // ... assertions ...
    unmount();  // Always unmount components
  });
});
```

**Important**: Due to memory constraints, avoid generating datasets >10k samples without using chunked generation. See `src/utils/testMemoryManager.ts` for utilities.

## Code Style & Best Practices

### TypeScript Patterns

**Strict Mode Compliance:**

- `strict: true` in tsconfig.json
- Explicit types for all exports
- No `any` types without justification
- Proper error handling with typed errors

**Component Patterns:**

```typescript
// Functional components with hooks
function ComponentName({ prop1, prop2 }: ComponentProps) {
  const [state, setState] = useState<StateType>(initialValue);

  useEffect(() => {
    // Side effects with cleanup
    return () => cleanup();
  }, [dependencies]);

  return <div>...</div>;
}

// Prop types
type ComponentProps = {
  prop1: string;
  prop2?: number;
  onEvent: (data: EventData) => void;
};
```

### CSS Styling Conventions

**Utility-First Approach:**

- Reusable classes: `.btn`, `.card`, `.status-indicator`
- Responsive with CSS Grid and Flexbox
- Mobile breakpoints at 768px
- CSS variables for theme colors

**Component Styling:**

- Scoped styles via BEM-like naming
- Professional color palette: `#e0e6ed` (primary), `#a0aab5` (secondary), `#5aa3e8` (accent)
- Consistent spacing: 60-80px margins
- Animation keyframes for status indicators

## Adding New SDR Devices

### Implementation Checklist

1. **Implement `ISDRDevice` interface** in `src/models/YourDevice.ts`
2. **Add USB vendor/product IDs** to `KNOWN_SDR_DEVICES` in `SDRDevice.ts`
3. **Implement format conversion** if using non-standard sample format
4. **Create device-specific hook** in `src/hooks/useYourDevice.ts`
5. **Add validation tests** in `src/models/__tests__/YourDevice.test.ts`
6. **Test with realistic signals** in `src/components/__tests__/VisualizationSDRData.test.tsx`

### Example: RTL-SDR Implementation

```typescript
export class RTLSDRDevice implements ISDRDevice {
  private usbDevice: USBDevice;
  private currentFrequency: number = 100e6;

  async open() {
    await this.usbDevice.open();
    await this.usbDevice.claimInterface(0);
  }

  parseSamples(data: DataView): IQSample[] {
    // RTL-SDR uses Uint8 format
    return convertUint8ToIQ(data);
  }

  // ... implement remaining interface methods
}
```

## Common Issues & Solutions

### WebUSB Connection Issues

**Problem**: "Device not found" or connection fails
**Solution**:

- Ensure HTTPS context (required for WebUSB)
- Check vendor/product ID matches device
- Verify USB permissions on OS level
- Try different USB port/cable

### Invalid State Errors

**Problem**: `InvalidStateError` during transfers
**Solution**:

- Implement retry logic with delays
- Use mutex/locking for concurrent operations
- Check `device.opened` before all transfers
- Add 50-100ms delays after state changes

### Canvas Rendering Performance

**Problem**: Slow or choppy visualizations
**Solution**:

- Enable `desynchronized: true` for GPU hints
- Use `alpha: false` for opaque rendering
- Implement adaptive downsampling
- Debounce resize events

### Test Failures

**Problem**: Tests failing after changes
**Solution**:

- Run `npm test` to identify specific failures
- Check FFT accuracy tolerances (±1 bin is acceptable)
- Verify sample generation functions
- Ensure canvas mocks are properly configured

## Documentation & Resources

### Internal Documentation

- **API Documentation**: See JSDoc comments in source files
- **Component README**: Check individual component files for usage examples
- **Test Documentation**: Review test files for expected behavior examples

### External References

- **IQ Constellation**: UVic ECE Communications Labs best practices
- **Spectrogram Standards**: Signal processing literature
- **Viridis Colormap**: Matplotlib scientific visualization standards
- **WebUSB API**: MDN Web Docs - https://developer.mozilla.org/en-US/docs/Web/API/USB

## Future Enhancements

**Planned Features:**

- Real-time audio demodulation (FM/AM)
- Waterfall display mode
- Recording and playback
- Additional device support (SDRPlay, BladeRF)
- Frequency scanning
- Signal strength meter

**Performance Optimizations:**

- WebGL rendering for large datasets
- Web Workers for DSP processing
- OffscreenCanvas for background rendering
- WASM FFT implementations

## Support & Contributing

**Getting Help:**

1. Review this documentation
2. Check existing tests for usage examples
3. Examine component source code and JSDoc
4. Review GitHub Issues for similar problems

**Quality Standards:**

- All code must pass lint, format, type-check, and tests
- Add tests for new features
- Follow existing code patterns
- Update documentation for API changes
- Include JSDoc comments for public APIs

**Submitting Changes:**

1. Create feature branch from `main`
2. Make minimal, focused changes
3. Add/update tests
4. Run quality checks locally
5. Create PR - automated checks will run
6. All quality gates must pass before merge
