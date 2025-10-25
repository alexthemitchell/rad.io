# ADR-0006: Testing Strategy and Framework Selection

## Status

Accepted

## Context

A complex SDR application requires comprehensive testing at multiple levels:

**Testing Requirements**:

1. **Unit Tests**: DSP algorithms, utilities, data transformations
2. **Component Tests**: React components in isolation
3. **Integration Tests**: Worker communication, device interactions
4. **E2E Tests**: Complete user workflows
5. **Performance Tests**: DSP operation benchmarks
6. **Visual Tests**: WebGL rendering correctness

**Challenges**:

- Web Workers require special test setup
- WebGL/WebGPU rendering hard to test in headless environment
- WebUSB/WebSerial require mocked device access
- Real-time DSP requires deterministic test data
- CI environment may lack GPU access
- Browser-specific behavior differences

**Testing Framework Options**:

| Framework       | Type             | Pros                        | Cons             |
| --------------- | ---------------- | --------------------------- | ---------------- |
| Vitest          | Unit/Integration | Fast, Vite integration, ESM | Newer            |
| Jest            | Unit/Integration | Mature, widely used         | Slower, CJS      |
| Playwright      | E2E              | Multi-browser, powerful     | Heavier          |
| Cypress         | E2E              | DX, time-travel debug       | Chromium-centric |
| Testing Library | Component        | React idioms                | Requires runner  |

## Decision

We will implement a **multi-layer testing strategy** using specialized tools for each layer:

### Testing Stack

#### Layer 1: Unit & Integration Tests - **Vitest**

**Why Vitest**:

- Native ESM support (matches our Vite build)
- Fast parallel execution
- Built-in coverage (c8)
- TypeScript support out-of-the-box
- Compatible with Jest API (easy migration)
- Excellent VS Code integration

**Test Structure**:

```
src/
  lib/
    dsp/
      fft.ts
      fft.test.ts          ← Unit tests
    storage/
      recordings-db.ts
      recordings-db.test.ts
  workers/
    dsp-worker.ts
    dsp-worker.test.ts     ← Integration tests
  components/
    Spectrum.tsx
    Spectrum.test.tsx      ← Component tests
```

#### Layer 2: Component Tests - **React Testing Library**

**Why React Testing Library**:

- User-centric testing approach
- Encourages accessible components
- Works seamlessly with Vitest
- Avoids implementation details

**Example**:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { FrequencyInput } from './FrequencyInput'

test('validates frequency input', async () => {
  const user = userEvent.setup()
  render(<FrequencyInput onChange={jest.fn()} />)

  const input = screen.getByLabelText(/frequency/i)
  await user.type(input, '100.5')

  expect(input).toHaveValue('100.5')
})
```

#### Layer 3: E2E Tests - **Playwright**

**Why Playwright**:

- Multi-browser testing (Chromium, Firefox, WebKit)
- Native Web Worker support
- Can test WebUSB with mocks
- Excellent CI integration
- Video/screenshot on failure
- Network request interception
- GPU access in headed mode

**Test Structure**:

```
tests/
  e2e/
    device-connection.spec.ts
    spectrum-analysis.spec.ts
    recording-playback.spec.ts
    multi-device.spec.ts
  fixtures/
    mock-devices.ts
    sample-data.ts
```

### Testing Categories

#### 1. DSP Unit Tests

**Coverage Target**: 95%+

Test every DSP function with:

- Known input/output pairs
- Edge cases (zeros, infinities, NaN)
- Boundary conditions
- Numerical stability

```typescript
// src/lib/dsp/fft.test.ts
import { describe, it, expect } from "vitest";
import { FFT } from "./fft";

describe("FFT", () => {
  it("computes FFT of sine wave correctly", () => {
    const fft = new FFT(1024);
    const input = generateSineWave(440, 48000, 1024);
    const output = fft.forward(input);

    // Find peak frequency
    const peakBin = findPeakBin(output);
    const peakFreq = (peakBin / 1024) * 48000;

    expect(peakFreq).toBeCloseTo(440, 1);
  });

  it("preserves energy (Parseval theorem)", () => {
    const fft = new FFT(1024);
    const input = randomNoise(1024);
    const output = fft.forward(input);

    const timeEnergy = sumSquares(input);
    const freqEnergy = sumSquares(output) / 1024;

    expect(freqEnergy).toBeCloseTo(timeEnergy, 5);
  });
});
```

#### 2. Worker Integration Tests

**Coverage Target**: 85%+

Test worker communication and processing:

```typescript
// src/workers/dsp-worker.test.ts
import { describe, it, expect } from "vitest";
import { DSPWorkerPool } from "./dsp-worker-pool";

describe("DSPWorkerPool", () => {
  it("processes FFT in worker", async () => {
    const pool = new DSPWorkerPool(2);
    await pool.init();

    const samples = generateTestSamples(2048);
    const result = await pool.process({
      type: "fft",
      samples,
      sampleRate: 48000,
    });

    expect(result.type).toBe("fft");
    expect(result.result).toHaveLength(2048);
    expect(result.processingTime).toBeLessThan(10);
  });

  it("handles multiple concurrent requests", async () => {
    const pool = new DSPWorkerPool(2);
    await pool.init();

    const requests = Array.from({ length: 10 }, (_, i) =>
      pool.process({
        type: "fft",
        samples: generateTestSamples(1024),
        sampleRate: 48000,
      }),
    );

    const results = await Promise.all(requests);
    expect(results).toHaveLength(10);
  });
});
```

#### 3. Component Tests

**Coverage Target**: 80%+

Test component behavior, not implementation:

```typescript
// src/components/DeviceSelector.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { DeviceSelector } from './DeviceSelector'

describe('DeviceSelector', () => {
  it('lists available devices', async () => {
    const mockDevices = [
      { id: '1', name: 'RTL-SDR', type: 'rtlsdr' },
      { id: '2', name: 'HackRF', type: 'hackrf' }
    ]

    render(
      <DeviceSelector
        devices={mockDevices}
        onSelect={jest.fn()}
      />
    )

    expect(screen.getByText('RTL-SDR')).toBeInTheDocument()
    expect(screen.getByText('HackRF')).toBeInTheDocument()
  })

  it('emits select event on device click', async () => {
    const user = userEvent.setup()
    const handleSelect = jest.fn()

    render(
      <DeviceSelector
        devices={[{ id: '1', name: 'RTL-SDR', type: 'rtlsdr' }]}
        onSelect={handleSelect}
      />
    )

    await user.click(screen.getByText('RTL-SDR'))
    expect(handleSelect).toHaveBeenCalledWith('1')
  })
})
```

#### 4. E2E Tests

**Coverage Target**: Critical paths

Test complete user workflows:

```typescript
// tests/e2e/spectrum-analysis.spec.ts
import { test, expect } from "@playwright/test";

test("user can tune to frequency and see spectrum", async ({ page }) => {
  await page.goto("/");

  // Mock WebUSB device
  await page.addInitScript(() => {
    // Inject mock device
  });

  // Connect device
  await page.getByRole("button", { name: /connect device/i }).click();
  await page.getByRole("option", { name: /rtl-sdr/i }).click();

  // Tune to frequency
  await page.getByLabel(/frequency/i).fill("100.5");
  await page.getByLabel(/frequency/i).press("Enter");

  // Verify spectrum displays
  const canvas = page.locator('canvas[data-testid="spectrum"]');
  await expect(canvas).toBeVisible();

  // Verify frequency is set
  await expect(page.getByTestId("current-frequency")).toHaveText("100.5 MHz");
});

test("waterfall scrolls smoothly", async ({ page }) => {
  await page.goto("/");

  // Start device
  await startMockDevice(page);

  // Take initial screenshot
  const waterfall = page.locator('canvas[data-testid="waterfall"]');
  const initial = await waterfall.screenshot();

  // Wait 1 second
  await page.waitForTimeout(1000);

  // Take another screenshot
  const after = await waterfall.screenshot();

  // Images should be different (waterfall scrolled)
  expect(Buffer.compare(initial, after)).not.toBe(0);
});
```

#### 5. Performance Tests

**Coverage Target**: All DSP operations

Benchmark critical operations:

```typescript
// src/lib/dsp/benchmarks.test.ts
import { describe, it, expect } from "vitest";
import { FFT } from "./fft";

describe("FFT Performance", () => {
  it("processes 2048-point FFT under 5ms", () => {
    const fft = new FFT(2048);
    const input = generateTestSamples(2048);

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      fft.forward(input);
    }
    const end = performance.now();

    const avgTime = (end - start) / 100;
    expect(avgTime).toBeLessThan(5);
  });
});
```

#### 6. Visual Regression Tests

**Approach**: Screenshot comparison for WebGL renders

```typescript
// tests/e2e/visual-regression.spec.ts
import { test, expect } from "@playwright/test";

test("waterfall renders correctly", async ({ page }) => {
  await page.goto("/");
  await setupTestData(page);

  const waterfall = page.locator('canvas[data-testid="waterfall"]');
  await expect(waterfall).toHaveScreenshot("waterfall-baseline.png", {
    threshold: 0.1, // 10% difference tolerance
  });
});
```

## Consequences

### Positive

- **Fast Feedback**: Vitest runs in milliseconds
- **Multi-Browser**: Playwright tests in 3 engines
- **CI-Friendly**: All tests run headless
- **Type-Safe**: TypeScript in all tests
- **Maintainable**: Clear separation of test layers
- **Debuggable**: Playwright traces and videos on failure

### Negative

- **Setup Complexity**: Multiple test frameworks to configure
- **Learning Curve**: Team must learn Playwright and Vitest
- **CI Time**: E2E tests slower than unit tests
- **Flakiness Risk**: E2E tests can be flaky
- **Maintenance**: More code to maintain

### Neutral

- Can run unit tests in watch mode during development
- E2E tests only run in CI or on-demand
- Visual regression tests require baseline management

## Implementation Details

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "c8",
      reporter: ["text", "html", "lcov"],
      exclude: ["node_modules/", "tests/", "**/*.test.ts", "**/*.spec.ts"],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
```

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
```

### Test Utilities

```typescript
// tests/utils/test-helpers.ts

export function generateSineWave(
  freq: number,
  sampleRate: number,
  length: number,
): Float32Array {
  const samples = new Float32Array(length);
  const omega = (2 * Math.PI * freq) / sampleRate;
  for (let i = 0; i < length; i++) {
    samples[i] = Math.sin(omega * i);
  }
  return samples;
}

export function generateIQSamples(
  freq: number,
  sampleRate: number,
  length: number,
): IQSamples {
  const omega = (2 * Math.PI * freq) / sampleRate;
  const i = new Float32Array(length);
  const q = new Float32Array(length);

  for (let n = 0; n < length; n++) {
    i[n] = Math.cos(omega * n);
    q[n] = Math.sin(omega * n);
  }

  return { i, q, sampleRate };
}

export function expectArrayClose(
  actual: Float32Array,
  expected: Float32Array,
  tolerance: number = 1e-5,
): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], tolerance);
  }
}
```

### Mock Device Factory

```typescript
// tests/fixtures/mock-devices.ts

export class MockRTLSDR {
  async open() {}
  async close() {}
  async setFrequency(freq: number) {}
  async setSampleRate(rate: number) {}

  getSamples(): AsyncIterableIterator<IQSamples> {
    return (async function* () {
      while (true) {
        yield generateTestSamples(2048);
        await new Promise((r) => setTimeout(r, 10));
      }
    })();
  }
}
```

## CI Integration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Coverage Targets

| Layer          | Target     | Critical Paths |
| -------------- | ---------- | -------------- |
| DSP Algorithms | 95%        | 100%           |
| Workers        | 85%        | 100%           |
| Components     | 80%        | 90%            |
| Integration    | 75%        | 90%            |
| E2E            | User flows | Critical only  |

## Alternatives Considered

### Alternative 1: Jest Instead of Vitest

**Rejected**: Slower, CJS-centric, less Vite integration

### Alternative 2: Cypress Instead of Playwright

**Rejected**: Limited multi-browser support, slower

### Alternative 3: No E2E Tests

**Rejected**: Complex WebUSB flows need E2E validation

### Alternative 4: Enzyme for Components

**Rejected**: Deprecated, Testing Library preferred

## References

#### Official Documentation

- [Vitest Documentation](https://vitest.dev/) - Official Vitest testing framework
- [Playwright Documentation](https://playwright.dev/) - Official Playwright end-to-end testing
- [React Testing Library](https://testing-library.com/react) - React component testing library
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) - Official testing best practices from Microsoft

#### Technical Articles and Guides

- "Playwright Test Best Practices for Scalability." DEV Community (2024). [Technical Guide](https://dev.to/aswani25/playwright-test-best-practices-for-scalability-4l0j) - Page Object Model, parallel execution, test organization
- "Mastering Testing with Vitest and TypeScript." xjavascript.com (2024). [Developer Guide](https://www.xjavascript.com/blog/vitest-typescript/) - TypeScript integration and best practices
- "Unit Testing a React Application with Vitest, MSW, and Playwright." MakePath (2024). [Integration Guide](https://makepath.com/unit-testing-a-react-application-with-vitest-msw-and-playwright/) - Combining Vitest browser mode with Playwright
- GitHub. "Vitest Playground: A hands-on repository for learning Vitest." [Examples](https://github.com/SallamRady/vitest-playground/) - Practical testing patterns

#### Testing Web Workers

- "Testing Web Workers" - Web.dev - Best practices for worker testing
- "E2E Testing Best Practices" - Playwright Blog - End-to-end testing strategies

#### Related ADRs

- ADR-0002: Web Worker DSP Architecture (testing workers in isolation)
- ADR-0007: Type Safety and Validation Approach (test data validation)
