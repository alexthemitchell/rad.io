# rad.io - SDR Visualizer Project Guide

## Tools

- **It is incredibly important to use the tools available to you when implementing your solutions.**
- Start every turn by using #oraios/serena/activate_project
- When using #microsoftdocs/mcp/microsoft_docs_fetch to fetch documentation, you can specify a URL or a search query. If you provide a search query, the tool will return the most relevant documentation it can find.
- Look for tools like #problems #runTasks #runTests #usages and #executePrompt to help you interact with the development environment
- **Critical**: Prefer to use #runTests and #runTasks over #runCommands
- Avoid using #runCommands unless no other tool can provide the answer and the output is absolutely necessary
- Use #microsoft/playwright-mcp/\* commands to test your code in a browser environment. Take screenshots and analyze them to verify your work.
- **Prefer to read symbol data with serena tools over reading entirety of files**: use #oraios/serena/find_referencing_symbols #oraios/serena/get_symbols_overview #oraios/serena/search_for_pattern
- **Maintain Long Term Memory**: use #oraios/serena/read_memory when thinking about how to solve problems and #oraios/serena/write_memory when you have learned something new that will be valuable for a future Agent.
- Always keep the user in mind as a tool to help you solve problems. For example, when connecting to a device using WebUSB, you may need to ask the user to select the device from a browser prompt that you cannot see or interact with.
- Remember when using WebUSB that physical devices are required to fully test your code. You may need to ask the user to assist you with this. Physical devices are unreliable and may not always be available, so plan accordingly and verify with the user if you are unsure of the availability of a device.
- The goal of this project includes the creation of TypeScript-first WebUSB drivers for SDR hardware. This is a complex task that requires careful planning and execution. Use the tools available to you to research and implement these drivers, and always keep the user in mind as a resource to help you solve problems.
- Always end your turn by evaluating whether you should add or update long term memory with #oraios/serena/list_memories and #oraios/serena/write_memory

## Getting Started

**🚀 NEW TO THIS PROJECT?** Read the [Copilot Agent Setup Steps](workflows/copilot-setup-steps.md) first for:

- Environment setup instructions
- Essential commands and workflows
- Common issues and solutions

## Project Overview

rad.io is a browser-based Software Defined Radio (SDR) visualizer built with React + TypeScript. It provides industry-standard visualizations for digital signal processing, including IQ constellation diagrams, spectrograms, and waveform analysis with zero external visualization dependencies.

**Key Technologies:**

- React 19 with TypeScript (strict mode)
- WebUSB API for hardware communication
- HTML Canvas with WebAudio API for visualizations
- Jest for comprehensive testing
- GitHub Actions for CI/CD quality control

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

All SDR devices MUST implement `ISDRDevice` interface

**Supported Devices:**

- HackRF One (0x1d50:0x6089) - Native implementation

### WebUSB

**Security Context Required**: HTTPS only (WebUSB restriction)

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

## Documentation & Resources

### External References

- **IQ Constellation**: https://www.mathworks.com/help/comm/ref/constellationdiagram.html
- **Spectrogram Standards**: Signal processing literature
- **Viridis Colormap**: https://cran.r-project.org/web/packages/viridis/vignettes/intro-to-viridis.html
- **WebUSB API**: MDN Web Docs - https://developer.mozilla.org/en-US/docs/Web/API/USB
- **HackRF One Reference Implementation**: https://github.com/greatscottgadgets/hackrf/blob/master/host/libhackrf/src/hackrf.c

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
