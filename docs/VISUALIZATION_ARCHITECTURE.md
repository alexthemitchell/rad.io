# Visualization Architecture Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture Layers](#architecture-layers)
3. [Data Flow](#data-flow)
4. [Visualization Components](#visualization-components)
5. [Rendering Strategies](#rendering-strategies)
6. [Testing Patterns](#testing-patterns)
7. [Performance Optimization](#performance-optimization)
8. [Extending Visualizations](#extending-visualizations)

## Overview

rad.io's visualization system is designed to provide real-time, high-performance rendering of SDR data. The architecture supports multiple data sources (live hardware, mock devices, recorded data) and multiple rendering backends (WebGL, Canvas2D) with graceful fallbacks.

### Key Design Principles

- **Data Source Abstraction**: Visualizations don't know whether data comes from real hardware, mock devices, or recorded files
- **Renderer Independence**: Components can render using WebGL, Canvas2D, or other backends with automatic fallback
- **Performance First**: GPU acceleration where available, optimized CPU fallback paths
- **Test-Friendly**: Architecture designed to support both simulated and real device testing

### Quick Links

- **Implementation**: [`src/visualization/`](../src/visualization/)
- **Test Data**: [`src/utils/signalGenerator.ts`](../src/utils/signalGenerator.ts)
- **Testing Guide**: [Testing Patterns](#testing-patterns)
- **E2E Setup**: [`docs/e2e-tests.md`](./e2e-tests.md)

## Architecture Layers

The visualization system consists of four main layers:

```
┌─────────────────────────────────────────────────────────┐
│                   UI Components                         │
│  (React components that display visualizations)         │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              Visualization Components                   │
│  (IQConstellation, Spectrogram, WaveformVisualizer)     │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   Renderers                             │
│  (WebGL, Canvas2D with automatic fallback)              │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                  Data Sources                           │
│  (HackRF, MockSDR, SimulatedSource, ReplaySource)       │
└─────────────────────────────────────────────────────────┘
```

### Layer Details

#### 1. UI Components Layer

React components that integrate visualizations into pages:

- **Monitor Page** (`src/pages/Monitor.tsx`): Main reception interface
- **Analysis Page** (`src/pages/Analysis.tsx`): Signal analysis tools
  (Former demo page has been removed; use Monitor for live examples.)

#### 2. Visualization Components Layer

Reusable visualization components in `src/visualization/components/`:

- **IQConstellation**: I/Q sample scatter plot
- **Spectrogram**: Time-frequency heatmap
- **WaveformVisualizer**: Time-domain amplitude display
- **FFTChart**: Frequency spectrum line chart
- **SpectrumExplorer**: Real-time spectrum with optional waterfall and signal highlights
- **Waterfall**: Scrolling waterfall display

#### 3. Renderers Layer

Rendering backends in `src/visualization/renderers/` and `src/utils/webgl.ts`:

- **WebGL Renderer**: GPU-accelerated, 60+ FPS
- **Canvas2D Renderer**: CPU fallback, 30+ FPS
- **Worker Renderer**: Offscreen rendering (future)

#### 4. Data Sources Layer

Abstract data providers in `src/visualization/` and `src/models/`:

- **HackRF Device** (`src/hackrf/HackRFOne.ts`): Real hardware
- **MockSDRDevice** (`src/models/MockSDRDevice.ts`): E2E testing
- **SimulatedSource** (`src/visualization/SimulatedSource.ts`): Development/testing
- **ReplaySource** (`src/visualization/ReplaySource.ts`): Recorded data playback

## Data Flow

### High-Level Flow

```
Device/Source → IQ Samples → Frame Processor → Renderer → Canvas → Display
```

### Detailed Flow

```
1. Data Acquisition
   ├─ HackRF Hardware → WebUSB → IQSamples
   ├─ MockSDRDevice → Synthetic IQ → IQSamples
   └─ SimulatedSource → Generated IQ → IQSamples

2. Frame Processing
   ├─ FFT Calculation (DSP)
   ├─ Power Spectrum Density
   ├─ Amplitude/Phase Extraction
   └─ Buffering/Windowing

3. Rendering
   ├─ WebGL Path (GPU)
   │  ├─ Vertex Shader
   │  ├─ Fragment Shader
   │  └─ Texture Operations
   │
   └─ Canvas2D Path (CPU)
      ├─ Context Operations
      ├─ Drawing Primitives
      └─ Image Data Manipulation

4. Display
   └─ Canvas Element → Browser Compositor → Screen
```

### Data Types

#### IQSample Interface

```typescript
interface IQSample {
  I: number; // In-phase component (-1.0 to 1.0)
  Q: number; // Quadrature component (-1.0 to 1.0)
}
```

#### DataSource Interface

```typescript
interface DataSource {
  startStreaming(callback: (samples: IQSample[]) => void): Promise<void>;
  stopStreaming(): Promise<void>;
  isStreaming(): boolean;
  getSampleRate(): number;
}
```

#### Frame Processor Interface

```typescript
interface FrameProcessor {
  process(samples: IQSample[]): ProcessedFrame;
}

interface ProcessedFrame {
  fft?: Float32Array; // FFT magnitudes in dB
  amplitudes?: Float32Array; // Time-domain amplitudes
  phases?: Float32Array; // Phase information
  metadata?: FrameMetadata;
}
```

## Visualization Components

### IQConstellation

**Purpose**: Display I/Q samples as scatter plot to visualize modulation patterns

**Location**: `src/visualization/components/IQConstellation.tsx`

**Rendering**: WebGL (gl.POINTS) with Canvas2D fallback

**Key Features**:

- Density-based alpha blending for overlapping points
- Automatic scaling based on sample range
- Grid overlay with axis labels
- Statistics display (sample count, range)

**Usage**:

```typescript
<IQConstellation
  samples={iqSamples}
  width={750}
  height={400}
/>
```

**Testing Pattern**:

```typescript
test('renders constellation with correct dimensions', () => {
  const samples = generateIQSamples({ /* config */ });
  render(<IQConstellation samples={samples} width={800} height={600} />);

  const canvas = screen.getByRole('img', { name: /constellation/i });
  expect(canvas).toHaveAttribute('width');
  expect(canvas).toHaveAttribute('height');
});
```

### Spectrogram

**Purpose**: Display time-frequency heatmap using STFT (Short-Time Fourier Transform)

**Location**: `src/visualization/components/Spectrogram.tsx`

**Rendering**: WebGL (texture-based) with Canvas2D fallback

**Key Features**:

- Viridis colormap for perceptually uniform color mapping
- Dynamic range compression (5% threshold)
- Configurable frequency range
- Scrolling time axis

### Spectrum Explorer

**Purpose**: Unified spectrum line plot with optional waterfall and overlays

**Location**: `src/visualization/components/SpectrumExplorer.tsx`

**Rendering**: Canvas2D for spectrum; Spectrogram component for optional waterfall

**Key Features**:

- Toggleable waterfall to reduce CPU/GPU load (`showWaterfall`)
- Average and Peak-Hold overlays
- Interactive pan/zoom, click-to-mark, double-click to tune
- Signal highlights via `signals` prop with glow; FM stations annotated with RDS when available

**Usage**:

```tsx
<SpectrumExplorer
  samples={vizSamples}
  sampleRate={sampleRate}
  centerFrequency={frequency}
  fftSize={fftSize}
  showWaterfall={false}
  signals={[{ freqHz: 101.1e6, label: "KFOG", strength: 0.9 }]}
  onTune={(hz) => console.log("Tune to", hz)}
/>
```

**Usage**:

```typescript
<Spectrogram
  samples={iqSamples}
  sampleRate={2048000}
  width={750}
  height={800}
  fftSize={1024}
/>
```

**Testing Pattern**:

```typescript
test('updates spectrogram with new samples', async () => {
  const { rerender } = render(
    <Spectrogram samples={samples1} sampleRate={2048000} />
  );

  // Update with new samples
  rerender(<Spectrogram samples={samples2} sampleRate={2048000} />);

  // Verify canvas updated
  await waitFor(() => {
    const canvas = screen.getByRole('img');
    expect(canvas).toBeInTheDocument();
  });
});
```

### WaveformVisualizer

**Purpose**: Display time-domain amplitude envelope

**Location**: `src/visualization/components/WaveformVisualizer.tsx`

**Rendering**: WebGL (gl.LINE_STRIP) with Canvas2D fallback

**Key Features**:

- Adaptive scaling based on amplitude range
- Automatic downsampling for performance
- Statistics overlay (min, max, avg)
- Grid with major/minor lines

**Usage**:

```typescript
<WaveformVisualizer
  samples={iqSamples}
  width={750}
  height={300}
/>
```

**Testing Pattern**:

```typescript
test('calculates correct statistics', () => {
  const samples = [
    { I: 1.0, Q: 0.0 },   // amplitude: 1.0
    { I: 0.0, Q: 1.0 },   // amplitude: 1.0
    { I: 0.5, Q: 0.5 },   // amplitude: ~0.707
  ];

  render(<WaveformVisualizer samples={samples} />);

  // Statistics should be visible
  expect(screen.getByText(/max/i)).toBeInTheDocument();
  expect(screen.getByText(/min/i)).toBeInTheDocument();
});
```

### FFTChart

**Purpose**: Display frequency spectrum as line chart

**Location**: `src/visualization/components/FFTChart.tsx`

**Rendering**: Canvas2D

**Key Features**:

- Peak detection and labeling
- Frequency axis with Hz/kHz/MHz formatting
- Power axis in dB
- Configurable frequency range

**Usage**:

```typescript
<FFTChart
  samples={iqSamples}
  sampleRate={2048000}
  centerFrequency={100e6}
  width={750}
  height={400}
/>
```

## Rendering Strategies

### WebGL Rendering

**Primary rendering path** for high-performance visualizations.

#### When to Use

- High sample rates (>1 MSps)
- Large datasets (>10,000 points)
- Real-time updates (>30 FPS)
- GPU-accelerated effects

#### Implementation Pattern

```typescript
useEffect(() => {
  const render = async () => {
    try {
      // Import WebGL utilities dynamically
      const webgl = await import("../utils/webgl");

      // Get WebGL context
      const { gl, isWebGL2 } = webgl.getGL(canvasRef.current);
      if (!gl) throw new Error("WebGL not available");

      // Create shader program
      const program = webgl.createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);

      // Set up buffers and render
      // ...
    } catch (error) {
      console.warn("WebGL failed, using fallback", error);
      // Fall through to Canvas2D
    }
  };

  void render();
}, [samples]);
```

#### Key Utilities

**File**: `src/utils/webgl.ts`

- `getGL(canvas)`: Get WebGL context with fallback
- `createShader()`: Compile GLSL shaders
- `createProgram()`: Link shader program
- `createTextureRGBA()`: Create and manage textures
- `viridisLUT256()`: Viridis colormap lookup table

### Canvas2D Rendering

**Fallback rendering path** for maximum compatibility.

#### When to Use

- WebGL unavailable or failed
- Lower sample rates (<500 kSps)
- Smaller datasets (<1,000 points)
- Testing environments (Jest/jsdom)

#### Implementation Pattern

```typescript
useEffect(() => {
  const ctx = canvasRef.current?.getContext("2d");
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw visualization
  ctx.beginPath();
  ctx.strokeStyle = "#4CAF50";
  ctx.lineWidth = 2;

  samples.forEach((sample, i) => {
    const x = (i / samples.length) * width;
    const y = ((sample.I + 1) * height) / 2;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}, [samples, width, height]);
```

### Renderer Selection Logic

Visualizations automatically select the best available renderer:

```
Try WebGL
  ↓ (if fails)
Try OffscreenCanvas + Worker
  ↓ (if fails)
Use Canvas2D (main thread)
```

**Synchronous Canvas Sizing** (for test compatibility):

```typescript
// BEFORE async WebGL import
const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;

// THEN load WebGL
const webgl = await import("../utils/webgl");
```

This ensures tests can access canvas dimensions synchronously.

## Testing Patterns

### Unit Testing Visualizations

#### Test Structure

```typescript
describe('VisualizationComponent', () => {
  // Setup
  beforeEach(() => {
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = jest.fn();
  });

  // Cleanup
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Tests
  test('renders with valid samples', () => {
    const samples = generateIQSamples({
      sampleRate: 2048000,
      frequency: 100000,
      amplitude: 0.8,
      duration: 0.1,
    });

    render(<VisualizationComponent samples={samples} />);

    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
```

#### Test Data Generators

**File**: `src/utils/signalGenerator.ts`

Available patterns:

- `sine`: Simple sinusoid
- `qpsk`: QPSK modulation
- `fm`: FM modulation
- `noise`: White noise
- `multi-tone`: Multiple carriers
- `pulsed`: Radar/burst patterns

**Example**:

```typescript
import { generateIQSamples } from "../utils/signalGenerator";

const samples = generateIQSamples({
  pattern: "qpsk",
  sampleRate: 2048000,
  frequency: 100000,
  amplitude: 0.8,
  duration: 0.1,
});
```

#### Testing Accessibility

All visualizations must have proper ARIA attributes:

```typescript
test('has correct accessibility attributes', () => {
  render(<Spectrogram samples={samples} sampleRate={2048000} />);

  const canvas = screen.getByRole('img');
  expect(canvas).toHaveAttribute('aria-label');
  expect(canvas.getAttribute('aria-label')).toMatch(/spectrogram/i);
});
```

### Integration Testing with Data Sources

#### Testing with SimulatedSource

```typescript
test('visualization updates with simulated data', async () => {
  const source = new SimulatedSource({
    pattern: 'sine',
    sampleRate: 2048000,
    amplitude: 0.8,
  });

  const samples: IQSample[] = [];
  await source.startStreaming((chunk) => {
    samples.push(...chunk);
  });

  // Wait for samples
  await waitFor(() => {
    expect(samples.length).toBeGreaterThan(0);
  });

  // Render with samples
  render(<IQConstellation samples={samples} />);

  await source.stopStreaming();
});
```

#### Testing with MockSDRDevice

For E2E tests that need device-like behavior:

```typescript
// In E2E test (Playwright)
await page.goto("https://localhost:8080/monitor?mockSdr=1");
await page.click('button:has-text("Start reception")');

// Wait for visualizations to appear
await page.waitForSelector('canvas[role="img"]');

// Verify visualization is rendering
const canvas = await page.locator('canvas[role="img"]').first();
expect(await canvas.isVisible()).toBe(true);
```

### End-to-End Testing

#### Mock Device Mode (CI-Friendly)

**Setup**: No hardware required, uses `MockSDRDevice`

**Enabling**:

- URL param: `?mockSdr=1`
- localStorage: `radio:e2e:mockSdr = "1"`
- Build env: `E2E_MOCK_SDR=1`

**Test Example**:

```typescript
// e2e/monitor-mock.spec.ts
test("can start and stop reception with mock device", async ({ page }) => {
  await page.goto("https://localhost:8080/monitor?mockSdr=1");

  // Start reception
  await page.click('button:has-text("Start reception")');

  // Verify visualizations appear
  await expect(page.locator('canvas[role="img"]')).toBeVisible();

  // Stop reception
  await page.click('button:has-text("Stop reception")');
});
```

**Run**:

```bash
npm run test:e2e
```

#### Real Device Mode (Local Hardware)

**Setup**: Requires HackRF One connected and paired via WebUSB

**Prerequisites**:

1. Connect HackRF One via USB
2. Open https://localhost:8080/monitor
3. Click "Connect Device" to pair (one-time)
4. Device is now in `navigator.usb.getDevices()`

**Enabling**:

```bash
# Set environment variable
export E2E_REAL_HACKRF=1

# Run tests
npm run test:e2e
```

**Test Example**:

```typescript
// e2e/monitor-real.spec.ts
test("can receive from real HackRF", async ({ page }) => {
  await page.goto("https://localhost:8080/monitor");

  // Wait for auto-connect
  await page.waitForSelector(
    'button:has-text("Start reception"):not([disabled])',
  );

  // Start reception
  await page.click('button:has-text("Start reception")');

  // Verify real data flowing
  await expect(page.locator('canvas[role="img"]')).toBeVisible();

  // Check for non-zero signal
  const hasSignal = await page.evaluate(() => {
    return window.dbgReceiving === true;
  });
  expect(hasSignal).toBe(true);
});
```

#### Accessibility Testing

**Framework**: @axe-core/playwright

**Pattern**:

```typescript
// e2e/accessibility.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("visualizations meet accessibility standards", async ({ page }) => {
  await page.goto("https://localhost:8080/monitor?mockSdr=1");
  await page.click('button:has-text("Start reception")');

  // Wait for visualizations
  await page.waitForSelector('canvas[role="img"]');

  // Run axe accessibility scan
  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});
```

### Test Organization

```
Tests by Type:
├── Unit Tests (Jest)
│   ├── src/visualization/components/__tests__/
│   │   ├── IQConstellation.test.tsx
│   │   ├── Spectrogram.test.tsx
│   │   └── WaveformVisualizer.test.tsx
│   ├── src/visualization/__tests__/
│   │   ├── SimulatedSource.test.ts
│   │   └── ReplaySource.test.ts
│   └── src/utils/__tests__/
│       ├── signalGenerator.test.ts
│       └── webgl.test.ts
│
└── E2E Tests (Playwright)
    └── e2e/
        ├── monitor-mock.spec.ts      # CI tests
        ├── monitor-real.spec.ts      # Hardware tests
        └── accessibility.spec.ts     # A11y tests
```

### Running Tests

```bash
# Unit tests
npm test                              # All unit tests
npm test -- Spectrogram               # Specific component
npm test -- --coverage                # With coverage

# E2E tests
npm run test:e2e                      # Mock device (CI mode)
E2E_REAL_HACKRF=1 npm run test:e2e   # Real hardware
npm run test:e2e:ui                   # Interactive UI mode

# Specific test suites
npm run test:components               # Component tests only
npm run test:utils                    # Utility tests only
```

## Performance Optimization

### WebGL Best Practices

1. **Minimize State Changes**

   ```typescript
   // ❌ Bad: Multiple state changes
   gl.useProgram(program1);
   gl.drawArrays(...);
   gl.useProgram(program2);
   gl.drawArrays(...);

   // ✅ Good: Batch similar operations
   gl.useProgram(program);
   gl.drawArrays(...);
   gl.drawArrays(...);
   ```

2. **Reuse Buffers**

   ```typescript
   // Create once
   const vbo = gl.createBuffer();

   // Update many times
   gl.bufferData(gl.ARRAY_BUFFER, newData, gl.DYNAMIC_DRAW);
   ```

3. **Use Appropriate Data Types**

   ```typescript
   // High precision (8 bytes per value)
   gl.texImage2D(..., gl.R32F, ..., gl.FLOAT, data);

   // Lower precision (1 byte per value) - 8x less memory
   gl.texImage2D(..., gl.R8, ..., gl.UNSIGNED_BYTE, data);
   ```

### Canvas2D Best Practices

1. **Enable Hardware Acceleration Hints**

   ```typescript
   const ctx = canvas.getContext("2d", {
     alpha: false, // Opaque canvas
     desynchronized: true, // GPU hint
   });
   ```

2. **Minimize Redraws**

   ```typescript
   // Use dirty rectangles
   ctx.clearRect(dirtyX, dirtyY, dirtyWidth, dirtyHeight);
   ```

3. **Batch Operations**

   ```typescript
   ctx.beginPath();
   samples.forEach((s) => ctx.lineTo(s.x, s.y));
   ctx.stroke(); // One stroke call
   ```

### Memory Management

1. **Clear Pools After Tests**

   ```typescript
   import { clearMemoryPools } from "../utils/testMemoryManager";

   afterEach(() => {
     clearMemoryPools();
   });
   ```

2. **Cleanup WebGL Resources**

   ```typescript
   useEffect(() => {
     const glState = { program, vbo, texture };

     return () => {
       if (glState.program) gl.deleteProgram(glState.program);
       if (glState.vbo) gl.deleteBuffer(glState.vbo);
       if (glState.texture) gl.deleteTexture(glState.texture);
     };
   }, []);
   ```

### Adaptive Downsampling

For large datasets, downsample before rendering:

```typescript
function adaptiveDownsample(
  samples: IQSample[],
  maxPoints: number,
): IQSample[] {
  if (samples.length <= maxPoints) return samples;

  const step = Math.floor(samples.length / maxPoints);
  return samples.filter((_, i) => i % step === 0);
}
```

## Extending Visualizations

### Adding a New Visualization Component

1. **Create Component File**

   ```typescript
   // src/visualization/components/MyVisualization.tsx
   interface MyVisualizationProps {
     samples: IQSample[];
     width: number;
     height: number;
     sampleRate: number;
   }

   export function MyVisualization({
     samples,
     width,
     height,
     sampleRate
   }: MyVisualizationProps): JSX.Element {
     const canvasRef = useRef<HTMLCanvasElement>(null);

     useEffect(() => {
       const canvas = canvasRef.current;
       if (!canvas) return;

       // Rendering logic here
     }, [samples, width, height]);

     return (
       <canvas
         ref={canvasRef}
         width={width}
         height={height}
         role="img"
         aria-label="My custom visualization"
       />
     );
   }
   ```

2. **Add Tests**

   ```typescript
   // src/visualization/components/__tests__/MyVisualization.test.tsx
   describe('MyVisualization', () => {
     test('renders with samples', () => {
       const samples = generateIQSamples({ /* config */ });
       render(<MyVisualization samples={samples} width={800} height={600} />);

       expect(screen.getByRole('img')).toBeInTheDocument();
     });
   });
   ```

3. **Export from Module**

   ```typescript
   // src/visualization/components/index.ts
   export { MyVisualization } from "./MyVisualization";
   ```

4. **Integrate into Monitor (or your page)**

  ```typescript
  // Example: inside Monitor's visualization area
  <MyVisualization samples={samples} width={750} height={400} />
  ```

### Adding a New Data Source

1. **Implement DataSource Interface**

   ```typescript
   // src/visualization/MyDataSource.ts
   export class MyDataSource implements DataSource {
     private streaming = false;
     private callback?: (samples: IQSample[]) => void;

     async startStreaming(
       callback: (samples: IQSample[]) => void,
     ): Promise<void> {
       this.callback = callback;
       this.streaming = true;

       // Start generating/fetching samples
       this.generateSamples();
     }

     async stopStreaming(): Promise<void> {
       this.streaming = false;
       this.callback = undefined;
     }

     isStreaming(): boolean {
       return this.streaming;
     }

     getSampleRate(): number {
       return 2048000; // Your sample rate
     }

     private generateSamples(): void {
       if (!this.streaming || !this.callback) return;

       // Generate or fetch samples
       const samples: IQSample[] = [];
       // ... populate samples

       this.callback(samples);

       // Continue if still streaming
       if (this.streaming) {
         setTimeout(() => this.generateSamples(), 100);
       }
     }
   }
   ```

2. **Add Tests**

   ```typescript
   // src/visualization/__tests__/MyDataSource.test.ts
   describe("MyDataSource", () => {
     test("streams samples", async () => {
       const source = new MyDataSource();
       const samples: IQSample[] = [];

       await source.startStreaming((chunk) => {
         samples.push(...chunk);
       });

       await waitFor(() => {
         expect(samples.length).toBeGreaterThan(0);
       });

       await source.stopStreaming();
     });
   });
   ```

## Additional Resources

### Documentation

- [Testing Strategy](./testing/TEST_STRATEGY.md)
- [E2E Testing Guide](./e2e-tests.md)
- [WebGL Reference](./reference/webgl-visualization.md)
- [DSP Fundamentals](./reference/dsp-fundamentals.md)

### Architecture Decision Records

- [ADR-0015: Visualization Rendering Strategy](./decisions/0015-visualization-rendering-strategy.md)
- [ADR-0019: Viridis Colormap](./decisions/0019-viridis-colormap-waterfall-visualization.md)
- [ADR-0020: E2E Testing Hardware/Mock](./decisions/0020-e2e-testing-hardware-mock.md)

### Code Examples

- Live integration: `src/components/Monitor/PrimaryVisualization.tsx`
- Signal Generator: `src/utils/signalGenerator.ts`
- WebGL Utilities: `src/utils/webgl.ts`
- Mock Device: `src/models/MockSDRDevice.ts`

### External Resources

- [WebGL2 Fundamentals](https://webgl2fundamentals.org/)
- [RF Visualization Best Practices (IITM)](https://varun19299.github.io/ID4100-Wireless-Lab-IITM/posts/11-visualising-rf-spectrum/)
- [Viridis Colormap](https://cran.r-project.org/web/packages/viridis/vignettes/intro-to-viridis.html)

## Troubleshooting

### Visualization Not Rendering

1. **Check Browser Console**: Look for WebGL or Canvas errors
2. **Verify Samples**: Ensure samples array is not empty
3. **Check Dimensions**: Canvas must have width > 0 and height > 0
4. **Test Canvas Context**: Verify `getContext('2d')` or `getContext('webgl2')` succeeds

### Performance Issues

1. **Check Sample Rate**: Downsample if > 10 MSps
2. **Monitor Frame Rate**: Should maintain 30+ FPS
3. **Profile Rendering**: Use browser DevTools Performance tab
4. **Check GPU Usage**: Verify WebGL is being used

### Test Failures

1. **Canvas Mock**: Ensure Jest setup mocks canvas properly
2. **Async Operations**: Use `waitFor()` for async updates
3. **Memory Cleanup**: Call `clearMemoryPools()` in `afterEach()`
4. **Device State**: Clear device state between tests

### E2E Test Issues

1. **Mock Mode**: Ensure `?mockSdr=1` is in URL
2. **Real Device**: Verify device is paired and connected
3. **Timing**: Add appropriate `waitFor()` calls
4. **HTTPS**: Dev server must use HTTPS for WebUSB

## Contributing

When contributing visualization features:

1. Follow existing patterns and conventions
2. Add comprehensive tests (unit + integration)
3. Update this documentation with new patterns
4. Ensure accessibility (ARIA labels, keyboard nav)
5. Profile performance (maintain 30+ FPS)
6. Integrate examples into Monitor or a local-only examples route

For questions or issues, see [CONTRIBUTING.md](../CONTRIBUTING.md).
