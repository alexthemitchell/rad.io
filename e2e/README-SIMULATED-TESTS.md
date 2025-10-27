# E2E Tests for Visualization with Simulated Data

## Overview

This test suite provides comprehensive end-to-end coverage for visualization features using simulated data sources. These tests ensure stable, deterministic CI execution without requiring physical hardware.

## Test Files

### `e2e/visualization-simulated.spec.ts`

Comprehensive tests tagged with `@simulated` for isolated execution in the "simulated" Playwright project.

**Test Suites:**

1. **Visualization with Simulated Data** (4 tests)
   - Render visualizations on demo page
   - Display different signal patterns
   - Show continuous updates when streaming
   - Handle start/stop cycles correctly

2. **Monitor Page with Simulated Data** (5 tests)
   - Render all visualization modes (waterfall, spectrogram, FFT)
   - Maintain visualization continuity during mode switches
   - Display IQ constellation with simulated data
   - Display amplitude waveform with simulated data

3. **Visualization Performance** (2 tests)
   - Render frames at acceptable rate
   - No memory leaks during extended streaming

## Running Tests

### Run all e2e tests (includes simulated tests)
```bash
npm run test:e2e
```

### Run only simulated tests
```bash
npm run test:e2e:sim
```

### Run with UI mode for debugging
```bash
npm run test:e2e:ui -- --grep @simulated
```

### Run in headed mode to see browser
```bash
npm run test:e2e:headed -- --grep @simulated
```

## Configuration

### Playwright Projects

The Playwright configuration defines three projects:

1. **mock-chromium**: Default project for mock SDR tests (excludes `@real` and `@simulated`)
2. **simulated**: Runs only tests tagged with `@simulated`
3. **real-chromium**: Optional project for real hardware tests (enabled with `E2E_REAL_HACKRF=1`)

### Test Routes

- **Demo Page**: `https://localhost:8080/demo`
  - Uses `SimulatedSource` directly
  - Tests fundamental visualization rendering

- **Monitor Page**: `https://localhost:8080/monitor?mockSdr=1`
  - Uses `MockSDRDevice` via query parameter
  - Tests integrated visualization modes

## Key Features

### Deterministic Testing
- All tests use simulated data sources
- No dependency on physical hardware
- Consistent results across environments

### Comprehensive Coverage
- Multiple visualization modes (waterfall, spectrogram, FFT)
- IQ constellation and waveform displays
- Mode switching and continuity verification
- Performance and memory leak detection

### CI-Friendly
- Fast execution (no hardware initialization delays)
- Reliable results (no hardware flakiness)
- Parallel execution support

## Signal Patterns

The `SimulatedSource` supports multiple signal patterns:

- **sine**: Simple sine wave at 1 kHz offset
- **qpsk**: QPSK constellation with 4 points
- **noise**: White noise
- **fm**: FM modulated signal (10 kHz carrier, 1 kHz audio)
- **multi-tone**: Multiple tones at different frequencies

## Acceptance Criteria

✅ CI passes with `npm run test:e2e`
✅ CI passes with `npm run test:e2e:sim`
✅ All 11 tests validate visualization rendering and continuity
✅ Tests run in dedicated "simulated" Playwright project
✅ No physical hardware required

## Maintenance

### Adding New Tests

1. Tag tests with `@simulated` in the test name:
   ```typescript
   test("should do something @simulated", async ({ page }) => {
     // test code
   });
   ```

2. Use either:
   - Demo page: `/demo` for `SimulatedSource` tests
   - Monitor page: `/monitor?mockSdr=1` for `MockSDRDevice` tests

### Debugging Tests

1. Run with UI mode: `npm run test:e2e:ui -- --grep @simulated`
2. Run in headed mode: `npm run test:e2e:headed -- --grep @simulated`
3. Check artifacts in `playwright-report/` after failed runs
4. Review traces in `test-results/` for detailed execution logs

## Related Documentation

- [E2E Tests Overview](../docs/e2e-tests.md)
- [Visualization Module Architecture](../src/visualization/README.md)
- [SimulatedSource Implementation](../src/visualization/SimulatedSource.ts)
- [MockSDRDevice Implementation](../src/models/MockSDRDevice.ts)

## Memory References

- `PLAYWRIGHT_E2E_HARDWARE_AND_MOCK`: Hardware and mock test patterns
- `PLAYWRIGHT_WEBSERVER_AUTOSTART_FOR_E2E`: Web server configuration
- `DATASOURCE_ABSTRACTION_IMPLEMENTATION`: DataSource architecture
- `VISUALIZATION_MODULE_ARCHITECTURE`: Visualization module design
