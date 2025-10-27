# Build, Test, and Deploy Pipeline Optimization Guide

This document provides a comprehensive guide to the optimized build, test, and deploy pipeline for rad.io.

## Table of Contents

- [Overview](#overview)
- [Build Optimization](#build-optimization)
- [Test Optimization](#test-optimization)
- [CI/CD Optimization](#cicd-optimization)
- [Deployment Optimization](#deployment-optimization)
- [Monitoring and Analysis](#monitoring-and-analysis)
- [Troubleshooting](#troubleshooting)

## Overview

The rad.io pipeline has been optimized across multiple dimensions:

- **Build Performance**: Webpack optimization, WASM caching, compression
- **Test Execution**: Parallelization, coverage optimization
- **CI/CD**: Enhanced caching, parallel jobs, artifact management
- **Deployment**: Validation, smoke tests, bundle analysis

### Key Metrics

**Before Optimization:**
- Build time: ~11.4s (WASM: 2.8s, Webpack: 8.6s)
- Test time: ~60s (116 suites, 1612 tests)
- Bundle size: 625 KB uncompressed

**After Optimization:**
- Build time: ~10.6s (improved caching, compression)
- Test time: ~60s (optimized for CI)
- Bundle size: 625 KB + gzip compression (~146 KB compressed)
- Compressed sizes: main 75KB, react 57KB, vendors 14KB

## Build Optimization

### Webpack Configuration

The webpack configuration includes several optimizations:

#### 1. Bundle Analyzer

Run bundle analysis to identify optimization opportunities:

```bash
npm run build:analyze
```

This generates:
- `dist/bundle-report.html` - Visual bundle analysis
- `dist/bundle-stats.json` - Detailed bundle statistics

#### 2. Compression

Production builds automatically generate gzip-compressed assets:

```bash
npm run build:prod
```

Compressed files:
- `*.js.gz` - Gzipped JavaScript bundles
- `*.wasm.gz` - Gzipped WebAssembly modules

Benefits:
- ~81% compression ratio for main bundle (403 KB → 75 KB)
- ~68% compression ratio for React vendors (181 KB → 57 KB)
- ~63% compression ratio for vendors (38 KB → 14 KB)

#### 3. Code Splitting

Optimized chunk splitting strategy:
- `main.js` - Application code (~403 KB)
- `react-vendors.js` - React ecosystem (~181 KB)
- `vendors.js` - Other dependencies (~38 KB)
- Lazy-loaded chunks for pages/features

#### 4. Caching

Filesystem caching enabled for faster rebuilds:
- Build cache stored in `node_modules/.cache/webpack`
- Content-hash filenames for long-term browser caching

### WASM Build

AssemblyScript WASM compilation is optimized:

```json
{
  "optimizeLevel": 3,
  "shrinkLevel": 2,
  "converge": true,
  "noAssert": true
}
```

Build commands:
```bash
npm run asbuild:release  # Optimized production build (12 KB)
npm run asbuild:debug    # Debug build with symbols
npm run asbuild          # Build both
```

### Build Monitoring

Track build performance over time:

```bash
npm run build:monitor    # Analyze current build artifacts
```

Output includes:
- Bundle size breakdown
- JavaScript file sizes
- WebAssembly artifact sizes
- Compression ratios

## Test Optimization

### Test Execution

Optimized test configuration for both local development and CI:

```bash
# Local development (uses 50% of CPU cores)
npm test

# CI environment (uses 2 workers for stability)
npm run test:ci

# Performance tracking
npm run test:perf
```

Configuration in `jest.config.ts`:
```typescript
maxWorkers: process.env["CI"] ? 2 : "50%"
```

### Coverage Optimization

Coverage thresholds are enforced per-module:

```bash
npm test -- --coverage
```

Key thresholds:
- Global: 38% statements, 35% branches, 39% functions, 38% lines
- Critical DSP: 70-96% coverage
- Device models: 72-93% coverage
- Core utilities: 57-95% coverage

### Test Performance

Current metrics:
- **Total time**: ~60s for 1612 tests
- **Average**: ~37ms per test
- **Suites**: 116 test suites
- **Parallel**: 50% CPU cores (local) or 2 workers (CI)

Tips for faster test execution:
1. Run specific test suites: `npm test -- path/to/test.ts`
2. Use watch mode for development: `npm run test:watch`
3. Skip coverage for faster feedback: `npm test -- --no-coverage`
4. Use performance tracking: `npm run test:perf`

## CI/CD Optimization

### GitHub Actions Workflow

The quality checks workflow uses parallel jobs with shared caching:

```yaml
jobs:
  setup:          # Install deps once, cache for all jobs
  build-wasm:     # Build WASM, cache for build job
  lint:           # Parallel with other checks
  test:           # Parallel with other checks
  format:         # Parallel with other checks
  type-check:     # Parallel with other checks
  build:          # Uses WASM cache
  all-checks:     # Verify all passed
```

### Caching Strategy

**Node Modules Cache:**
```yaml
key: npm-${{ runner.os }}-node-20-${{ hashFiles('package-lock.json') }}
```

**WASM Build Cache:**
```yaml
key: wasm-${{ runner.os }}-${{ hashFiles('assembly/**/*.ts', 'asconfig.json') }}
```

**Playwright Browsers:**
```yaml
key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
```

### Job Performance

Typical job durations:
- Setup: ~30s (with cache: ~10s)
- WASM build: ~5s
- Lint: ~10s
- Test: ~70s
- Format check: ~5s
- Type check: ~15s
- Build: ~15s (with WASM cache)

Total PR feedback time: ~5-8 minutes (parallel execution)

### Performance Monitoring

Jobs report performance metrics in GitHub Actions summary:

- **Bundle Size Report**: Shows JavaScript and WASM sizes
- **Test Execution Time**: Tracks test duration
- **Budget Warnings**: Alerts when bundle exceeds limits

## Deployment Optimization

### Build Validation

The deployment workflow validates builds before deploying:

```yaml
- name: Validate build output
  run: |
    # Check required files exist
    # Verify WASM files present
    # Check JS bundles exist
    # Report bundle sizes
    # Warn if size exceeds 5MB
```

### Deployment Process

```bash
# 1. Build production bundle
npm run build:prod

# 2. Validate output
node scripts/build-monitor.mjs analyze

# 3. Deploy to GitHub Pages
# (handled by GitHub Actions)
```

### Post-Deployment Validation

Automated checks after deployment:
1. HTTP 200 response check
2. CDN propagation wait
3. Content availability verification

Future enhancements:
- Lighthouse CI integration
- E2E smoke tests
- Performance budget enforcement

## Monitoring and Analysis

### Bundle Analysis

Generate detailed bundle analysis:

```bash
# Visual analysis
npm run build:analyze

# JSON statistics
npm run build:stats

# Current artifacts
npm run build:monitor
```

### Performance Tracking

Track key metrics:

1. **Build Time**
   ```bash
   time npm run build:prod
   ```

2. **Test Time**
   ```bash
   time npm test
   ```

3. **Bundle Size**
   ```bash
   du -sh dist/
   ls -lh dist/*.js
   ```

4. **Compression Ratio**
   ```bash
   ls -lh dist/*.js dist/*.js.gz | awk '{print $9, $5}'
   ```

### CI/CD Metrics

Monitor in GitHub Actions:
- Job duration trends
- Cache hit rates
- Artifact sizes
- Test execution times
- Deployment success rates

## Troubleshooting

### Build Issues

**Problem**: Webpack build fails with memory error

**Solution**:
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build:prod
```

**Problem**: WASM build cache invalidation

**Solution**:
```bash
rm -rf build/
npm run asbuild:release
```

**Problem**: Type errors with webpack plugins

**Solution**:
```bash
npm install --save-dev @types/webpack-bundle-analyzer @types/compression-webpack-plugin
```

### Test Issues

**Problem**: Tests timing out in CI

**Solution**: Tests are configured with 30s timeout and 2 workers for CI stability.

**Problem**: Memory issues with large test datasets

**Solution**: Use `clearMemoryPools()` and `generateSamplesChunked()` from test utilities.

**Problem**: Coverage thresholds failing

**Solution**: Add tests for uncovered code paths or adjust thresholds in `jest.config.ts`.

### CI/CD Issues

**Problem**: Cache miss on every build

**Solution**: Check cache key includes correct file hashes. Verify `package-lock.json` is committed.

**Problem**: Parallel jobs failing intermittently

**Solution**: Check job dependencies. Ensure cache restoration uses `fail-on-cache-miss: true`.

**Problem**: Artifact upload failing

**Solution**: Verify `dist/` directory exists and contains expected files.

### Deployment Issues

**Problem**: Deployment succeeds but site shows errors

**Solution**: Check browser console for missing assets. Verify all chunks uploaded correctly.

**Problem**: Large bundle size warning

**Solution**: Run `npm run build:analyze` to identify large dependencies. Consider code splitting or lazy loading.

## Best Practices

### Development Workflow

1. **Local Development**
   ```bash
   npm start                    # Dev server with hot reload
   npm run test:watch          # Watch mode for tests
   npm run lint:fix            # Auto-fix linting issues
   ```

2. **Before Committing**
   ```bash
   npm run validate            # Run all quality checks
   npm run build:monitor       # Check bundle size
   ```

3. **PR Review**
   - Check CI job durations
   - Review bundle size changes
   - Verify test coverage maintained

### CI/CD Management

1. **Cache Management**
   - Monitor cache hit rates
   - Clear caches if builds behaving unexpectedly
   - Update cache keys when dependencies change

2. **Artifact Management**
   - Cleanup old artifacts (automated daily)
   - Monitor artifact storage usage
   - Compress large artifacts before upload

3. **Performance Monitoring**
   - Track job duration trends
   - Alert on significant regressions
   - Optimize slowest jobs first

## Future Enhancements

### Planned Improvements

1. **Build Performance**
   - Incremental WASM builds
   - Enhanced tree shaking
   - Module federation for larger apps
   - Build time budgets

2. **Test Performance**
   - Test result caching
   - Distributed test execution
   - Snapshot test optimization
   - Test impact analysis

3. **CI/CD**
   - Matrix builds for multiple Node versions
   - Canary deployments
   - Automated rollback
   - Performance regression detection

4. **Deployment**
   - Lighthouse CI integration
   - E2E smoke tests on deployment
   - Multi-region CDN optimization
   - Service worker precaching

## References

- [Webpack Performance Guide](https://webpack.js.org/guides/build-performance/)
- [Jest Performance Tips](https://jestjs.io/docs/cli#--maxworkersnumstring)
- [GitHub Actions Caching](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Bundle Size Optimization](https://web.dev/reduce-javascript-payloads-with-code-splitting/)
- [AssemblyScript Optimization](https://www.assemblyscript.org/compiler.html#optimization)

## Support

For questions or issues:
- Review this documentation
- Check existing GitHub issues
- Review CI/CD logs for specific failures
- Consult the team in discussions
