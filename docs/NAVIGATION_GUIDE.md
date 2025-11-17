# Documentation Navigation Guide

This guide helps you find the right documentation for your needs in the rad.io documentation system.

## 🎯 New to ATSC Digital TV?

**Start here**: [**ATSC Digital TV Golden Path Guide**](./tutorials/atsc-golden-path.md)

This comprehensive guide walks you through the complete end-to-end workflow: Connect SDR → Scan channels → Tune/Play → View EPG → Enable captions → Monitor signal health.

**Perfect for**: First-time users, ATSC newcomers, anyone wanting a structured learning path.

---

## Quick Decision Tree

```
What do you want to do?
│
├─ "I'm new and want to learn" ────────────→ [Tutorials](./tutorials/)
│                                             Start with Getting Started
│
├─ "I need to do a specific task" ─────────→ [How-To Guides](./how-to/)
│                                             Find your task in the index
│
├─ "I need to look up API details" ────────→ [Reference](./reference/)
│                                             Search by API name or topic
│
└─ "I want to understand why/how" ─────────→ [Explanation](./explanation/)
                                              Read architectural overviews
```

## By Experience Level

### Absolute Beginner

**You've never used rad.io before.**

1. [Getting Started Tutorial](./tutorials/01-getting-started.md)
2. [Your First Visualization](./tutorials/02-first-visualization.md)
3. [SDR Basics Reference](./reference/sdr-basics.md)
4. [SDR Architecture Overview](./explanation/sdr-architecture-overview.md)

### Developer Adding Features

**You want to add a new device, visualization, or demodulator.**

1. How-To: [Add a New SDR Device](./how-to/add-new-sdr-device.md)
2. Reference: [Hardware Integration](./reference/hardware-integration.md)
3. Explanation: [WebUSB Integration](./explanation/webusb-browser-integration.md)

### Performance Optimization

**Your code works but is slow.**

1. How-To: [Optimize DSP Performance](./how-to/optimize-dsp-performance.md)
2. Reference: [Performance Optimization](./reference/performance-optimization.md)
3. Reference: [Performance Benchmarks](./reference/performance-benchmarks.md)

### Debugging Issues

**Something isn't working correctly.**

1. How-To: [Debug WebUSB Issues](./how-to/debug-webusb.md)
2. Reference: [HackRF Troubleshooting](./reference/hackrf-troubleshooting.md)
3. Reference: [Common Use Cases](./reference/common-use-cases.md)

### Understanding Design

**You want to know why things are built this way.**

1. Explanation: [SDR Architecture Overview](./explanation/sdr-architecture-overview.md)
2. [Architecture Decision Records](./decisions/)
3. Root: [ARCHITECTURE.md](../ARCHITECTURE.md)

## By Topic

### Hardware Integration

- Tutorial: [Getting Started](./tutorials/01-getting-started.md) - Initial hardware setup
- How-To: [Add a New SDR Device](./how-to/add-new-sdr-device.md)
- How-To: [Debug WebUSB Issues](./how-to/debug-webusb.md)
- Reference: [Hardware Integration](./reference/hardware-integration.md)
- Explanation: [WebUSB Integration](./explanation/webusb-browser-integration.md)

### Signal Processing (DSP)

- Tutorial: [Your First Visualization](./tutorials/02-first-visualization.md)
- How-To: [Optimize DSP Performance](./how-to/optimize-dsp-performance.md)
- Reference: [DSP Fundamentals](./reference/dsp-fundamentals.md)
- Reference: [FFT Implementation](./reference/fft-implementation.md)
- Reference: [Demodulation Algorithms](./reference/demodulation-algorithms.md)

### Visualization

- Tutorial: [Your First Visualization](./tutorials/02-first-visualization.md)
- Reference: [WebGL Visualization](./reference/webgl-visualization.md)
- Root: [VISUALIZATION_ARCHITECTURE.md](../docs/VISUALIZATION_ARCHITECTURE.md)
- Root: [VISUALIZATION_QUICK_REF.md](../docs/VISUALIZATION_QUICK_REF.md)

### Testing

- Root: [Testing Strategy](./testing/TEST_STRATEGY.md)
- Root: [E2E Testing](./e2e-tests.md)
- Root: [Accessibility Testing](./ACCESSIBILITY-TESTING-GUIDE.md)

### Accessibility

- Root: [ACCESSIBILITY.md](../ACCESSIBILITY.md)
- Root: [Accessibility Testing Guide](./ACCESSIBILITY-TESTING-GUIDE.md)

## Special Paths

### Contributing to rad.io

1. [New Contributor Onboarding](./ONBOARDING.md)
2. [CONTRIBUTING.md](../CONTRIBUTING.md)
3. [Testing Strategy](./testing/TEST_STRATEGY.md)
4. [Code of Conduct](../CODE_OF_CONDUCT.md)

### Using rad.io

1. [README.md Quick Start](../README.md#quick-start)
2. [README.md Usage Guide](../README.md#usage-guide)
3. Reference: [Common Use Cases](./reference/common-use-cases.md)

### Deployment

1. [DEPLOYMENT.md](./DEPLOYMENT.md)
2. Root: [Build Optimization](./BUILD_OPTIMIZATION.md)

## Documentation Structure

```
docs/
├── README.md                    # Main documentation index (start here!)
├── NAVIGATION_GUIDE.md         # This file
│
├── tutorials/                   # Learning-oriented
│   ├── README.md
│   ├── 01-getting-started.md
│   └── 02-first-visualization.md
│
├── how-to/                      # Task-oriented
│   ├── README.md
│   ├── add-new-sdr-device.md
│   ├── optimize-dsp-performance.md
│   └── debug-webusb.md
│
├── reference/                   # Information-oriented
│   ├── README.md
│   ├── sdr-basics.md
│   ├── dsp-fundamentals.md
│   └── ... (many more)
│
├── explanation/                 # Understanding-oriented
│   ├── README.md
│   ├── sdr-architecture-overview.md
│   └── webusb-browser-integration.md
│
├── decisions/                   # Architecture Decision Records (ADRs)
│   ├── 0001-architecture-decision-records.md
│   └── ... (24 ADRs)
│
└── testing/                     # Testing documentation
    ├── README.md
    └── ...
```

## Finding What You Need

### Search by Keyword

#### Frequency

- Reference: [SDR Basics](./reference/sdr-basics.md)
- Reference: [Frequency Allocations](./reference/frequency-allocations.md)

#### FFT

- Reference: [FFT Implementation](./reference/fft-implementation.md)
- How-To: [Optimize DSP Performance](./how-to/optimize-dsp-performance.md)

#### WebUSB

- Explanation: [WebUSB Integration](./explanation/webusb-browser-integration.md)
- How-To: [Debug WebUSB Issues](./how-to/debug-webusb.md)

#### Performance

- How-To: [Optimize DSP Performance](./how-to/optimize-dsp-performance.md)
- Reference: [Performance Optimization](./reference/performance-optimization.md)
- Reference: [Performance Benchmarks](./reference/performance-benchmarks.md)

#### Testing

- Root: [Testing Strategy](./testing/TEST_STRATEGY.md)
- Reference: [Test Strategy](./reference/test-strategy.md)

## External Resources

### Web Standards

- [WebUSB Specification](https://wicg.github.io/webusb/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

### SDR Background

- Reference: [SDR Basics](./reference/sdr-basics.md)
- Reference: [Modulation Types](./reference/modulation-types.md)
- Reference: [Frequency Allocations](./reference/frequency-allocations.md)

## Still Can't Find It?

1. **Search the docs**: Use Ctrl+F / Cmd+F in your editor
2. **Check the glossary**: [Glossary](./reference/glossary.md)
3. **Browse ADRs**: [Architecture Decision Records](./decisions/)
4. **Ask the community**: [GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)
5. **Open an issue**: [Report documentation gap](https://github.com/alexthemitchell/rad.io/issues/new)

## Tips for Effective Documentation Use

### For Learning

1. **Follow tutorials in order** - Don't skip steps
2. **Type the code yourself** - Don't just copy/paste
3. **Experiment** - Try variations of the examples
4. **Read explanations after tutorials** - Context helps understanding

### For Problem-Solving

1. **Check how-to guides first** - Quickest path to solution
2. **Reference docs for details** - When you need exact API info
3. **Don't reinvent** - Check existing code for patterns
4. **Ask for help** - Community knows common pitfalls

### For Contributing

1. **Read onboarding guide** - Sets up your environment correctly
2. **Follow code conventions** - Check CONTRIBUTING.md
3. **Write tests** - See testing documentation
4. **Update docs** - Document your changes

## Documentation Principles

This documentation follows the **[Diátaxis framework](https://diataxis.fr/)**:

- **Tutorials**: Teach concepts through hands-on projects
- **How-To Guides**: Solve specific practical problems
- **Reference**: Provide technical specifications
- **Explanation**: Build understanding of concepts

**Each type serves a different need. Use the right one for your goal.**

---

### Happy documenting! 📚✨
