# Test Strategy

## Overview

This document outlines the testing strategy for rad.io, covering unit tests, integration tests, and end-to-end (E2E) tests.

## Test Categories

### Unit Tests

**Location**: `src/**/__tests__/*.test.ts(x)`

**Purpose**: Test individual functions, classes, and React components in isolation.

**Tools**:

- Jest (test runner)
- React Testing Library (component testing)
- jest-axe (accessibility testing)

**Coverage Targets**:

- Global minimum: 38% (enforced via Jest)
- Critical modules: 57-96% (see jest.config.ts)
- New code: 80% patch coverage (enforced via Codecov)

**Best Practices**:

1. **Keep tests fast**: Prefer mocking external dependencies
2. **Test behavior, not implementation**: Focus on what the code does, not how
3. **Use descriptive test names**: `should <expected behavior> when <condition>`
4. **Isolate tests**: Each test should be independent and not rely on others
5. **Mock expensive operations**: WebUSB, WebGL, WASM, network calls

### Integration Tests

**Location**: Mixed within `src/**/__tests__/` (same as unit tests)

**Purpose**: Test interactions between multiple modules or components.

**Examples**:

- DSP pipeline (FFT → filtering → demodulation)
- Device state management (connect → configure → stream)
- React hooks with context providers

**Best Practices**:

1. **Minimize scope**: Test 2-3 components together, not the entire app
2. **Use real implementations where possible**: Avoid over-mocking
3. **Test critical paths**: Focus on user flows and data pipelines
4. **Keep execution time reasonable**: Target <1 second per test

### End-to-End (E2E) Tests

**Location**: `e2e/*.spec.ts`

**Purpose**: Test the application from a user's perspective in a real browser.

**Tools**:

- Playwright (browser automation)
- @axe-core/playwright (accessibility)

**Test Types**:

1. **Mock tests** (CI-friendly): Use MockSDRDevice for reliable CI execution
2. **Real hardware tests** (opt-in): Test with actual HackRF devices locally
3. **Accessibility tests**: Automated WCAG 2.1 AA compliance checks

**Best Practices**:

1. **Prefer mock tests for CI**: Real hardware tests are opt-in only
2. **Test critical user flows**: Connection, streaming, visualization
3. **Use accessibility assertions**: Validate ARIA labels and keyboard navigation
4. **Keep tests maintainable**: Use page objects and helper functions

## Test Organization

### Directory Structure

```
src/
├── components/__tests__/       # Component unit tests
├── hooks/__tests__/             # Hook tests
├── models/__tests__/            # Device model tests
├── utils/__tests__/             # Utility function tests
├── lib/
│   ├── dsp/__tests__/           # DSP algorithm tests
│   ├── detection/__tests__/     # Signal detection tests
│   └── scanning/__tests__/      # Scanning logic tests
└── pages/__tests__/             # Page component tests

e2e/
├── accessibility.spec.ts        # Accessibility smoke tests
├── monitor-mock.spec.ts         # Mock device E2E tests
└── monitor-real.spec.ts         # Real hardware E2E tests (@real tag)
```

### Test Naming Conventions

- **Unit tests**: `<module>.test.ts` or `<Component>.test.tsx`
- **Targeted tests**: `<module>.<feature>.test.ts` (e.g., `dsp.calculateFFT.fallback.test.ts`)
- **E2E tests**: `<feature>.spec.ts`

## Running Tests

### Quick Commands

```bash
# Run all unit tests
npm test

# Run all unit tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/utils/__tests__/dsp.test.ts

# Run E2E tests (mock only)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed
```

### Advanced Options

```bash
# Run only changed tests
npm test -- --onlyChanged

# Run tests matching pattern
npm test -- --testNamePattern="FFT"

# Run with verbose output
npm test -- --verbose

# Profile test performance
npm test -- --verbose --logHeapUsage

# Run single worker (useful for debugging)
npm test -- --maxWorkers=1

# Run specific test suite
npm run test:components  # Component tests only
npm run test:utils       # Utility tests only
```

## Coverage Requirements

### Global Thresholds

Jest enforces minimum coverage thresholds globally:

- Statements: 38%
- Branches: 35%
- Functions: 39%
- Lines: 38%

### Module-Specific Thresholds

Critical modules have higher thresholds (see `jest.config.ts`):

- **DSP Core** (`dsp.ts`, `dspProcessing.ts`): 70-94%
- **HackRF Implementation**: 72-93%
- **Audio Processing**: 93%
- **Test Infrastructure**: 95-100%

### Codecov Integration

Codecov enforces patch coverage on PRs:

- **Default target**: 80% (threshold 5%)
- **Component targets**:
  - UI pages: 70% patch
  - DSP utils: 80% patch
  - Device models: 85% patch
  - Test infrastructure: 100% patch

**Coverage reports**:

- Uploaded to Codecov on every PR
- Available at: https://app.codecov.io/gh/alexthemitchell/rad.io

## Performance Guidelines

### Target Test Times

- **Unit test**: <100ms per test
- **Integration test**: <1 second per test
- **E2E test**: <30 seconds per test

### Optimization Strategies

1. **Parallel execution**: Jest runs tests in parallel (50% of CPU cores)
2. **Mocking**: Mock expensive operations (WebUSB, WebGL, WASM)
3. **Test isolation**: Avoid shared state between tests
4. **Selective testing**: Use `--onlyChanged` during development
5. **Memory management**: Clear memory pools in DSP tests

### Known Slow Tests

If you identify a slow test (>1s for unit, >5s for integration):

1. Profile the test with `--logHeapUsage`
2. Check for missing mocks or real I/O operations
3. Consider splitting into smaller tests
4. Add to documentation for tracking

## Test Data Generators

### Available Generators

Located in `src/utils/`:

- **signalGenerator.ts**: Generate synthetic IQ samples
- **testHelpers.ts**: Common test utilities
- **testMemoryManager.ts**: Memory management for DSP tests

### Usage Examples

```typescript
// Generate sinusoidal IQ samples
import { generateIQSamples } from "../utils/signalGenerator";

const samples = generateIQSamples({
  sampleRate: 2048000,
  frequency: 100000,
  amplitude: 0.8,
  duration: 0.1,
});

// Memory management in DSP tests
import { clearMemoryPools } from "../utils/testMemoryManager";

afterEach(() => {
  clearMemoryPools();
});
```

## Continuous Integration

### GitHub Actions Workflows

1. **quality-checks.yml**: Runs unit tests with coverage
2. **e2e.yml**: Runs E2E and accessibility tests

### Test Execution in CI

- **Unit tests**: Run on every PR and push to main
- **E2E tests**: Run mock tests only (no real hardware)
- **Coverage**: Uploaded to Codecov for all PRs

### CI-Specific Behavior

- Parallel execution limited to 50% of cores
- Retries: 2 retries on failure (E2E only)
- Workers: 1 worker for E2E (prevents OOM)
- Timeout: 30 seconds per E2E test

## Debugging Tests

### Common Issues

1. **Memory leaks**: Use `--detectLeaks` and `clearMemoryPools()`
2. **Race conditions**: Use `waitFor()` from React Testing Library
3. **Flaky tests**: Add `--maxWorkers=1` to run serially
4. **Timeouts**: Increase `testTimeout` in jest.config.ts

### Debug Tools

```bash
# Run with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Run with verbose logging
npm test -- --verbose --no-coverage

# Generate coverage report
npm test -- --coverage --coverageReporters=html
open coverage/lcov-report/index.html
```

## Best Practices Summary

### Do's

✅ Write tests for all new features
✅ Keep tests fast and focused
✅ Use descriptive test names
✅ Mock external dependencies
✅ Test accessibility (ARIA, keyboard navigation)
✅ Maintain coverage thresholds
✅ Run tests before committing

### Don'ts

❌ Write flaky tests that sometimes pass
❌ Test implementation details
❌ Share state between tests
❌ Skip failing tests (fix or remove them)
❌ Commit code that reduces coverage
❌ Write tests that depend on external services

## Future Improvements

Potential enhancements to consider:

1. **Test sharding**: Split tests across multiple CI jobs
2. **Visual regression testing**: Screenshot comparison
3. **Performance benchmarks**: Track test execution time trends
4. **Mutation testing**: Validate test effectiveness
5. **Contract testing**: Test device interface compliance
