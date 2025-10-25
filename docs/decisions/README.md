# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the SDR Explorer web application.

## What are ADRs?

Architecture Decision Records document significant architectural decisions made during the development of this project. Each ADR captures the context, decision, and consequences of a choice, serving as historical record and onboarding material.

## Index of Decisions

| ADR                                                        | Title                                               | Status   | Date |
| ---------------------------------------------------------- | --------------------------------------------------- | -------- | ---- |
| [0001](./0001-architecture-decision-records.md)            | Architecture Decision Records (Meta)                | Accepted | 2024 |
| [0002](./0002-web-worker-dsp-architecture.md)              | Web Worker DSP Architecture                         | Accepted | 2024 |
| [0003](./0003-webgl2-webgpu-gpu-acceleration.md)           | WebGL2/WebGPU for GPU Acceleration                  | Accepted | 2024 |
| [0004](./0004-signal-processing-library-selection.md)      | Signal Processing Library Selection                 | Accepted | 2024 |
| [0005](./0005-storage-strategy-recordings-state.md)        | Storage Strategy for Recordings and State           | Accepted | 2024 |
| [0006](./0006-testing-strategy-framework-selection.md)     | Testing Strategy and Framework Selection            | Accepted | 2024 |
| [0007](./0007-type-safety-validation-approach.md)          | Type Safety and Validation Approach                 | Accepted | 2024 |
| [0008](./0008-web-audio-api-architecture.md)               | Web Audio API Architecture                          | Accepted | 2024 |
| [0009](./0009-state-management-pattern.md)                 | State Management Pattern                            | Accepted | 2024 |
| [0010](./0010-offline-first-architecture.md)               | Offline-First Architecture                          | Accepted | 2024 |
| [0011](./0011-error-handling-resilience-strategy.md)       | Error Handling and Resilience Strategy              | Accepted | 2024 |
| [0012](./0012-parallel-fft-worker-pool.md)                 | Parallel FFT Worker Pool for Multi-Range Processing | Accepted | 2024 |
| [0013](./0013-automatic-signal-detection-system.md)        | Automatic Signal Detection System                   | Accepted | 2024 |
| [0014](./0014-automatic-frequency-scanning.md)             | Automatic Frequency Scanning Implementation         | Accepted | 2024 |
| [0015](./0015-visualization-rendering-strategy.md)         | Visualization Rendering Strategy                    | Accepted | 2024 |
| [0016](./0016-viridis-colormap-waterfall-visualization.md) | Viridis Colormap for Waterfall Visualization        | Accepted | 2024 |
| [0017](./0017-comprehensive-accessibility-patterns.md)     | Comprehensive Accessibility Pattern Implementation  | Accepted | 2024 |

## Key Architectural Decisions

### Core Architecture

- **Web Workers** for all DSP operations to keep UI responsive
- **WebGL2** for hardware-accelerated visualizations
- **Zustand** for state management with minimal boilerplate
- **IndexedDB** for large binary data (recordings)
- **spark.kv** for application state persistence

### DSP Pipeline

- **fft.js** for pure JavaScript FFT implementation
- **Vendored dsp.js** (modernized) for DSP primitives
- **Custom demodulators** for SDR-specific algorithms
- **AudioWorklet** for low-latency audio demodulation

### Quality & Reliability

- **Vitest** for unit and integration testing
- **Playwright** for end-to-end testing
- **Zod** for runtime validation at boundaries
- **TypeScript strict mode** for compile-time safety
- **Error boundaries** and graceful degradation

### Performance Optimizations

- **Worker pool** for parallel FFT computation
- **Texture streaming** for WebGL visualizations
- **Ring buffers** for audio to prevent underruns
- **Priority queue** for task scheduling
- **Transferable objects** for zero-copy messaging

### User Features

- **Automatic signal detection** with classification
- **Adaptive frequency scanning** with multiple strategies
- **Multiple device support** (RTL-SDR, HackRF)
- **Offline-first** with Service Worker caching
- **Recording** with metadata and thumbnails

## How to Read These ADRs

1. **Start with ADR-0001** to understand the ADR process itself
2. **Read ADR-0002, 0003, 0004** to understand core architecture (Workers, WebGL, DSP)
3. **Read topically** based on what you're working on:
   - Working on device support? → ADR-0005, 0011
   - Working on visualizations? → ADR-0003, 0015
   - Working on audio? → ADR-0008
   - Working on state? → ADR-0009, 0005
   - Working on testing? → ADR-0006
   - Working on scanning? → ADR-0012, 0013, 0014

## ADR Lifecycle

- **Proposed**: Under discussion, not yet decided
- **Accepted**: Decision made and implemented
- **Deprecated**: No longer relevant but kept for history
- **Superseded**: Replaced by a newer ADR (linked)

## Making Changes

If you need to make a significant architectural change:

1. Create a new ADR with the next sequential number
2. Use the MADR template (see ADR-0001)
3. Document context, alternatives, decision, and consequences
4. If superseding an existing ADR, update both with cross-references
5. Update this index

## References

- [MADR - Markdown Architecture Decision Records](https://adr.github.io/madr/)
- [ADR GitHub Organization](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) by Michael Nygard
