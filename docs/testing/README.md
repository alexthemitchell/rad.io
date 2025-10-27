# Testing Documentation

This directory contains comprehensive testing documentation for the rad.io project.

## Contents

### [Test Strategy](./TEST_STRATEGY.md)

Complete overview of the testing approach, including:

- Test categories (unit, integration, E2E)
- Test organization and structure
- Running tests (commands and options)
- Coverage requirements and thresholds
- Performance guidelines
- CI/CD integration

### [Test Data Generators](./TEST_DATA_GENERATORS.md)

Guide to using test data generators and utilities:

- Signal generators (`signalGenerator.ts`)
- Test helpers (`testHelpers.ts`)
- Mock creation utilities
- Common patterns and examples
- Best practices for test data

### [Test Reliability](./TEST_RELIABILITY.md)

Guide for identifying and fixing flaky tests:

- Common causes of test flakiness
- Debugging strategies
- Prevention techniques
- Best practices checklist
- Known issues and solutions

### [CI Optimization](./CI_OPTIMIZATION.md)

Strategies for optimizing test execution in CI:

- Current state and metrics
- Test sharding strategies
- Caching optimizations
- Selective test execution
- Performance monitoring
- Implementation roadmap

## Quick Start

### Running Tests Locally

```bash
# Run all unit tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/utils/__tests__/dsp.test.ts

# Run in watch mode
npm run test:watch

# Run E2E tests (mock + simulated)
npm run test:e2e

# Run only simulated E2E tests
npm run test:e2e:sim

# Run device E2E tests (requires real HackRF hardware)
npm run test:e2e:device
```

### Tracking Test Performance

```bash
# Enable performance reporter
TRACK_PERFORMANCE=1 npm test

# Generate detailed report
npm test -- --verbose --logHeapUsage
```

### Writing New Tests

1. **Choose the right location**:
   - Unit tests: `src/<module>/__tests__/<file>.test.ts`
   - E2E tests: `e2e/<feature>.spec.ts`

2. **Use appropriate test data**:

   ```typescript
   import { generateIQSamples } from "../utils/signalGenerator";
   import { createTestSamples } from "../utils/testHelpers";
   ```

3. **Follow best practices**:
   - Use descriptive test names
   - Clean up in `afterEach`
   - Mock external dependencies
   - Keep tests fast and focused

4. **Verify coverage**:
   ```bash
   npm test -- --coverage <your-test-file>
   ```

## Coverage Requirements

- **Global minimum**: 38% (statements, lines), 35% (branches), 39% (functions)
- **New code**: 80% patch coverage (enforced by Codecov)
- **Critical modules**: 57-96% (see `jest.config.ts`)

Coverage reports:

- Local: `coverage/lcov-report/index.html`
- CI: https://app.codecov.io/gh/alexthemitchell/rad.io

## Common Tasks

### Adding a New Test

```typescript
// src/utils/__tests__/myFeature.test.ts
import { myFeature } from "../myFeature";
import { generateIQSamples } from "../signalGenerator";

describe("myFeature", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should process samples correctly", () => {
    const samples = generateIQSamples({
      sampleRate: 2048000,
      frequency: 100000,
      amplitude: 0.8,
      duration: 0.1,
    });

    const result = myFeature(samples.samples);
    expect(result).toBeDefined();
  });
});
```

### Debugging a Flaky Test

```bash
# Run test 20 times to reproduce
for i in {1..20}; do npm test -- path/to/test.test.ts || break; done

# Run with single worker
npm test -- --maxWorkers=1 path/to/test.test.ts

# Run with detailed logging
npm test -- --verbose path/to/test.test.ts
```

See [TEST_RELIABILITY.md](./TEST_RELIABILITY.md) for detailed debugging guide.

### Optimizing Slow Tests

```bash
# Profile test execution
TRACK_PERFORMANCE=1 npm test

# Check heap usage
npm test -- --logHeapUsage

# Run specific test suite
npm run test:components  # Component tests only
npm run test:utils       # Utility tests only
```

See [CI_OPTIMIZATION.md](./CI_OPTIMIZATION.md) for optimization strategies.

### Generating Test Data

```typescript
// Simple sinusoid
const samples = generateIQSamples({
  sampleRate: 2048000,
  frequency: 100000,
  amplitude: 0.8,
  duration: 0.1,
});

// Multi-tone signal
const complex = generateMultiToneIQ({
  sampleRate: 2048000,
  tones: [
    { frequency: 100000, amplitude: 0.8 },
    { frequency: 200000, amplitude: 0.5 },
  ],
  duration: 0.1,
});

// FM modulation
const fm = generateFMIQ({
  sampleRate: 2048000,
  carrierFreq: 100000,
  modulationFreq: 1000,
  deviation: 5000,
  amplitude: 0.8,
  duration: 0.1,
});
```

See [TEST_DATA_GENERATORS.md](./TEST_DATA_GENERATORS.md) for all available generators.

## Test Organization

```
rad.io/
├── src/
│   ├── components/__tests__/       # Component unit tests
│   ├── hooks/__tests__/             # Hook tests
│   ├── models/__tests__/            # Device model tests
│   ├── utils/__tests__/             # Utility function tests
│   ├── lib/
│   │   ├── dsp/__tests__/           # DSP algorithm tests
│   │   ├── detection/__tests__/     # Signal detection tests
│   │   └── scanning/__tests__/      # Scanning logic tests
│   └── pages/__tests__/             # Page component tests
├── e2e/
│   ├── accessibility.spec.ts        # Accessibility smoke tests
│   ├── monitor-mock.spec.ts         # Mock device E2E tests
│   └── monitor-real.spec.ts         # Real hardware E2E tests
└── docs/
    └── testing/                     # Testing documentation (you are here)
```

## Best Practices

### Test Design

- ✅ Test behavior, not implementation
- ✅ Use descriptive test names
- ✅ Keep tests focused and small
- ✅ Mock external dependencies
- ✅ Use deterministic test data

### Test Execution

- ✅ Clean up in `afterEach`
- ✅ Avoid test interdependencies
- ✅ Handle async operations properly
- ✅ Use appropriate timeouts
- ✅ Run tests before committing

### Test Maintenance

- ✅ Fix failing tests immediately
- ✅ Update tests when code changes
- ✅ Remove obsolete tests
- ✅ Keep coverage above thresholds
- ✅ Document known issues

## Getting Help

- **Flaky tests**: See [TEST_RELIABILITY.md](./TEST_RELIABILITY.md)
- **Slow tests**: See [CI_OPTIMIZATION.md](./CI_OPTIMIZATION.md)
- **Test data**: See [TEST_DATA_GENERATORS.md](./TEST_DATA_GENERATORS.md)
- **General questions**: See [TEST_STRATEGY.md](./TEST_STRATEGY.md)

For project-specific questions, check:

- [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Project memories](.serena/memories/)

## CI Integration

Tests run automatically on:

- Every PR to `main`
- Every push to `main`
- Manual workflow dispatch

Workflows:

- `quality-checks.yml`: Unit tests with coverage
- `e2e.yml`: End-to-end and accessibility tests

CI configuration:

- **Parallel execution**: 50% of CPU cores
- **Timeout**: 30 seconds per test
- **Retries**: 2 retries for E2E tests
- **Coverage**: Uploaded to Codecov

## Metrics and Monitoring

Track test performance:

- **Total execution time**: Use `npm run test:perf` to measure
- **Total test count**: Varies based on test suite
- **Coverage**: See jest.config.ts for current thresholds
- **Pass rate**: Should be 100% on main branch

Enable performance tracking:

```bash
TRACK_PERFORMANCE=1 npm test
```

View performance report:

```bash
cat test-performance-report.json
```

## Future Improvements

Planned enhancements:

- [ ] Test sharding (4x faster CI)
- [ ] Selective test execution (80% faster PRs)
- [ ] Visual regression testing
- [ ] Performance benchmarking
- [ ] Mutation testing
- [ ] Contract testing for device interfaces

See [CI_OPTIMIZATION.md](./CI_OPTIMIZATION.md) for detailed roadmap.
