# rad.io End-to-End Test Suite

## Overview

This directory contains comprehensive end-to-end (E2E) tests for the rad.io SDR visualizer application. The tests validate **intended behavior** as specified in the Product Requirements Document (PRD), UI Design Spec, and Architecture Decision Records (ADRs), not just current implementation state.

## Test Philosophy

> **These tests document what the application SHOULD do, according to project specifications.**

The test suite serves multiple purposes:
- ✅ **Executable Specifications**: Tests define expected behavior from PRD and ADRs
- ✅ **Implementation Guide**: Tests show developers what features should do
- ✅ **Quality Assurance**: Tests validate performance, accessibility, and UX requirements
- ✅ **Regression Prevention**: Tests catch unintended changes to specified behavior
- ✅ **Living Documentation**: Tests provide up-to-date examples of system capabilities

**Note**: Many tests may initially fail if features are not yet implemented. This is expected and acceptable. Tests failing indicates functionality to be built or refined, not test defects.

## Test Files

### Primary Workspace Tests

#### 1. `monitor-comprehensive.spec.ts` (507 lines, ~42 tests)
**Monitor workspace** - The default/primary view for real-time spectrum analysis

**Coverage:**
- Core functionality (page load, UI elements, start/stop reception)
- Spectrum visualization (ARIA attributes, 60 FPS rendering, grid overlay)
- Waterfall display (rendering, scrolling, click-to-tune)
- VFO and frequency control (display, input, arrow keys, Page Up/Down)
- Status bar metrics (GPU tier, FPS, sample rate, buffer health, storage, audio state)
- IQ constellation and waveform displays
- Mode selection and audio controls
- Performance (memory leaks, rapid start/stop cycles)
- Navigation integration (routing, query parameters)

**Key Requirements Validated:**
- 60 FPS at 8192 bins (PRD)
- <150ms click-to-audio latency (PRD)
- WCAG 2.1 AA compliance (ADR-0017, ADR-0023)
- Keyboard-first operation (UI Design Spec)

#### 2. `scanner-comprehensive.spec.ts` (430 lines, ~35 tests)
**Scanner workspace** - Automated frequency scanning and activity logging

**Coverage:**
- Navigation (page access, keyboard shortcuts)
- Configuration (scan mode, frequency range, step size, threshold, dwell time)
- Scan execution (start/stop/pause, keyboard shortcuts)
- Activity log (display, metadata, sorting)
- Bookmark integration (manual and auto-bookmark)
- Priority channels
- Real-time preview
- Export and logging
- Memory and band scope modes
- Accessibility (keyboard navigation, ARIA labels, live regions)
- Performance (>10 channels/s scan rate)

**Key Requirements Validated:**
- >10 channels/s fast scan mode (PRD)
- Detection reliability >95% above squelch (PRD)
- Activity log with waterfall thumbnails (PRD)

#### 3. `workspaces-comprehensive.spec.ts` (653 lines, ~62 tests)
**Decode, Analysis, and Recordings workspaces**

**Decode Workspace Coverage:**
- Navigation and mode selection (RTTY, PSK31, SSTV)
- RTTY decoder (baud rate 45.45/50, shift 170/850 Hz, text output)
- PSK31 decoder (AFC, varicode decoding)
- SSTV decoder (multiple modes, progressive rendering, image save)
- General controls (start/stop, <200ms latency requirement)

**Analysis Workspace Coverage:**
- Navigation
- Constellation diagram (freeze frame, persistence trails, EVM calculation)
- Eye diagram (trigger controls, sample interpolation)
- Measurements (interactive cursors, snapshot comparison, export)
- Spectrogram zoom (deep zoom, Z/X shortcuts)
- Phase noise measurement

**Recordings Workspace Coverage:**
- Navigation
- Library display (list/grid views, metadata)
- Filtering and search (tags, full-text search)
- Playback (play control, preview visualization)
- Export (SigMF for IQ, WAV/FLAC for audio)
- Management (delete, tag editing, storage quota 20GB+)
- Integration with Analysis and Decode workspaces

**Key Requirements Validated:**
- <200ms decode latency (PRD)
- Handles 20GB+ recordings (PRD)
- SigMF compliance (PRD)

### Global UI and Navigation Tests

#### 4. `navigation-and-panels.spec.ts` (859 lines, ~87 tests)
**Navigation, panels, keyboard shortcuts, and settings**

**Coverage:**

**Global Navigation:**
- Page routing (all workspaces, support pages, panels)
- Active page highlighting
- Deep linking with query parameters
- Share links with state

**Keyboard Shortcuts:**
- Global (?, 1-5 for workspaces, Ctrl+K, Ctrl+S, Ctrl+F)
- Tuning (Arrow keys, Page Up/Down, [/], M)
- Visualization (Z, X, P, G, R)
- Bookmarks (B, Ctrl+B)

**Bookmarks Panel:**
- List display, hierarchical folders, search
- Filter by tags, click-to-tune
- Import/export (CSV, RadioReference)
- 10k+ bookmark capacity (PRD)

**Devices Panel:**
- Device list, connect button, device information
- Per-device settings (sample rate, gain, PPM)
- Multi-device support (4+ devices per PRD)

**Measurements Panel:**
- Measurement tools, marker placement, marker table
- Export CSV/JSON
- Channel power, OBW, ACPR, SNR/SINAD
- ±1 Hz frequency accuracy, ±0.2dB power accuracy (PRD)

**Diagnostics Panel:**
- Health metrics, telemetry data
- Copy logs, download diagnostics bundle

**Settings and Calibration:**
- Settings tabs (Display, Radio, Audio, Calibration, Advanced)
- Import/export settings JSON
- Keyboard shortcut customization
- Calibration wizard (PPM ±0.5, gain flatness, IQ balance, DC offset)
- Per-device calibration profiles

**Help Page:**
- Help content display
- Keyboard shortcuts reference

**Key Requirements Validated:**
- Keyboard-first operation (UI Design Spec)
- 10,000+ bookmarks with <100ms search (PRD)
- ±1 Hz frequency accuracy post-calibration (PRD)
- ±0.2dB power accuracy (PRD)

### Accessibility Tests

#### 5. `accessibility.spec.ts` (Updated documentation)
**WCAG 2.1 AA compliance validation**

**Coverage:**
- Application-wide accessibility scan (axe-core)
- Document structure (main landmark, heading hierarchy, skip link)
- Keyboard navigation (skip link, interactive elements, tab order, frequency controls)
- ARIA and semantics (visualization labels, button names, form labels)
- Focus management (visible indicators)
- Color contrast (WCAG AA requirements)
- Responsive and zoom (200% zoom, mobile viewport)
- Live regions (announcements for screen readers)

**Key Requirements Validated:**
- WCAG 2.1 AA compliance (ADR-0017, ADR-0023)
- Zero critical violations (ADR-0023)
- 4.5:1 text contrast, 3:1 UI component contrast (UI Design Spec)
- 3px solid cyan focus ring with ≥3:1 contrast (UI Design Spec)
- Logical tab order following visual layout (UI Design Spec)

### Legacy Tests (Existing)

- `monitor-mock.spec.ts` - Basic mock device smoke tests
- `visualization-simulated.spec.ts` - Simulated data visualization tests
- `toast.spec.ts` - Toast notification accessibility tests
- `recordings-device.spec.ts` - Hardware-dependent recording tests
- `scanner-device.spec.ts` - Hardware-dependent scanner tests
- `monitor-real.spec.ts` - Real hardware monitoring tests

## Test Organization

### Test Tags

Tests are organized with tags for selective execution:

- **No tag**: Mock device tests (default, run in CI)
- **`@simulated`**: Simulated data source tests
- **`@real`**: Real hardware tests (opt-in with `E2E_REAL_HACKRF=1`)
- **`@device`**: Hardware-in-the-loop tests (opt-in with `RADIO_E2E_DEVICE=1`)

### Playwright Projects

The test suite uses multiple Playwright projects:

1. **mock-chromium** (default)
   - Runs tests without `@real`, `@simulated`, or `@device` tags
   - Uses `?mockSdr=1` for mock device
   - Always runs in CI

2. **simulated**
   - Runs tests tagged with `@simulated`
   - Uses simulated data sources
   - Runs in CI

3. **real-chromium** (opt-in)
   - Runs tests tagged with `@real`
   - Requires physical HackRF hardware
   - Enabled with `E2E_REAL_HACKRF=1`

4. **device** (opt-in)
   - Runs tests tagged with `@device`
   - Hardware-in-the-loop visualization tests
   - Enabled with `RADIO_E2E_DEVICE=1`

5. **gpu-chromium** (opt-in)
   - Runs in headed mode with GPU acceleration
   - Tests WebGL/WebGPU rendering
   - Enabled with `RADIO_E2E_GPU=1`

## Running Tests

### Prerequisites

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium

# Ensure dependencies are installed
npm install

# Build the application (if needed)
npm run build
```

### Run All Tests

```bash
# Run all mock and simulated tests (CI default)
npm run test:e2e

# Run with UI for debugging
npm run test:e2e:ui

# Run in headed mode to see browser
npm run test:e2e:headed
```

### Run Specific Test Files

```bash
# Monitor workspace tests
npm run test:e2e -- e2e/monitor-comprehensive.spec.ts

# Scanner workspace tests
npm run test:e2e -- e2e/scanner-comprehensive.spec.ts

# Decode, Analysis, Recordings tests
npm run test:e2e -- e2e/workspaces-comprehensive.spec.ts

# Navigation and panels tests
npm run test:e2e -- e2e/navigation-and-panels.spec.ts

# Accessibility tests
npm run test:e2e -- e2e/accessibility.spec.ts

# Legacy visualization tests
npm run test:e2e -- e2e/visualization-simulated.spec.ts

# Legacy monitor tests
npm run test:e2e -- e2e/monitor-mock.spec.ts
```

### Run Specific Test Suites

```bash
# Run only Monitor tests
npm run test:e2e -- --grep "Monitor"

# Run only Scanner tests
npm run test:e2e -- --grep "Scanner"

# Run only Decode tests
npm run test:e2e -- --grep "Decode"

# Run only accessibility tests
npm run test:e2e -- --grep "Accessibility"
```

### Run with Specific Projects

```bash
# Run only simulated tests
npm run test:e2e -- --project=simulated

# Run only mock tests
npm run test:e2e -- --project=mock-chromium

# Run with GPU acceleration (local only)
RADIO_E2E_GPU=1 npm run test:e2e -- --project=gpu-chromium

# Run real hardware tests (requires HackRF)
E2E_REAL_HACKRF=1 npm run test:e2e -- --project=real-chromium
```

### Debug Failing Tests

```bash
# Run a specific test with trace
npm run test:e2e -- e2e/monitor-comprehensive.spec.ts --trace on

# Show trace from failed test
npx playwright show-trace test-results/.../trace.zip

# Run with headed browser to see what's happening
npm run test:e2e:headed -- e2e/monitor-comprehensive.spec.ts

# Run with UI mode for interactive debugging
npm run test:e2e:ui -- e2e/monitor-comprehensive.spec.ts
```

## Test Configuration

### Playwright Configuration

The test suite is configured in `playwright.config.ts`:

```typescript
{
  testDir: './e2e',
  timeout: 30 * 1000,
  fullyParallel: false,  // Prevent OOM from multiple Chromium instances
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  use: {
    baseURL: 'https://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
    headless: true,
  }
}
```

### Environment Variables

- **`CI`**: Set in CI environments (enables retries, single worker)
- **`E2E_REAL_HACKRF`**: Enable real HackRF hardware tests
- **`RADIO_E2E_DEVICE`**: Enable hardware-in-the-loop visualization tests
- **`RADIO_E2E_GPU`**: Enable GPU-accelerated test project
- **`E2E_MOCK_SDR`**: Enable mock SDR at build time

### Mock Device Mode

Tests use mock SDR devices for CI-friendly execution:

```typescript
// Activate mock mode via URL
await page.goto('/monitor?mockSdr=1');

// Or via localStorage
await page.evaluate(() => {
  localStorage.setItem('radio:e2e:mockSdr', '1');
});
```

The mock device generates realistic IQ samples without requiring physical hardware.

## Performance Benchmarks

The test suite validates performance requirements from the PRD:

| Metric | Requirement | Test Location |
|--------|-------------|---------------|
| Spectrum rendering | 60 FPS at 8192 bins | `monitor-comprehensive.spec.ts` |
| Click-to-audio latency | <150ms | `monitor-comprehensive.spec.ts` |
| Scan rate | >10 channels/s | `scanner-comprehensive.spec.ts` |
| Decode latency | <200ms | `workspaces-comprehensive.spec.ts` |
| Frequency accuracy | ±1 Hz (calibrated) | `navigation-and-panels.spec.ts` |
| Power accuracy | ±0.2dB | `navigation-and-panels.spec.ts` |
| Memory growth | <50MB over 6s | `monitor-comprehensive.spec.ts` |
| Bookmark search | <100ms for 10k+ | `navigation-and-panels.spec.ts` |

## Accessibility Standards

Tests validate WCAG 2.1 AA compliance per ADR-0017 and ADR-0023:

- **Keyboard Navigation**: All functionality accessible without mouse
- **Screen Reader Support**: ARIA labels, live regions, semantic HTML
- **Color Contrast**: 4.5:1 for text, 3:1 for UI components
- **Focus Indicators**: 3px solid cyan ring with ≥3:1 contrast
- **Tab Order**: Logical order following visual layout
- **Motion**: Respects `prefers-reduced-motion`
- **Touch Targets**: ≥44×44px on mobile

## Continuous Integration

### GitHub Actions

Tests run automatically in CI:

```yaml
- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: true
```

**CI Behavior:**
- Mock device mode only (no hardware)
- 1 worker (prevents OOM)
- 2 retry attempts on failure
- 30-second timeout per test
- Traces saved only on failure
- Headless browser execution

### Test Results

After running tests:

```bash
# View HTML report
npx playwright show-report

# View specific trace
npx playwright show-trace test-results/.../trace.zip

# Check coverage (if configured)
npm run coverage
```

## Writing New Tests

### Test Structure

```typescript
import { test, expect, type Page } from "@playwright/test";

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

test.describe("Feature Name", () => {
  test("should perform expected behavior", async ({ page }) => {
    // Navigate with mock device
    await page.goto("/monitor?mockSdr=1");
    
    // Interact with UI
    const button = page.getByRole("button", { name: /start/i });
    await expect(button).toBeVisible();
    await button.click();
    
    // Verify results
    const status = page.getByRole("status");
    await expect(status).toContainText(/active/i);
  });
});
```

### Best Practices

1. **Use Mock Mode for CI Tests**
   ```typescript
   await page.goto("/monitor?mockSdr=1");
   ```

2. **Use Accessible Selectors**
   ```typescript
   // ✅ Good - uses accessible role and name
   page.getByRole("button", { name: /start reception/i })
   
   // ❌ Bad - relies on implementation details
   page.locator(".start-button")
   ```

3. **Wait for Async Operations**
   ```typescript
   // Wait for element to appear
   await expect(element).toBeVisible({ timeout: 5000 });
   
   // Wait for state change
   await page.waitForFunction(() => window.dbgReceiving === true);
   ```

4. **Document Intended Behavior**
   ```typescript
   test("should support feature X per PRD", async ({ page }) => {
     // This test validates intended behavior from PRD Section Y
     // Implementation may be pending
   });
   ```

5. **Clean Up After Tests**
   ```typescript
   test.afterEach(async ({ page }) => {
     // Stop streaming
     await page.click('button:has-text("Stop")').catch(() => {});
     
     // Clear state
     await page.evaluate(() => localStorage.clear());
   });
   ```

## Troubleshooting

### Common Issues

**Browser not installed:**
```bash
npx playwright install chromium
```

**Port 8080 already in use:**
```bash
# Kill existing process
lsof -i :8080  # Find PID
kill -9 <PID>

# Or let Playwright reuse existing server
# (already configured in playwright.config.ts)
```

**Self-signed certificate errors:**
```typescript
// Already configured in playwright.config.ts
use: {
  ignoreHTTPSErrors: true,
}
```

**Tests timeout waiting for page load:**
```bash
# Increase timeout in playwright.config.ts
timeout: 60 * 1000,  // 60 seconds
```

**Memory issues with parallel tests:**
```bash
# Reduce workers
npm run test:e2e -- --workers=1
```

## Documentation References

### Architecture Decision Records (ADRs)
- **ADR-0006**: Testing Strategy and Framework Selection
- **ADR-0017**: Comprehensive Accessibility Pattern Implementation
- **ADR-0018**: UX Information Architecture and Page Map
- **ADR-0020**: E2E Testing Strategy for Hardware and Mock SDR
- **ADR-0023**: Continuous Accessibility Compliance and Modern Web Standards
- **ADR-0013**: Automatic Signal Detection System
- **ADR-0014**: Automatic Frequency Scanning
- **ADR-0016**: Signal Decoder Architecture

### Product Requirements
- **PRD.md**: Core features, performance targets, success criteria
- **UI-DESIGN-SPEC.md**: Visual design, components, keyboard shortcuts
- **ROADMAP.md**: Iteration phases and feature priorities

### Related Documentation
- **docs/e2e-tests.md**: E2E testing overview and guide
- **docs/ACCESSIBILITY.md**: Accessibility features and patterns
- **docs/ACCESSIBILITY-TESTING-GUIDE.md**: Accessibility testing procedures

## Contributing

When adding new E2E tests:

1. **Follow the specification-driven approach**: Tests should validate intended behavior from PRD/ADRs
2. **Use accessible selectors**: ARIA roles, labels, semantic HTML
3. **Include performance assertions**: Where relevant to PRD requirements
4. **Document expectations**: Comment why test validates PRD/ADR requirements
5. **Keep tests focused**: One feature/behavior per test
6. **Use descriptive names**: Test names should clearly state what they validate

Example:
```typescript
test("should achieve 60 FPS target per PRD Section 2.2", async ({ page }) => {
  // This test validates the PRD performance requirement for
  // spectrum rendering at 60 FPS with 8192 bins
  await page.goto("/monitor?mockSdr=1");
  // ... test implementation
});
```

## License

Same as rad.io project license.

## Support

For questions about E2E tests:
- Check this README first
- Review ADR-0020 (E2E Testing Strategy)
- Review docs/e2e-tests.md (comprehensive guide)
- Consult the team lead or maintainers
