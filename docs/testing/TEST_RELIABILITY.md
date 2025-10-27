# Test Reliability and Flakiness Guide

## Overview

This guide helps identify, debug, and fix flaky tests in the rad.io project. Flaky tests are tests that sometimes pass and sometimes fail without code changes.

## Common Causes of Flaky Tests

### 1. Race Conditions

**Symptoms:**

- Test passes locally but fails in CI
- Test fails intermittently
- Timing-related failures

**Examples:**

```typescript
// ❌ Bad: Race condition with async rendering
test('should update after state change', () => {
  const { getByText } = render(<Component />);
  act(() => {
    fireEvent.click(getByText('Update'));
  });
  // State update is async, may not be reflected yet
  expect(getByText('Updated')).toBeInTheDocument();
});

// ✅ Good: Wait for async updates
test('should update after state change', async () => {
  const { getByText, findByText } = render(<Component />);
  act(() => {
    fireEvent.click(getByText('Update'));
  });
  // Wait for the update to appear
  expect(await findByText('Updated')).toBeInTheDocument();
});
```

**Solutions:**

- Use `waitFor()` from React Testing Library
- Use `findBy*` queries (built-in waiting)
- Use `act()` for state updates
- Avoid arbitrary `setTimeout()`

### 2. Shared State Between Tests

**Symptoms:**

- Tests pass when run individually
- Tests fail when run together
- Order-dependent failures

**Examples:**

```typescript
// ❌ Bad: Shared global state
let globalDevice: SDRDevice;

test("should connect device", () => {
  globalDevice = new MockSDRDevice();
  expect(globalDevice.connect()).resolves.toBe(true);
});

test("should disconnect device", () => {
  // Depends on previous test!
  expect(globalDevice.disconnect()).resolves.toBe(true);
});

// ✅ Good: Independent tests with setup/teardown
describe("Device operations", () => {
  let device: SDRDevice;

  beforeEach(() => {
    device = new MockSDRDevice();
  });

  afterEach(() => {
    device.disconnect();
  });

  test("should connect device", async () => {
    expect(await device.connect()).toBe(true);
  });

  test("should disconnect device", async () => {
    await device.connect();
    expect(await device.disconnect()).toBe(true);
  });
});
```

**Solutions:**

- Use `beforeEach`/`afterEach` for setup/teardown
- Clear global state in `afterEach`
- Avoid test interdependencies
- Use `--runInBand` to diagnose

### 3. Non-Deterministic Data

**Symptoms:**

- Random test failures
- Different results with same input
- Math/calculation errors

**Examples:**

```typescript
// ❌ Bad: Random data leads to unpredictable tests
test("should detect signal", () => {
  const samples = generateNoiseIQ({
    sampleRate: 2048000,
    amplitude: Math.random(), // Non-deterministic!
    duration: Math.random() * 0.2,
  });

  const detected = detectSignal(samples);
  expect(detected).toBe(true); // May fail randomly
});

// ✅ Good: Deterministic test data
test("should detect signal", () => {
  const rng = new SeededRandom(42);
  const samples = generateNoiseIQ({
    sampleRate: 2048000,
    amplitude: rng.range(0.5, 1.0),
    duration: 0.1,
  });

  const detected = detectSignal(samples);
  expect(detected).toBe(true); // Consistent
});
```

**Solutions:**

- Use `SeededRandom` for reproducible randomness
- Use fixed test data
- Avoid `Math.random()` in tests
- Use `Date.now()` mock for time-based tests

### 4. Fake Timers Issues

**Symptoms:**

- Tests hang or timeout
- Timer-related failures
- Inconsistent timing behavior

**Examples:**

```typescript
// ❌ Bad: Mixing real and fake timers
test("should update every second", () => {
  jest.useFakeTimers();
  const callback = jest.fn();

  setInterval(callback, 1000);

  // Using real async with fake timers - BAD!
  await waitFor(() => expect(callback).toHaveBeenCalled());

  jest.useRealTimers();
});

// ✅ Good: Consistent timer usage
test("should update every second", () => {
  jest.useFakeTimers();
  const callback = jest.fn();

  setInterval(callback, 1000);

  // Advance fake timers
  jest.advanceTimersByTime(1000);
  expect(callback).toHaveBeenCalledTimes(1);

  jest.advanceTimersByTime(1000);
  expect(callback).toHaveBeenCalledTimes(2);

  jest.useRealTimers();
});
```

**Solutions:**

- Always restore timers in `afterEach`
- Don't mix fake and real timers
- Use `jest.advanceTimersByTime()` consistently
- Clear timers in cleanup

### 5. Memory Leaks

**Symptoms:**

- Tests slow down over time
- Out of memory errors
- Failing after many tests

**Examples:**

```typescript
// ❌ Bad: Memory leak from unreleased resources
test("should process spectrum", () => {
  const samples = new Float32Array(1024 * 1024); // Large allocation
  processSpectrum(samples);
  // samples not released
});

// ✅ Good: Clean up resources
test("should process spectrum", () => {
  const samples = new Float32Array(1024 * 1024);
  processSpectrum(samples);

  // Explicit cleanup
  clearMemoryPools();
});

describe("DSP tests", () => {
  afterEach(() => {
    clearMemoryPools();
    jest.clearAllMocks();
  });

  // ... tests
});
```

**Solutions:**

- Call `clearMemoryPools()` in `afterEach`
- Unmount React components
- Clear intervals/timeouts
- Run with `--detectLeaks` to find issues

### 6. Mock Issues

**Symptoms:**

- Mocks from previous tests interfere
- Unexpected mock behavior
- Mock state persists between tests

**Examples:**

```typescript
// ❌ Bad: Mock persists across tests
jest.mock("../utils/dsp", () => ({
  calculateFFT: jest.fn(() => new Float32Array(1024)),
}));

test("test 1", () => {
  calculateFFT(samples);
  expect(calculateFFT).toHaveBeenCalledTimes(1);
});

test("test 2", () => {
  calculateFFT(samples);
  // Will be 2 if test 1 ran first!
  expect(calculateFFT).toHaveBeenCalledTimes(1);
});

// ✅ Good: Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

test("test 1", () => {
  calculateFFT(samples);
  expect(calculateFFT).toHaveBeenCalledTimes(1);
});

test("test 2", () => {
  calculateFFT(samples);
  expect(calculateFFT).toHaveBeenCalledTimes(1);
});
```

**Solutions:**

- Call `jest.clearAllMocks()` in `beforeEach`
- Use `jest.resetModules()` for module mocks
- Avoid persistent mock state
- Use `jest.restoreAllMocks()` for spies

### 7. Browser API Availability

**Symptoms:**

- Tests fail in CI but pass locally
- Missing browser APIs
- Feature detection issues

**Examples:**

```typescript
// ❌ Bad: Assumes browser APIs exist
test("should use WebGL", () => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl");

  // gl might be null in CI!
  gl.clearColor(0, 0, 0, 1);
});

// ✅ Good: Graceful fallback or mocking
test("should use WebGL", () => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl");

  if (!gl) {
    // Mock WebGL context
    const mockGL = createMockWebGLContext();
    jest.spyOn(canvas, "getContext").mockReturnValue(mockGL);
  }

  const context = canvas.getContext("webgl");
  expect(context).toBeDefined();
});
```

**Solutions:**

- Mock unavailable APIs in jest.setup.ts
- Use feature detection
- Provide test-specific implementations
- Use `createMockWebGLContext()` helper

## Debugging Flaky Tests

### Step 1: Reproduce Locally

```bash
# Run test multiple times
for i in {1..20}; do
  npm test -- path/to/test.test.ts || break
done

# Run with different workers
npm test -- --maxWorkers=1 path/to/test.test.ts
npm test -- --maxWorkers=4 path/to/test.test.ts

# Run in random order
npm test -- --randomize path/to/test.test.ts
```

### Step 2: Isolate the Problem

```bash
# Run only the failing test
npm test -- --testNamePattern="specific test name"

# Run test file in isolation
npm test -- path/to/test.test.ts

# Run with verbose logging
npm test -- --verbose path/to/test.test.ts
```

### Step 3: Check for Common Issues

```typescript
// Add debugging output
test("should work", () => {
  console.log("State before:", getState());

  // ... test code ...

  console.log("State after:", getState());
});

// Check mock state
test("should work", () => {
  console.log("Mock calls:", mockFn.mock.calls);
  console.log("Mock results:", mockFn.mock.results);
});

// Verify cleanup
afterEach(() => {
  console.log("Timers remaining:", jest.getTimerCount());
  console.log("Mocks remaining:", jest.isMockFunction(fn));
});
```

### Step 4: Use Jest Debugging Tools

```bash
# Run with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand test.test.ts

# Detect memory leaks
npm test -- --detectLeaks --runInBand

# Log heap usage
npm test -- --logHeapUsage

# Expose garbage collector
node --expose-gc node_modules/.bin/jest test.test.ts
```

## Prevention Strategies

### 1. Test Hygiene Checklist

Every test should:

- [ ] Clean up in `afterEach`
- [ ] Not depend on other tests
- [ ] Use deterministic data
- [ ] Avoid real timers/delays
- [ ] Clear mocks between runs
- [ ] Handle async properly

### 2. Code Review Checklist

For new tests, verify:

- [ ] No `Math.random()` or `Date.now()`
- [ ] No global state modifications
- [ ] Proper async/await usage
- [ ] Mocks are cleared
- [ ] Resources are released

### 3. CI Configuration

```yaml
# .github/workflows/quality-checks.yml
test:
  steps:
    - name: Run tests (detect flakiness)
      run: npm test -- --maxWorkers=2 --randomize

    - name: Retry failed tests
      if: failure()
      run: npm test -- --onlyFailures --maxWorkers=1
```

### 4. Automated Flake Detection

```typescript
// jest-flake-detector.js
class FlakeDetector {
  onTestResult(test, testResult) {
    testResult.testResults.forEach((result) => {
      if (result.status === "failed") {
        // Log potential flake
        console.log(`Potential flake: ${result.fullName}`);
      }
    });
  }
}
```

## Known Flaky Tests

### Current Issues (if any)

Document known flaky tests and their status:

```typescript
// Known flaky test - under investigation
test.skip("should handle race condition", () => {
  // TODO: Fix race condition in useEffect
  // Tracked in: #123
});
```

## Best Practices Summary

### Do's ✅

1. **Use React Testing Library's async utilities**

   ```typescript
   await findByText("Expected text");
   await waitFor(() => expect(condition).toBe(true));
   ```

2. **Clean up in afterEach**

   ```typescript
   afterEach(() => {
     clearMemoryPools();
     jest.clearAllMocks();
     jest.useRealTimers();
   });
   ```

3. **Use deterministic data**

   ```typescript
   const rng = new SeededRandom(42);
   const samples = generateIQSamples({
     /* fixed params */
   });
   ```

4. **Isolate tests**

   ```typescript
   let device: SDRDevice;
   beforeEach(() => {
     device = new MockSDRDevice();
   });
   afterEach(() => {
     device.cleanup();
   });
   ```

5. **Handle async properly**
   ```typescript
   const promise = asyncFunction();
   await expect(promise).resolves.toBe(expected);
   ```

### Don'ts ❌

1. **Don't use arbitrary timeouts**

   ```typescript
   // Bad: await new Promise(resolve => setTimeout(resolve, 1000));
   // Good: await waitFor(() => expect(condition).toBe(true));
   ```

2. **Don't share state**

   ```typescript
   // Bad: let sharedData;
   // Good: Create fresh data in beforeEach
   ```

3. **Don't forget cleanup**

   ```typescript
   // Bad: setInterval without cleanup
   // Good: Clear in afterEach
   ```

4. **Don't mix timer types**

   ```typescript
   // Bad: jest.useFakeTimers() + real setTimeout
   // Good: Consistent fake timer usage
   ```

5. **Don't ignore warnings**
   ```typescript
   // Fix "not wrapped in act()" warnings
   // Fix "memory leak" warnings
   ```

## Resources

- [React Testing Library: Async Methods](https://testing-library.com/docs/dom-testing-library/api-async/)
- [Jest: Timer Mocks](https://jestjs.io/docs/timer-mocks)
- [Kent C. Dodds: Fix act() Warnings](https://kentcdodds.com/blog/fix-the-not-wrapped-in-act-warning)
- [Martin Fowler: Test Isolation](https://martinfowler.com/bliki/TestIsolation.html)

## Getting Help

If you encounter a flaky test:

1. **Document it**: Add a comment with reproduction steps
2. **Report it**: Create an issue with the `flaky-test` label
3. **Isolate it**: Use `test.skip()` if blocking development
4. **Fix it**: Follow this guide to resolve the root cause
