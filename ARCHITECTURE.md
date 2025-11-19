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

## Module Organization & Maintainability

To improve code maintainability and reduce complexity, large modules have been refactored into logical sub-modules:

### Transport Stream Parser (`src/parsers/`)

The MPEG-2 Transport Stream parser has been split into internal submodules within `src/parsers/ts/`:

- **types.ts**: All interface and enum definitions (StreamType, TableId, etc.)
- **tsPacket.ts**: Low-level packet parsing (headers, adaptation fields, PCR)
- **psi.ts**: PSI table parsing (PAT, PMT)
- **psip.ts**: PSIP table parsing (MGT, VCT, EIT, ETT)
- **descriptors.ts**: Generic descriptor parsing
- **index.ts**: Re-exports for easy importing

The main `TransportStreamParser.ts` (641 lines, down from 1494) orchestrates these modules and maintains the public API for backward compatibility.

### ATSC Player Components (`src/pages/ATSCPlayer/`)

The ATSC Player page has been refactored into focused sub-components:

- **ChannelSelector.tsx**: Channel selection UI with signal strength indicators
- **ProgramInfoDisplay.tsx**: Current program metadata (title, description, timing)
- **SignalQualityMeters.tsx**: SNR, MER, BER, and sync lock indicators
- **AudioTrackSelector.tsx**: Audio track selection dropdown
- **VideoPlayer.tsx**: Video canvas with status overlays and captions container
- **PlaybackControls.tsx**: Stop, volume, mute, and closed caption controls
- **index.ts**: Component re-exports

The main `ATSCPlayer.tsx` (650 lines, down from 975) composes these components and manages application state.

### Benefits

This modular organization provides:

- **Improved Readability**: Each module has a clear, focused purpose
- **Easier Maintenance**: Changes are isolated to relevant submodules
- **Better Testability**: Smaller modules are easier to test in isolation
- **Reduced Cognitive Load**: Contributors can understand and modify code more easily
- **Backward Compatibility**: Public APIs remain unchanged through re-exports

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

### DSP Environment Detection and Fallback System

rad.io implements a **three-tier fallback system** to ensure the application works across different deployment environments and browser capabilities, while providing optimal performance when conditions allow.

#### Execution Modes

The application automatically detects runtime capabilities and selects the appropriate DSP mode:

**1. SharedArrayBuffer Mode (Optimal)**

- **Requirements**: COOP/COEP headers, HTTPS, modern browser
- **Performance**: 10+ GB/s throughput, <0.1ms latency, zero-copy transfers
- **Deployment**: Vercel, Netlify, Cloudflare Pages, or custom server with headers

**2. MessageChannel Mode (Fallback)**

- **Requirements**: Web Workers support
- **Performance**: ~200 MB/s throughput, 1-5ms latency, buffer copying overhead
- **Deployment**: GitHub Pages, browsers without cross-origin isolation

**3. Pure JavaScript Mode (Emergency)**

- **Requirements**: None (always available)
- **Performance**: Blocks UI thread, not suitable for real-time processing
- **Deployment**: Unsupported browsers, debugging scenarios

#### Detection Logic

On application startup (`App.tsx` via `useDSPInitialization()` hook):

```typescript
const capabilities = detectDSPCapabilities();
// Returns: {
//   mode: DSPMode.SHARED_ARRAY_BUFFER | MESSAGE_CHANNEL | PURE_JS,
//   sharedArrayBufferSupported: boolean,
//   crossOriginIsolated: boolean,
//   webWorkersSupported: boolean,
//   deploymentEnvironment: "development" | "github-pages" | "custom-headers" | "unknown",
//   warnings: string[],
//   performanceImpact: string,
// }
```

The detection checks:

1. `typeof SharedArrayBuffer !== "undefined"` (browser support)
2. `crossOriginIsolated === true` (COOP/COEP headers present)
3. `typeof Worker !== "undefined"` (Web Workers available)
4. Hostname and header presence (deployment environment)

#### User Visibility

The current DSP mode is visible to users via:

- **Diagnostics Panel**: Detailed view with feature breakdown and recommendations
- **Console Logs**: Developer-friendly capability report on startup
- **Diagnostic Events**: Warnings logged for fallback modes

Example console output:

```
🚀 DSP Environment Capabilities {
  mode: "shared-array-buffer",
  environment: "custom-headers",
  performance: "Optimal performance: Zero-copy transfers, 10+ GB/s throughput",
  features: { sharedArrayBuffer: true, crossOriginIsolated: true, ... }
}
```

#### Deployment Recommendations

**For Optimal Performance (SharedArrayBuffer Mode)**:

Deploy to a platform that supports custom HTTP headers:

- **Vercel**: Add `vercel.json` with headers configuration
- **Netlify**: Add `_headers` file to repository
- **Cloudflare Pages**: Configure headers in dashboard
- **Custom Server**: Set COOP and COEP headers in web server config

Example headers configuration:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**For GitHub Pages Deployment (MessageChannel Mode)**:

The application will automatically fall back to MessageChannel mode. Users will see:

- Warning about reduced performance
- Recommendation to deploy on platforms supporting custom headers
- Links to migration guides

See **ADR-0028: DSP Environment Detection and Fallback System** for implementation details.

## State & Persistence

rad.io employs a **multi-tier state management architecture** that balances performance, persistence requirements, and data lifecycle needs. Understanding which mechanism to use for different types of state is critical for maintainability and proper data handling.

### State Lifecycle Categories

**Long-term Persistent State** (survives app reloads, browser sessions, and device changes):

- **Purpose**: User preferences and discovered data that should persist indefinitely
- **Mechanism**: IndexedDB or localStorage
- **Scope**: Browser-wide, domain-scoped
- **Expiration**: Manual deletion or age-based pruning

**Ephemeral State** (cleared on page reload or component unmount):

- **Purpose**: UI interaction state, temporary data, runtime-only values
- **Mechanism**: Zustand (in-memory) or React hooks
- **Scope**: Component or app-wide (memory only)
- **Expiration**: Page reload or component unmount

### State Taxonomy with Examples

| State Type    | Storage Mechanism      | Location                                | Example Data                              | Survives Reload?  |
| ------------- | ---------------------- | --------------------------------------- | ----------------------------------------- | ----------------- |
| **Long-term** | IndexedDB              | `src/utils/atscChannelStorage.ts`       | Scanned ATSC channels with signal quality | ✅ Yes            |
| **Long-term** | IndexedDB              | `src/lib/recording/recording-storage.ts`| IQ recording data (binary, chunked)       | ✅ Yes            |
| **Long-term** | localStorage           | `src/utils/epgStorage.ts`               | Electronic Program Guide (EPG) data       | ✅ Yes (24hr max) |
| **Long-term** | Zustand + localStorage | `src/store/slices/settingsSlice.ts`     | User preferences (FFT size, color scheme) | ✅ Yes            |
| **Ephemeral** | Zustand (no persist)   | `src/store/slices/frequencySlice.ts`    | Current VFO frequency                     | ❌ No             |
| **Ephemeral** | Zustand (no persist)   | `src/store/slices/deviceSlice.ts`       | Connected SDR devices                     | ❌ No             |
| **Ephemeral** | Zustand (no persist)   | `src/store/slices/notificationSlice.ts` | Toast notifications                       | ❌ No             |
| **Ephemeral** | Zustand (no persist)   | `src/store/slices/diagnosticsSlice.ts`  | Performance metrics, DSP capabilities     | ❌ No             |
| **Ephemeral** | React hooks            | `src/hooks/useATSCScanner.ts`           | Active scan state, progress               | ❌ No             |
| **Ephemeral** | React hooks            | `src/hooks/useEPG.ts`                   | Search query, filter selections           | ❌ No             |

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

**Example**: IQ Recording Storage

```typescript
// src/lib/recording/recording-manager.ts
// Persistence: IndexedDB (long-term, survives browser restart)
// Handles large binary IQ recordings with chunking

import { recordingManager } from "@/lib/recording";

// Save a recording from IQRecorder
const recording = iqRecorder.getRecording();
const id = await recordingManager.saveRecording(recording);
// Automatically chunks data into 10MB blobs

// List all recordings (metadata only for performance)
const recordings = await recordingManager.listRecordings();
// Returns: [{ id, frequency, timestamp, duration, size }]

// Load a specific recording with samples
const loaded = await recordingManager.loadRecording(id);
// Returns: { id, metadata, samples: IQSample[] }

// Check storage usage before saving
const usage = await recordingManager.getStorageUsage();
// Returns: { used: number, quota: number, percent: number }
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data: channelData,
      }),
    );
  }
}
```

#### 3. Zustand with localStorage (Application Preferences)

**Use for**: User preferences, UI settings, cross-component state with persistence

**Characteristics**:

- React-friendly state management
- Selective persistence via middleware
- Type-safe with TypeScript
- Performance-optimized (fine-grained subscriptions)
- Persists to localStorage automatically (survives browser restart)

**Example**: Settings Slice

```typescript
// src/store/slices/settingsSlice.ts
// Persistence: Zustand + localStorage (long-term, survives browser restart)
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
  },
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
  setFrequencyHz: (hz) => set({ frequencyHz: hz }),
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
// Persistence: None (ephemeral runtime state during active scan)
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

#### 3. Does the data need reactive state management across components?

- **Yes** → Use Zustand + localStorage†
- **No** → Use plain localStorage (with namespace)

†**Note:** localStorage is always shared across all tabs in the same domain. "Zustand + localStorage" provides reactive state management within each tab, while the data persists to shared localStorage and will be loaded when a new tab opens. Each tab maintains its own Zustand state instance (not synchronized in real-time). If you need true tab isolation where data is not accessible from other tabs, use `sessionStorage` instead of `localStorage`.

#### 4. Is it component-specific or app-wide?

- **Component-specific** → React hooks (useState, useReducer)
- **App-wide** → Zustand slice

#### Storage Key Naming Conventions

- IndexedDB database: `rad-io-{feature}` (e.g., `rad-io-atsc-channels`, `rad-io-recordings`)
- localStorage key: `rad.{feature}.v{version}` (e.g., `rad.settings.v1`)
  - **Note:** Some legacy features may use different key formats (e.g., `rad_io_epg_data` in `epgStorage.ts` uses underscores and no version). New features should follow the documented convention. When migrating legacy keys, ensure backward compatibility.
- Zustand store: Export from `src/store/index.ts` with typed hooks

**Example**: The IQ recording storage uses IndexedDB database `rad-io-recordings` with two object stores: `recordings` (full data) and `recordings-meta` (quick queries).

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
