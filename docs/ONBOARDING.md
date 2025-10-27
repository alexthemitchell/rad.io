# New Contributor Onboarding Guide

Welcome to rad.io! This guide will help you get started with testing and contributing to the SDR visualizer.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Chrome or Edge browser (for WebUSB support)
- Git

### Initial Setup

```bash
# Clone repository
git clone https://github.com/alexthemitchell/rad.io.git
cd rad.io

# Install dependencies
npm install

# Run quality checks
npm run lint
npm run type-check
npm test

# Start development server
npm run dev
```

Visit https://localhost:8080 (note: HTTPS is required for WebUSB).

## Understanding the Project

### Architecture Overview

rad.io has a clean, layered architecture:

```
UI Layer (React Pages)
    ↓
Visualization Components (IQConstellation, Spectrogram, etc.)
    ↓
Renderers (WebGL/Canvas2D)
    ↓
Data Sources (Hardware/Mock/Simulated)
```

**Key Concept**: Visualizations don't care where data comes from. They work identically with:

- Real SDR hardware (HackRF One)
- Mock devices (for CI/E2E testing)
- Simulated sources (for development)

### Project Structure

```
rad.io/
├── src/
│   ├── visualization/          # Visualization module
│   │   ├── components/         # Reusable viz components
│   │   ├── renderers/          # Rendering backends
│   │   ├── SimulatedSource.ts  # Test data source
│   │   └── ReplaySource.ts     # Recorded data playback
│   ├── hackrf/                 # HackRF device implementation
│   ├── models/                 # Device models (including MockSDR)
│   ├── components/             # UI components
│   ├── pages/                  # Page components
│   └── utils/                  # Utilities (DSP, WebGL, etc.)
├── e2e/                        # End-to-end tests
├── docs/                       # Documentation
│   ├── testing/                # Testing guides
│   ├── reference/              # Technical references
│   └── decisions/              # Architecture decisions
└── assembly/                   # WebAssembly DSP code
```

## Running Tests

### Two Testing Modes

rad.io supports **two testing modes** to accommodate different development scenarios:

#### 1. Simulated Mode (Default) ✅

**No hardware required** - uses simulated data sources

```bash
# Unit tests (Jest)
npm test                    # All tests
npm test -- Spectrogram     # Specific test
npm test -- --coverage      # With coverage

# E2E tests with mock device (Playwright)
npm run test:e2e            # CI-friendly tests
npm run test:e2e:ui         # Interactive mode
```

**When to use**: Development, CI/CD, most testing scenarios

#### 2. Real Device Mode 🔌

**Requires HackRF One hardware** - tests with actual SDR

```bash
# First-time setup: Pair your HackRF
# 1. Connect HackRF via USB
# 2. Visit https://localhost:8080/monitor
# 3. Click "Connect Device" button
# 4. Select HackRF from browser dialog

# Run E2E tests with real hardware
export E2E_REAL_HACKRF=1    # Unix/Mac
# OR
$env:E2E_REAL_HACKRF = "1"  # Windows PowerShell

npm run test:e2e
```

**When to use**: Hardware integration testing, debugging hardware issues

### Test Organization

```
Unit Tests (Jest)
├── Component Tests          # UI component behavior
├── Utility Tests           # DSP, WebGL, helpers
├── Model Tests             # Device models
└── Integration Tests       # Multi-module interactions

E2E Tests (Playwright)
├── Mock Device Tests       # Simulated hardware (CI)
├── Real Device Tests       # Actual hardware (@real tag)
└── Accessibility Tests     # WCAG 2.1 AA compliance
```

## Testing Visualizations

### Writing a Visualization Test

```typescript
// src/visualization/components/__tests__/MyViz.test.tsx
import { render, screen } from '@testing-library/react';
import { generateIQSamples } from '../../utils/signalGenerator';
import { MyVisualization } from '../MyVisualization';

describe('MyVisualization', () => {
  test('renders with valid samples', () => {
    // Generate test data
    const samples = generateIQSamples({
      pattern: 'sine',
      sampleRate: 2048000,
      frequency: 100000,
      amplitude: 0.8,
      duration: 0.1,
    });

    // Render component
    render(<MyVisualization samples={samples} width={800} height={600} />);

    // Verify rendering
    const canvas = screen.getByRole('img');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('aria-label');
  });
});
```

### Test Data Patterns

The `signalGenerator` utility provides realistic test signals:

```typescript
import { generateIQSamples } from "../utils/signalGenerator";

// Simple sine wave
const sine = generateIQSamples({
  pattern: "sine",
  frequency: 100000,
  sampleRate: 2048000,
});

// QPSK modulation (digital)
const qpsk = generateIQSamples({
  pattern: "qpsk",
  sampleRate: 2048000,
});

// FM modulation (analog)
const fm = generateIQSamples({
  pattern: "fm",
  sampleRate: 2048000,
});

// White noise
const noise = generateIQSamples({
  pattern: "noise",
  sampleRate: 2048000,
});

// Multiple carriers
const multiTone = generateIQSamples({
  pattern: "multi-tone",
  sampleRate: 2048000,
});
```

### Testing with Simulated Data Source

For integration tests that need streaming data:

```typescript
import { SimulatedSource } from '../visualization/SimulatedSource';

test('visualization updates with streaming data', async () => {
  const source = new SimulatedSource({
    pattern: 'sine',
    sampleRate: 2048000,
    amplitude: 0.8,
  });

  const samples: IQSample[] = [];

  await source.startStreaming((chunk) => {
    samples.push(...chunk);
  });

  // Wait for data
  await waitFor(() => {
    expect(samples.length).toBeGreaterThan(0);
  });

  // Test your visualization
  render(<MyVisualization samples={samples} />);

  await source.stopStreaming();
});
```

## Writing E2E Tests

### Mock Device Tests (CI-Friendly)

These tests run in CI without hardware:

```typescript
// e2e/my-feature.spec.ts
import { test, expect } from "@playwright/test";

test("visualizations work with mock device", async ({ page }) => {
  // Navigate with mock flag
  await page.goto("https://localhost:8080/monitor?mockSdr=1");

  // Start reception
  await page.click('button:has-text("Start reception")');

  // Wait for visualizations
  await page.waitForSelector('canvas[role="img"]');

  // Verify multiple visualizations present
  const canvases = await page.locator('canvas[role="img"]').count();
  expect(canvases).toBeGreaterThanOrEqual(3);

  // Stop reception
  await page.click('button:has-text("Stop reception")');
});
```

### Real Device Tests (Hardware Required)

These tests only run when explicitly enabled:

```typescript
// e2e/hardware.spec.ts
import { test, expect } from "@playwright/test";

test("receives real signals from HackRF", async ({ page }) => {
  // Skip if hardware not available
  if (!process.env.E2E_REAL_HACKRF) {
    test.skip();
  }

  await page.goto("https://localhost:8080/monitor");

  // Wait for auto-connect (device must be pre-paired)
  await page.waitForSelector(
    'button:has-text("Start reception"):not([disabled])',
    { timeout: 10000 },
  );

  // Start reception
  await page.click('button:has-text("Start reception")');

  // Verify real signal processing
  const isReceiving = await page.evaluate(() => window.dbgReceiving);
  expect(isReceiving).toBe(true);
});
```

## Development Workflow

### Typical Development Cycle

1. **Write failing test**

   ```bash
   npm test -- MyComponent
   ```

2. **Implement feature**

   ```typescript
   // Edit src/components/MyComponent.tsx
   ```

3. **Run tests**

   ```bash
   npm test -- MyComponent
   ```

4. **Check quality gates**

   ```bash
   npm run lint          # ESLint
   npm run type-check    # TypeScript
   npm test -- --coverage # Test coverage
   ```

5. **Test in browser**

   ```bash
   npm run dev
   # Visit https://localhost:8080
   ```

6. **Run E2E tests**
   ```bash
   npm run test:e2e
   ```

### Using the Demo Page

The visualization demo page is useful for visual testing:

```bash
npm run dev
# Visit https://localhost:8080/demo
```

Features:

- All visualization components in one place
- Live data from SimulatedSource
- Different signal patterns (sine, QPSK, FM, noise)
- Adjustable parameters
- No hardware required

## Understanding Data Flow

### From Hardware to Display

```
1. Data Acquisition
   HackRF Hardware
     ↓ WebUSB API
   Raw USB Packets (Int8Array)
     ↓ parseSamples()
   IQSample[] = [{ I: -1..1, Q: -1..1 }, ...]

2. Frame Processing
   IQSample[]
     ↓ DSP Pipeline
   FFT / Amplitude / Phase calculations
     ↓
   ProcessedFrame { fft: Float32Array, ... }

3. Rendering
   ProcessedFrame
     ↓ WebGL or Canvas2D
   GPU/CPU rendering
     ↓
   Canvas Element

4. Display
   Canvas
     ↓ Browser Compositor
   Screen
```

### Data Types

**IQSample** - Core data type:

```typescript
interface IQSample {
  I: number; // In-phase: -1.0 to 1.0
  Q: number; // Quadrature: -1.0 to 1.0
}
```

**Why I/Q?**

- Represents both amplitude and phase
- Required for digital modulation (QPSK, QAM, etc.)
- Enables frequency shifting in software
- Standard in SDR systems

## Common Tasks

### Add a New Visualization

1. Create component in `src/visualization/components/`
2. Add tests in `__tests__/` subdirectory
3. Export from `src/visualization/components/index.ts`
4. Add to demo page (`src/pages/VisualizationDemo.tsx`)

See: [Extending Visualizations](./VISUALIZATION_ARCHITECTURE.md#extending-visualizations)

### Debug a Flaky Test

```bash
# Run test multiple times
for i in {1..20}; do npm test -- MyTest || break; done

# Run with single worker
npm test -- --maxWorkers=1 MyTest

# Run with verbose output
npm test -- --verbose MyTest
```

See: [Test Reliability Guide](./testing/TEST_RELIABILITY.md)

### Test with Real Hardware

```bash
# 1. Pair device (one-time)
npm run dev
# Visit https://localhost:8080/monitor
# Click "Connect Device"

# 2. Run E2E tests
export E2E_REAL_HACKRF=1
npm run test:e2e
```

See: [E2E Testing Guide](./e2e-tests.md)

### Profile Performance

```bash
# Track test performance
TRACK_PERFORMANCE=1 npm test

# Check heap usage
npm test -- --logHeapUsage

# Browser profiling
npm run dev
# Open DevTools > Performance > Record
```

See: [Performance Optimization](./VISUALIZATION_ARCHITECTURE.md#performance-optimization)

## Key Documentation

### Essential Reading

- **[Visualization Architecture](./VISUALIZATION_ARCHITECTURE.md)** - Detailed architecture guide
- **[Testing Strategy](./testing/TEST_STRATEGY.md)** - Comprehensive testing guide
- **[E2E Testing](./e2e-tests.md)** - Hardware and mock device testing
- **[Architecture Overview](../ARCHITECTURE.md)** - Project-wide architecture

### Reference Documentation

- **[DSP Fundamentals](./reference/dsp-fundamentals.md)** - Signal processing basics
- **[WebGL Visualization](./reference/webgl-visualization.md)** - GPU rendering guide
- **[Hardware Integration](./reference/hardware-integration.md)** - Device integration
- **[Test Data Generators](./testing/TEST_DATA_GENERATORS.md)** - Signal generation

### Architecture Decisions

- **[ADR-0015](./decisions/0015-visualization-rendering-strategy.md)** - Rendering strategy
- **[ADR-0020](./decisions/0020-e2e-testing-hardware-mock.md)** - Testing approach
- **[ADR-0019](./decisions/0019-viridis-colormap-waterfall-visualization.md)** - Colormap choice

## Quality Standards

All contributions must meet:

✅ **Lint**: `npm run lint` passes
✅ **Type Check**: `npm run type-check` passes  
✅ **Tests**: `npm test` passes with coverage thresholds
✅ **Build**: `npm run build` succeeds
✅ **E2E**: `npm run test:e2e` passes

### Coverage Requirements

- **Global minimum**: 38% (statements, lines), 35% (branches), 39% (functions)
- **New code**: 80% patch coverage (Codecov)
- **Critical modules**: 57-96% (see `jest.config.ts`)

## Getting Help

### Debug Checklist

1. **Tests failing?** Check browser console for errors
2. **WebGL issues?** Verify browser support, check fallback to Canvas2D
3. **Mock device not working?** Ensure `?mockSdr=1` in URL
4. **Real device issues?** Check device paired, see logs in console
5. **Performance problems?** Profile with DevTools, check sample rate

### Common Issues

**Canvas not rendering:**

- Check samples array not empty
- Verify canvas dimensions > 0
- Look for JavaScript errors in console

**E2E tests timing out:**

- Add appropriate `waitFor()` calls
- Increase timeout in Playwright config
- Check dev server is running

**Coverage too low:**

- Add tests for new code
- Check coverage report: `open coverage/lcov-report/index.html`
- Focus on critical paths first

### Ask for Help

- **GitHub Issues**: Bug reports, feature requests
- **Pull Request Comments**: Code review feedback
- **Documentation**: Start here!

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

## Next Steps

Now that you're set up:

1. **Explore the codebase**: Start with `src/visualization/`
2. **Run the demo**: Visit https://localhost:8080/demo
3. **Try the tests**: Run `npm test` and `npm run test:e2e`
4. **Read the architecture docs**: Understand the design patterns
5. **Pick an issue**: Find "good first issue" labels
6. **Make your first contribution**: Follow the workflow above

Welcome to the rad.io community! 🎉
