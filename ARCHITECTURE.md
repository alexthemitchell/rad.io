# rad.io Architecture

## Table of Contents

1. [Overview](#overview)
2. [Core Architecture](#core-architecture)
3. [State & Persistence](#state--persistence)
4. [Device Integration Framework](#device-integration-framework)

## Overview

rad.io is a browser-based Software Defined Radio (SDR) visualizer built with React, TypeScript, and WebUSB. The architecture emphasizes **universal device support**, **type safety**, and **plug-and-play hardware integration**.

### Key Design Principles

1. **Universal Device Interface**: All SDR hardware implements the `ISDRDevice` interface
2. **Type Safety**: Strict TypeScript with no `any` types
3. **Separation of Concerns**: Clear boundaries between UI, device control, and DSP
4. **Performance**: GPU-accelerated WebGL visualizations with graceful fallbacks
5. **Testability**: Comprehensive unit and integration test coverage

### Technology Stack

- **React 19**: UI framework with hooks-based state management
- **TypeScript**: Strict mode for type safety
- **WebUSB API**: Hardware communication
- **WebAudio API**: DSP processing
- **HTML Canvas/WebGL**: High-performance rendering
- **AssemblyScript/WebAssembly**: Performance-critical DSP operations
- **Jest**: Testing framework
- **Webpack**: Build tooling

## Core Architecture

### Model-View-Hook Pattern

\`\`\`
Models (Device Logic) → Hooks (React Integration) → Views (Components)
\`\`\`

- **Models** (\`src/models/\`): Device implementations and data structures
- **Hooks** (\`src/hooks/\`): React state management and device lifecycle
- **Views** (\`src/components/\`, \`src/pages/\`): UI components and visualizations

### Directory Structure

\`\`\`
src/
├── models/ # Device implementations
│ ├── SDRDevice.ts # Universal interface (ISDRDevice)
│ ├── HackRFOne.ts # HackRF implementation
│ ├── HackRFOneAdapter.ts # ISDRDevice adapter
│ ├── RTLSDRDevice.ts # RTL-SDR implementation
│ ├── templates/ # Device templates
│ └── **tests**/ # Device tests
├── lib/ # Core libraries
│ └── dsp/ # Unified DSP primitives layer
│ ├── index.ts # Public API exports
│ ├── primitives.ts # Window, DC correction, AGC
│ ├── fft.ts # FFT operations
│ ├── filters.ts # Digital filters
│ ├── analysis.ts # Spectrum analysis
│ ├── conversions.ts # Format conversions
│ ├── types.ts # Shared DSP types
│ └── **tests**/ # DSP primitive tests
├── plugins/ # Extensible plugin system
│ ├── demodulators/ # Signal demodulators
│ │ ├── ATSC8VSBDemodulator.ts # ATSC 8-VSB
│ │ └── ... # AM, FM, SSB, etc.
│ └── visualizers/ # Visualization plugins
├── hooks/ # React hooks
│ ├── useUSBDevice.ts # Generic WebUSB hook
│ ├── useHackRFDevice.ts # HackRF-specific hook
│ ├── useSDR.ts # Universal SDR hook
│ └── useVisualizationInteraction.ts
├── components/ # UI components
│ ├── IQConstellation.tsx # IQ diagram visualization
│ ├── Spectrogram.tsx # Frequency spectrum
│ ├── WaveformVisualizer.tsx # Time-domain waveform
│ ├── RadioControls.tsx # Device controls
│ └── **tests**/ # Component tests
├── utils/ # Utility functions
│ ├── dsp.ts # DSP helpers (legacy, use lib/dsp)
│ ├── WebGL.ts # WebGL utilities
│ └── **tests**/ # Utility tests
├── pages/ # Top-level pages
│ └── Visualizer.tsx # Main application
└── workers/ # Web Workers
└── visualization.worker.ts

assembly/ # WebAssembly implementations
└── dsp.ts # WASM DSP primitives (SIMD-optimized)
\`\`\`

## DSP Processing Architecture

rad.io employs a **unified DSP primitives layer** that consolidates core signal processing operations into a single, well-tested, performance-optimized module. This architecture eliminates code duplication while maintaining high performance through WASM/SIMD acceleration.

### DSP Layer Hierarchy

\`\`\`
┌─────────────────────────────────────────────────────────┐
│ Application Layer │
│ • Demodulators (AM, FM, SSB, ATSC 8-VSB) │
│ • Visualizations (Spectrum, Waterfall, IQ) │
│ • Analysis Plugins (Signal Detection, Metrics) │
└─────────────────────────────────────────────────────────┘
│
↓
┌─────────────────────────────────────────────────────────┐
│ Unified DSP Primitives Layer │
│ src/lib/dsp/ │
│ ├── primitives.ts (windowing, DC correction, AGC) │
│ ├── fft.ts (FFT, IFFT, spectrum analysis) │
│ ├── filters.ts (FIR, IIR, resampling) │
│ └── conversions.ts (Sample[] ↔ Float32Array) │
└─────────────────────────────────────────────────────────┘
│
┌────────────┴────────────┐
↓ ↓
┌──────────────────────┐ ┌──────────────────────┐
│ TypeScript/JS │ │ WASM (assembly/) │
│ Reference Impl. │ │ SIMD-optimized │
│ (Fallback) │ │ (Primary) │
└──────────────────────┘ └──────────────────────┘
\`\`\`

### Shared vs. Module-Specific DSP Logic

**Shared Primitives** (\`src/lib/dsp/\`):

- **Window Functions**: Hann, Hamming, Blackman, Kaiser for spectral leakage reduction
- **DC Offset Correction**: Static, IIR, and combined modes for DC removal
- **FFT/IFFT**: Forward and inverse transforms with configurable sizes
- **Digital Filters**: Low-pass, high-pass, band-pass FIR/IIR filters
- **AGC**: Automatic gain control with configurable attack/release
- **Signal Analysis**: RMS, peak detection, SNR calculation

**Module-Specific Logic** (in \`src/plugins/demodulators/\`):

- **Demodulation Algorithms**: AM/FM/SSB/8-VSB specific implementations
- **Timing Recovery**: Gardner detector, symbol synchronization
- **Carrier Recovery**: PLL, Costas loops for phase tracking
- **Equalization**: Adaptive equalizers (e.g., ATSC LMS equalizer)
- **Protocol Sync**: Frame/segment sync detection
- **Forward Error Correction**: Reed-Solomon, convolutional coding

**Rationale**: Primitives are reusable across multiple use cases and have standard optimal implementations. Module-specific logic requires domain expertise for particular modulation schemes or protocols and often cannot be generalized without performance penalties.

### Performance Characteristics

All shared primitives support both JavaScript fallback and WASM/SIMD acceleration:

| Operation   | Size         | JS Performance | WASM Performance | Speedup |
| ----------- | ------------ | -------------- | ---------------- | ------- |
| FFT         | 2048 pts     | ~2ms           | ~0.5ms           | 4x      |
| FFT         | 8192 pts     | ~8ms           | ~2ms             | 4x      |
| DC Static   | 1024 samples | ~0.3ms         | ~0.1ms           | 3x      |
| DC IIR      | 1024 samples | ~0.5ms         | ~0.2ms           | 2.5x    |
| Hann Window | 1024 samples | ~0.2ms         | ~0.05ms          | 4x      |

See **ADR-0026: Unified DSP Primitives Architecture** for detailed design decisions.

## State & Persistence

rad.io employs a **multi-tier state management architecture** that balances performance, persistence requirements, and data lifecycle needs. Understanding which mechanism to use for different types of state is critical for maintainability and proper data handling.

### State Lifecycle Categories

**Long-term Persistent State** (survives app reloads, browser sessions, and device changes):

- **Purpose**: User preferences and discovered data that should persist indefinitely
- **Mechanism**: IndexedDB or localStorage
- **Scope**: Browser-wide, domain-scoped
- **Expiration**: Manual deletion or age-based pruning

**Session State** (survives page reloads within same session, cleared on tab close):

- **Purpose**: Application settings and UI preferences
- **Mechanism**: Zustand with localStorage persistence
- **Scope**: Single browser tab/window
- **Expiration**: Tab/window closure

**Ephemeral State** (cleared on page reload or component unmount):

- **Purpose**: UI interaction state, temporary data, runtime-only values
- **Mechanism**: Zustand (in-memory) or React hooks
- **Scope**: Component or app-wide (memory only)
- **Expiration**: Page reload or component unmount

### State Taxonomy with Examples

| State Type | Storage Mechanism | Location | Example Data | Survives Reload? |
|------------|------------------|----------|--------------|-----------------|
| **Long-term** | IndexedDB | `src/utils/atscChannelStorage.ts` | Scanned ATSC channels with signal quality | ✅ Yes |
| **Long-term** | localStorage | `src/utils/epgStorage.ts` | Electronic Program Guide (EPG) data | ✅ Yes (24hr max) |
| **Session** | Zustand + localStorage | `src/store/slices/settingsSlice.ts` | User preferences (FFT size, color scheme) | ✅ Yes |
| **Session** | Zustand (no persist) | `src/store/slices/frequencySlice.ts` | Current VFO frequency | ❌ No |
| **Session** | Zustand (no persist) | `src/store/slices/deviceSlice.ts` | Connected SDR devices | ❌ No |
| **Ephemeral** | Zustand (no persist) | `src/store/slices/notificationSlice.ts` | Toast notifications | ❌ No |
| **Ephemeral** | Zustand (no persist) | `src/store/slices/diagnosticsSlice.ts` | Performance metrics | ❌ No |
| **Ephemeral** | React hooks | `src/hooks/useATSCScanner.ts` | Active scan state, progress | ❌ No |
| **Ephemeral** | React hooks | `src/hooks/useEPG.ts` | Search query, filter selections | ❌ No |

### Storage Mechanisms in Detail

#### 1. IndexedDB (Long-term, Structured Data)

**Use for**: Large datasets, complex queries, relational data, binary blobs

**Characteristics**:

- Transactional database with ACID guarantees
- Supports indexes for efficient querying
- Async API (Promise-based)
- ~50MB+ quota (browser-dependent)
- Survives tab close, browser restart

**Example**: ATSC Channel Storage

```typescript
// src/utils/atscChannelStorage.ts
// Persistence: IndexedDB (long-term, survives browser restart)
export interface StoredATSCChannel {
  channel: ATSCChannel;
  strength: number;
  snr: number;
  discoveredAt: Date;
  lastScanned: Date;
  // ...metadata
}

await saveATSCChannel(channelData); // Persists to IndexedDB
const channels = await getAllATSCChannels(); // Query with indexes
```

#### 2. localStorage (Long-term, Key-Value)

**Use for**: Simple key-value data, application-wide caches, JSON-serializable objects

**Characteristics**:

- Synchronous API (blocking)
- String-based storage (JSON.stringify required)
- ~5-10MB quota
- Survives tab close, browser restart
- Shared across all tabs (same domain)

**Example**: EPG Data Storage

```typescript
// src/utils/epgStorage.ts
// Persistence: localStorage (long-term with 24hr expiration)
export namespace EPGStorage {
  const STORAGE_KEY = "rad_io_epg_data";
  const MAX_AGE_HOURS = 24;

  export function storeEPGData(eit, ett, channel): void {
    // Stores to localStorage with timestamp
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data: channelData
    }));
  }
}
```

#### 3. Zustand with localStorage (Session State)

**Use for**: User preferences, UI settings, cross-component state with persistence

**Characteristics**:

- React-friendly state management
- Selective persistence via middleware
- Type-safe with TypeScript
- Performance-optimized (fine-grained subscriptions)
- Persists to localStorage automatically

**Example**: Settings Slice

```typescript
// src/store/slices/settingsSlice.ts
// Persistence: Zustand + localStorage (session state, survives reload)
export const settingsSlice: StateCreator<SettingsSlice> = (set) => ({
  settings: (() => {
    // Load from localStorage on init
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULTS;
  })(),

  setSettings: (partial) => {
    set((state) => {
      const next = normalizeSettings(partial, state.settings);
      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { settings: next };
    });
  }
});
```

#### 4. Zustand (In-Memory Only)

**Use for**: Runtime state, device connections, temporary UI state

**Characteristics**:

- No persistence (cleared on reload)
- Fast in-memory access
- Shared across components
- DevTools integration for debugging

**Example**: Frequency Slice

```typescript
// src/store/slices/frequencySlice.ts
// Persistence: None (ephemeral, runtime-only)
export const frequencySlice: StateCreator<FrequencySlice> = (set) => ({
  frequencyHz: 100_000_000, // Default to 100 MHz
  setFrequencyHz: (hz) => set({ frequencyHz: hz })
});
```

#### 5. React Hooks (Component-Scoped State)

**Use for**: Component-local state, session-specific workflows, temporary calculations

**Characteristics**:

- Component lifecycle-bound
- No cross-component sharing (unless lifted)
- Cleaned up on unmount
- React DevTools visibility

**Example**: ATSC Scanner Hook

```typescript
// src/hooks/useATSCScanner.ts
// Persistence: None (ephemeral session state during active scan)
export function useATSCScanner(device) {
  const [state, setState] = useState<ScannerState>("idle");
  const [progress, setProgress] = useState(0);
  // State cleared when component unmounts or scan stops
}
```

### Guidance for Future Features

When adding new stateful features, follow this decision tree:

#### 1. Does the data need to survive browser restart?

- **No** → Use Zustand (in-memory) or React hooks
- **Yes** → Continue to step 2

#### 2. Is the data large (>1MB) or needs complex queries?

- **Yes** → Use IndexedDB
- **No** → Continue to step 3

#### 3. Should it be shared across all tabs?

- **Yes** → Use localStorage (with namespace)
- **No** → Use Zustand + localStorage

#### 4. Is it component-specific or app-wide?

- **Component-specific** → React hooks (useState, useReducer)
- **App-wide** → Zustand slice

#### Storage Key Naming Conventions

- IndexedDB database: `rad-io-{feature}` (e.g., `rad-io-atsc-channels`)
- localStorage key: `rad.{feature}.v{version}` (e.g., `rad.settings.v1`)
- Zustand store: Export from `src/store/index.ts` with typed hooks

#### Common Pitfalls to Avoid

- ❌ Storing device instances in localStorage (not serializable)
- ❌ Mixing persistence mechanisms for same data type
- ❌ Forgetting to handle localStorage quota exceeded errors
- ❌ Not versioning localStorage keys (breaking changes)
- ❌ Using localStorage synchronously in hot paths (blocks UI)

#### Type Consistency

- Export interfaces for all persistent data structures
- Use consistent naming: `{Feature}Data`, `Stored{Feature}`, `{Feature}State`
- Document serialization requirements (Date → ISO string, etc.)

## Device Integration Framework

### Universal Interface: \`ISDRDevice\`

All SDR devices **must** implement the \`ISDRDevice\` interface defined in \`src/models/SDRDevice.ts\`. This ensures consistent behavior and enables plug-and-play device support.

See \`docs/DEVICE_INTEGRATION.md\` for a step-by-step guide to adding new devices.
