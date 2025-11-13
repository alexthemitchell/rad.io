# rad.io Architecture

## Table of Contents

1. [Overview](#overview)
2. [Core Architecture](#core-architecture)
3. [Device Integration Framework](#device-integration-framework)

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
│   ├── index.ts # Public API exports
│   ├── primitives.ts # Window, DC correction, AGC
│   ├── fft.ts # FFT operations
│   ├── filters.ts # Digital filters
│   ├── analysis.ts # Spectrum analysis
│   ├── conversions.ts # Format conversions
│   ├── types.ts # Shared DSP types
│   └── **tests**/ # DSP primitive tests
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
│              Application Layer                          │
│  • Demodulators (AM, FM, SSB, ATSC 8-VSB)              │
│  • Visualizations (Spectrum, Waterfall, IQ)            │
│  • Analysis Plugins (Signal Detection, Metrics)        │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────┐
│         Unified DSP Primitives Layer                    │
│  src/lib/dsp/                                           │
│  ├── primitives.ts  (windowing, DC correction, AGC)    │
│  ├── fft.ts        (FFT, IFFT, spectrum analysis)      │
│  ├── filters.ts    (FIR, IIR, resampling)              │
│  └── conversions.ts (Sample[] ↔ Float32Array)          │
└─────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ↓                         ↓
┌──────────────────────┐   ┌──────────────────────┐
│   TypeScript/JS      │   │   WASM (assembly/)   │
│   Reference Impl.    │   │   SIMD-optimized     │
│   (Fallback)         │   │   (Primary)          │
└──────────────────────┘   └──────────────────────┘
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

| Operation | Size | JS Performance | WASM Performance | Speedup |
|-----------|------|----------------|------------------|---------|
| FFT | 2048 pts | ~2ms | ~0.5ms | 4x |
| FFT | 8192 pts | ~8ms | ~2ms | 4x |
| DC Static | 1024 samples | ~0.3ms | ~0.1ms | 3x |
| DC IIR | 1024 samples | ~0.5ms | ~0.2ms | 2.5x |
| Hann Window | 1024 samples | ~0.2ms | ~0.05ms | 4x |

See **ADR-0026: Unified DSP Primitives Architecture** for detailed design decisions.

## Device Integration Framework

### Universal Interface: \`ISDRDevice\`

All SDR devices **must** implement the \`ISDRDevice\` interface defined in \`src/models/SDRDevice.ts\`. This ensures consistent behavior and enables plug-and-play device support.

See \`docs/DEVICE_INTEGRATION.md\` for a step-by-step guide to adding new devices.
