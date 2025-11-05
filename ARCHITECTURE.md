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
│ ├── dsp.ts # DSP algorithms
│ ├── WebGL.ts # WebGL utilities
│ └── **tests**/ # Utility tests
├── pages/ # Top-level pages
│ └── Visualizer.tsx # Main application
└── workers/ # Web Workers
└── visualization.worker.ts
\`\`\`

## Device Integration Framework

### Universal Interface: \`ISDRDevice\`

All SDR devices **must** implement the \`ISDRDevice\` interface defined in \`src/models/SDRDevice.ts\`. This ensures consistent behavior and enables plug-and-play device support.

See \`docs/DEVICE_INTEGRATION.md\` for a step-by-step guide to adding new devices.
