# How-To Guides

These guides help you accomplish specific tasks in rad.io. Each guide assumes you have basic familiarity with the system and focuses on solving a particular problem.

## Device Integration

- **[Add a New SDR Device](./add-new-sdr-device.md)** - Implement support for a new hardware device
- **[Debug Device Connection Issues](./debug-device-connections.md)** - Troubleshoot WebUSB and device communication
- **[Configure Device Parameters](./configure-device-parameters.md)** - Set up gain, sample rate, and other settings

## Signal Processing

- **[Implement a Demodulation Algorithm](./implement-demodulation.md)** - Add custom demodulation methods
- **[Optimize DSP Performance](./optimize-dsp-performance.md)** - Improve processing speed and efficiency
- **[Use WebAssembly for DSP](./use-wasm-for-dsp.md)** - Leverage WASM for high-performance processing

## Visualization

- **[Create Custom Visualizations](./create-custom-visualizations.md)** - Build new visualization components
- **[Optimize Rendering Performance](./optimize-rendering.md)** - Improve FPS and reduce lag
- **[Switch Between WebGL and Canvas](./switch-renderers.md)** - Handle different rendering backends

## Testing

- **[Write Unit Tests for DSP Code](./write-dsp-tests.md)** - Test signal processing functions
- **[Mock Hardware Devices for Testing](./mock-hardware-devices.md)** - Create test doubles for SDR devices
- **[Run E2E Tests Without Hardware](./e2e-without-hardware.md)** - Use simulated devices for testing

## Debugging

- **[Debug WebUSB Issues](./debug-webusb.md)** - Solve USB communication problems
- **[Profile Performance Bottlenecks](./profile-performance.md)** - Identify and fix slow code
- **[Debug Audio Pipeline Issues](./debug-audio-pipeline.md)** - Troubleshoot Web Audio problems

## Accessibility

- **[Make Components Keyboard Accessible](./make-keyboard-accessible.md)** - Add keyboard navigation
- **[Add ARIA Labels](./add-aria-labels.md)** - Improve screen reader support
- **[Test Accessibility](./test-accessibility.md)** - Validate WCAG compliance

## About These Guides

**Task-Oriented**: Each guide solves a specific problem or accomplishes a particular goal.

**Assumes Knowledge**: These guides assume you're familiar with the basics. If you're new, start with the [Tutorials](../tutorials/).

**Goal-Focused**: We get straight to the point. For deeper understanding, see the [Explanation docs](../explanation/).

## Can't Find What You Need?

- Check the [Reference Documentation](../reference/) for API details
- See the [Tutorials](../tutorials/) for step-by-step learning
- Read the [Explanation docs](../explanation/) for conceptual understanding
- Search [existing issues](https://github.com/alexthemitchell/rad.io/issues)
