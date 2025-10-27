# CI Test Optimization Guide

## Current State

### Test Execution Times

- **Unit tests**: ~56 seconds (109 suites, 1534 tests)
- **E2E tests**: ~15-30 seconds (3 test files)
- **Total CI time**: ~2-3 minutes per workflow

### Current Configuration

```yaml
# quality-checks.yml
test:
  runs-on: ubuntu-latest
  steps:
    - run: npm test -- --coverage

# e2e.yml
e2e:
  runs-on: ubuntu-latest
  timeout-minutes: 30
  steps:
    - run: npm run test:e2e
```

## Optimization Strategies

### 1. Test Sharding (Parallel Jobs)

Split tests across multiple CI jobs for faster feedback.

#### Recommended Implementation

**Option A: Manual Sharding by Directory**

```yaml
# .github/workflows/quality-checks.yml
test:
  name: Run Tests
  strategy:
    matrix:
      shard:
        - utils
        - components
        - models
        - hooks
        - visualization
        - integration
  runs-on: ubuntu-latest
  steps:
    - name: Run test shard
      run: npm test -- --testPathPattern="src/${{ matrix.shard }}"

    - name: Upload coverage
      uses: codecov/codecov-action@v5
      with:
        flags: ${{ matrix.shard }}
```

**Benefits:**

- 6 parallel jobs = ~6x faster (theoretical)
- Per-component coverage tracking
- Early failure detection

**Option B: Jest's Built-in Sharding**

```yaml
# .github/workflows/quality-checks.yml
test:
  name: Run Tests (Shard ${{ matrix.shard }})
  strategy:
    matrix:
      shard: [1, 2, 3, 4]
  runs-on: ubuntu-latest
  steps:
    - name: Run test shard
      run: npm test -- --shard=${{ matrix.shard }}/4 --coverage

    - name: Upload coverage
      uses: codecov/codecov-action@v5
      with:
        flags: shard-${{ matrix.shard }}
```

**Benefits:**

- Automatic load balancing
- Simpler configuration
- 4 parallel jobs = ~4x faster

### 2. Caching Strategy

Optimize caching to reduce setup time.

#### Current Implementation

```yaml
- name: Cache node_modules
  uses: actions/cache/save@v4
  with:
    path: |
      node_modules
      ~/.npm
    key: npm-${{ runner.os }}-node-20-${{ hashFiles('package-lock.json') }}
```

#### Recommended Enhancements

```yaml
- name: Restore test cache
  uses: actions/cache@v4
  with:
    path: |
      node_modules
      ~/.npm
      build/          # WASM builds
      .jest-cache     # Jest transform cache
    key: test-${{ runner.os }}-${{ hashFiles('package-lock.json', 'assembly/**') }}-${{ github.run_id }}
    restore-keys: |
      test-${{ runner.os }}-${{ hashFiles('package-lock.json', 'assembly/**') }}-
      test-${{ runner.os }}-
```

**Benefits:**

- Faster test startup
- Reduced WASM rebuild time
- Jest transform caching

### 3. Selective Test Execution

Run only affected tests on PRs.

#### Implementation

```yaml
# .github/workflows/quality-checks.yml
test:
  name: Run Tests
  runs-on: ubuntu-latest
  steps:
    - name: Get changed files
      id: changed-files
      uses: tj-actions/changed-files@v44
      with:
        files: |
          src/**/*.ts
          src/**/*.tsx

    - name: Run affected tests
      if: steps.changed-files.outputs.any_changed == 'true'
      run: |
        # Run tests related to changed files
        npm test -- --findRelatedTests ${{ steps.changed-files.outputs.all_changed_files }}

    - name: Run all tests (main branch)
      if: github.ref == 'refs/heads/main'
      run: npm test -- --coverage
```

**Benefits:**

- Faster PR feedback
- Full coverage on main branch
- Reduced CI compute time

### 4. Test Timeout Optimization

Adjust timeouts based on test type.

#### Recommended Configuration

```typescript
// jest.config.ts
const config: Config = {
  testTimeout: process.env.CI ? 10000 : 30000, // 10s in CI, 30s local

  // Fast tests in CI with fewer retries
  maxWorkers: process.env.CI ? "75%" : "50%",

  // Optimize memory usage
  workerIdleMemoryLimit: "512MB",
};
```

### 5. E2E Test Parallelization

Run E2E tests in parallel when safe.

#### Current Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
});
```

#### Recommended Enhancement

```typescript
// playwright.config.ts
export default defineConfig({
  // Enable parallel for independent tests
  fullyParallel: true,

  // More workers with resource limits
  workers: process.env.CI ? 2 : 3,

  // Limit parallel tests per file
  maxFailures: 3,

  // Retry configuration
  retries: process.env.CI ? 2 : 0,
});
```

**Benefits:**

- 2x faster E2E execution
- Still memory-safe in CI
- Better resource utilization

### 6. Coverage Upload Optimization

Reduce coverage upload overhead.

#### Current Implementation

```yaml
- name: Upload coverage reports to Codecov
  uses: codecov/codecov-action@v5
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: ./coverage/lcov.info,./coverage/coverage-final.json
    flags: unittests
    name: codecov-umbrella
    fail_ci_if_error: true
    verbose: true
```

#### Recommended Enhancement

```yaml
- name: Upload coverage reports to Codecov
  uses: codecov/codecov-action@v5
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: ./coverage/lcov.info
    flags: unittests-${{ matrix.shard }}
    fail_ci_if_error: true
    verbose: false # Reduce log noise

    # Skip redundant uploads
    disable_search: true
    disable_file_fixes: true
```

**Benefits:**

- Faster upload (single file)
- Per-shard flags for tracking
- Reduced CI log noise

## Recommended Implementation Plan

### Phase 1: Low-Hanging Fruit (Immediate)

1. **Enable Jest caching**

   ```typescript
   // jest.config.ts
   cacheDirectory: ".jest-cache",
   ```

2. **Optimize test timeouts**

   ```typescript
   testTimeout: process.env.CI ? 10000 : 30000,
   ```

3. **Increase E2E parallelism**
   ```typescript
   workers: process.env.CI ? 2 : 3,
   ```

**Expected Impact:** 15-20% faster CI

### Phase 2: Test Sharding (1-2 hours)

1. **Add Jest sharding to quality-checks.yml**

   ```yaml
   matrix:
     shard: [1, 2, 3, 4]
   run: npm test -- --shard=${{ matrix.shard }}/4
   ```

2. **Update coverage upload**
   ```yaml
   flags: shard-${{ matrix.shard }}
   ```

**Expected Impact:** 3-4x faster test execution

### Phase 3: Selective Testing (2-3 hours)

1. **Add changed-files detection**
2. **Implement affected tests logic**
3. **Maintain full coverage on main**

**Expected Impact:** 50-80% faster PR checks

### Phase 4: Advanced Optimizations (Optional)

1. **Test result caching** (skip unchanged tests)
2. **Incremental coverage** (only new code)
3. **Test impact analysis** (smarter selection)

**Expected Impact:** 80-90% faster for small changes

## Monitoring and Metrics

### Add Performance Tracking

```yaml
# .github/workflows/quality-checks.yml
- name: Track test performance
  run: |
    echo "::notice::Test execution time: ${{ steps.test.outputs.time }}s"

    # Export to GitHub Actions metrics
    echo "test_duration_seconds{shard=\"${{ matrix.shard }}\"} ${{ steps.test.outputs.time }}" >> metrics.txt
```

### Dashboard Metrics

Track over time:

- Total CI execution time
- Test execution time per shard
- Coverage upload time
- Cache hit rate
- Flaky test count

### Alert Thresholds

```yaml
- name: Check performance regression
  run: |
    if [ ${{ steps.test.outputs.time }} -gt 20 ]; then
      echo "::warning::Tests took longer than expected (${steps.test.outputs.time}s > 20s)"
    fi
```

## Cost Benefit Analysis

### Current State

- **Unit tests**: ~56s on single job
- **E2E tests**: ~15s on single job
- **Total**: ~71s compute time

### After Phase 1 (Low effort)

- **Unit tests**: ~45s (-20%)
- **E2E tests**: ~12s (-20%)
- **Total**: ~57s compute time
- **Wall clock**: Same (sequential)

### After Phase 2 (Sharding)

- **Unit tests**: ~14s per shard (4 parallel)
- **E2E tests**: ~8s (2 parallel)
- **Total**: ~112s compute time (+58%)
- **Wall clock**: ~14s (-80%)

**Trade-off:** 58% more compute, 80% faster feedback

### After Phase 3 (Selective)

- **Unit tests (PR)**: ~5-10s (affected only)
- **Unit tests (main)**: ~14s (full)
- **Wall clock (PR)**: ~5-10s (-93%)
- **Wall clock (main)**: ~14s (-80%)

**Trade-off:** Minimal compute increase, massive PR speedup

## Recommendations

### For Immediate Implementation

1. ✅ **Enable Jest caching** (5 min setup)
2. ✅ **Add performance reporter** (already implemented)
3. ✅ **Increase E2E workers to 2** (1 line change)
4. ✅ **Reduce test timeout to 10s in CI** (1 line change)

**Expected result:** 15-20% faster CI, no downside

### For Next Sprint

1. 🟡 **Implement test sharding** (1-2 hours)
   - 4 shards for unit tests
   - Benefits: 3-4x faster feedback
   - Trade-off: More compute minutes

2. 🟡 **Add selective test execution** (2-3 hours)
   - Run affected tests on PRs
   - Full tests on main branch
   - Benefits: 80%+ faster PR checks

### Future Considerations

1. 🔵 **Test impact analysis**
2. 🔵 **Incremental coverage**
3. 🔵 **Visual regression testing**
4. 🔵 **Performance benchmarking**

## Conclusion

The most impactful optimizations are:

1. **Test sharding** - Fastest wins with minimal complexity
2. **Selective testing** - Best for PR velocity
3. **E2E parallelization** - Simple 2x speedup

Recommended approach: Start with Phase 1 (immediate), then Phase 2 (sharding), evaluate before Phase 3.
