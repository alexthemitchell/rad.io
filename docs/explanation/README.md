# Explanation Documentation

These documents help you understand the "why" behind rad.io's design, architecture, and technical decisions. They provide context, rationale, and conceptual background.

## Core Concepts

- **[SDR Architecture Overview](./sdr-architecture-overview.md)** - Understanding the complete system design
- **[WebUSB and Browser Integration](./webusb-browser-integration.md)** - How browser APIs enable SDR
- **[DSP Pipeline Explained](./dsp-pipeline-explained.md)** - Signal processing flow and design
- **[Real-Time Visualization Strategy](./visualization-strategy.md)** - Why we use WebGL, WebGPU, and Canvas

## Design Decisions

See the [Architecture Decision Records](../decisions/) for detailed technical decisions:

- **[ADR-0001: Using Architecture Decision Records](../decisions/0001-architecture-decision-records.md)**
- **[ADR-0002: Web Worker DSP Architecture](../decisions/0002-web-worker-dsp-architecture.md)**
- **[ADR-0003: WebGL2/WebGPU GPU Acceleration](../decisions/0003-webgl2-webgpu-gpu-acceleration.md)**
- [View all ADRs →](../decisions/)

## Key Architectural Topics

- **[Why TypeScript-First](./why-typescript-first.md)** - Benefits of type-safe SDR development
- **[Memory Management Strategy](./memory-management-strategy.md)** - Handling large buffers efficiently
- **[State Management Patterns](./state-management-patterns.md)** - React state and device coordination
- **[Testing Philosophy](./testing-philosophy.md)** - Why we test the way we do

## Technology Choices

- **[Why Web Workers for DSP](./why-web-workers-dsp.md)** - Offloading computation from UI thread
- **[Why WebAssembly](./why-webassembly.md)** - Performance benefits and trade-offs
- **[Browser API Selection](./browser-api-selection.md)** - Choosing WebUSB, Web Audio, WebGL
- **[Build Tool Decisions](./build-tool-decisions.md)** - Webpack, TypeScript, and toolchain choices

## SDR Concepts Explained

- **[Understanding I/Q Samples](./understanding-iq-samples.md)** - Complex signal representation
- **[Frequency Domain vs Time Domain](./frequency-vs-time-domain.md)** - When to use each
- **[Modulation and Demodulation](./modulation-demodulation-explained.md)** - How information is encoded
- **[Sample Rate and Bandwidth](./sample-rate-bandwidth.md)** - Key relationships explained

## About This Section

**Understanding-Oriented**: These docs explain concepts and provide context, not step-by-step instructions.

**Conceptual**: We focus on the "why" and "how it works" rather than "how to do it."

**Background and Context**: Read these to deepen your understanding of the system's design.

## Looking for Something Else?

- **[Tutorials](../tutorials/)** - Step-by-step learning guides
- **[How-To Guides](../how-to/)** - Solve specific problems
- **[Reference Documentation](../reference/)** - API details and specifications
- **[Architecture Documentation](../../ARCHITECTURE.md)** - Complete system architecture
