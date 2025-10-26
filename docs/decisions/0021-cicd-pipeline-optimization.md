# ADR-0021: CI/CD Pipeline Optimization

**Status:** Accepted  
**Date:** 2025-10-26  
**Deciders:** CI/CD Team

## Context

The rad.io CI/CD pipeline had several inefficiencies that were slowing down builds and wasting GitHub Actions minutes:

1. **Redundant dependency installation**: Each job ran `npm ci` independently (~30-60s per job)
2. **No caching strategy**: WASM builds were rebuilt on every run
3. **Sequential execution**: Independent jobs (lint, format, type-check) could run in parallel
4. **Suboptimal webpack configuration**: Using development config in CI, no code splitting
5. **Playwright browser installation**: Browsers reinstalled on every run (~2-3 minutes)

### Baseline Performance (Pre-Optimization)

- WASM build: ~1.8s
- Webpack build (dev): ~3.9s (total with WASM)
- Webpack build (prod): Not used
- Tests without coverage: ~28.6s
- Tests with coverage: ~44.8s (57% overhead)
- Lint: ~13.2s
- Total pipeline time: ~90-120s (estimated)

### Key Bottlenecks Identified

1. **npm ci** run 5 times in quality-checks workflow
2. WASM build run 2 times (build + deploy jobs)
3. Playwright browsers downloaded on every E2E run
4. No incremental build support
5. Development webpack config used in CI (no optimizations)

## Decision

We have implemented the following optimizations:

### 1. Shared Dependency Installation

Created a `setup` job that installs dependencies once and caches `node_modules` for all subsequent jobs:

```yaml
setup:
  steps:
    - name: Install dependencies
      run: npm ci
    - name: Cache node_modules
      uses: actions/cache/save@v4
      with:
        path: |
          node_modules
          ~/.npm
        key: npm-${{ runner.os }}-node-20-${{ hashFiles('package-lock.json') }}
```

All other jobs now restore from this cache:

```yaml
- name: Restore node_modules cache
  uses: actions/cache/restore@v4
  with:
    fail-on-cache-miss: true
```

### 2. WASM Build Caching

Created a separate `build-wasm` job that builds AssemblyScript once and caches the result:

```yaml
build-wasm:
  needs: setup
  steps:
    - name: Build AssemblyScript WASM
      run: npm run asbuild:release
    - name: Cache WASM build
      uses: actions/cache/save@v4
      with:
        path: build/
        key: wasm-${{ runner.os }}-${{ hashFiles('assembly/**/*.ts', 'asconfig.json') }}
```

The build job now restores this cache instead of rebuilding WASM.

### 3. Job Parallelization

Updated job dependencies to run independent jobs in parallel:

```yaml
jobs:
  setup: {}
  build-wasm:
    needs: setup
  lint:
    needs: setup # Runs in parallel with format, type-check, test
  format:
    needs: setup
  type-check:
    needs: setup
  test:
    needs: setup
  build:
    needs: [setup, build-wasm]
```

### 4. Webpack Optimization

Updated `webpack.config.js` to:

- Support both development and production modes via `argv.mode`
- Enable code splitting with separate chunks for React, vendors, and main code
- Use content hashing for production builds for better caching
- Add performance budgets
- Clean dist directory on each build

```javascript
module.exports = (env, argv) => {
  const isDevelopment = argv.mode === "development";
  return {
    mode: isDevelopment ? "development" : "production",
    output: {
      filename: isDevelopment ? "[name].js" : "[name].[contenthash].js",
      clean: true,
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          react: {
            /* 181 KB chunk */
          },
          vendor: {
            /* 37.9 KB chunk */
          },
        },
      },
    },
  };
};
```

Updated `package.json` scripts:

```json
{
  "build": "npm run asbuild:release && webpack --mode development",
  "build:prod": "npm run asbuild:release && webpack --mode production"
}
```

### 5. Playwright Browser Caching

Added caching for Playwright browsers in the E2E workflow:

```yaml
- name: Cache Playwright browsers
  id: playwright-cache
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

- name: Install Playwright browsers
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install --with-deps
```

### 6. Deploy Pipeline Optimization

Added build caching to deploy-pages workflow:

```yaml
- name: Restore build cache
  uses: actions/cache@v4
  with:
    key: deploy-${{ runner.os }}-${{ hashFiles('package-lock.json', 'src/**', 'assembly/**', 'webpack.config.js') }}
```

## Consequences

### Positive

1. **Faster CI/CD runs**: Estimated 40-60% reduction in pipeline execution time
   - Dependency installation: 1 time instead of 5 times (saves ~2-4 minutes)
   - WASM build: Cached and reused (saves ~1-2 seconds per job)
   - Playwright browsers: Cached between runs (saves ~2-3 minutes)
   - Parallel execution: lint, format, type-check run simultaneously

2. **Production-optimized builds**: Production deployments now use minified, code-split bundles
   - Bundle size reduced from 5.9 MB (dev) to 628 KB (prod) - 89% reduction
   - React vendors: 181 KB separate chunk
   - Vendors: 37.9 KB separate chunk
   - Main: 367 KB separate chunk

3. **Better caching**: Content hashes enable long-term browser caching of unchanged code

4. **Cost savings**: Fewer GitHub Actions minutes used per run

5. **Improved parallelism**: Independent jobs run concurrently

### Negative

1. **Added complexity**: Workflow files are more complex with cache management
2. **Cache storage**: Uses GitHub Actions cache storage (10 GB limit per repo)
3. **Cache invalidation**: Need to monitor cache hit rates and adjust keys if needed
4. **Initial runs**: First run after cache clear is slower due to cache population

### Neutral

1. **Maintenance**: Need to maintain cache keys and update when dependencies change
2. **Monitoring**: Should monitor cache hit rates and job execution times

## Expected Performance Improvements

Based on the optimizations:

| Metric                  | Before               | After                     | Improvement          |
| ----------------------- | -------------------- | ------------------------- | -------------------- |
| Dependency installation | 5x (~150-300s)       | 1x + cache restore (~30s) | 80-90% faster        |
| WASM build              | 2x (~3.6s)           | 1x + cache (~2s)          | 45% faster           |
| Webpack build           | Dev mode             | Production mode           | 90% smaller bundle   |
| Playwright setup        | Full install (~180s) | Cache restore (~10s)      | 95% faster           |
| Job parallelism         | Sequential           | Parallel                  | 3-5x concurrent jobs |
| Total pipeline          | ~90-120s             | ~35-60s                   | 40-60% faster        |

## Implementation Notes

### Cache Key Strategy

- **npm dependencies**: `npm-${{ runner.os }}-node-20-${{ hashFiles('package-lock.json') }}`
- **WASM build**: `wasm-${{ runner.os }}-${{ hashFiles('assembly/**/*.ts', 'asconfig.json') }}`
- **Playwright browsers**: `playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}`
- **Deploy build**: Includes source files for fine-grained invalidation

### Monitoring

Monitor these metrics to validate optimizations:

1. GitHub Actions workflow run times
2. Cache hit rates in workflow logs
3. Bundle sizes in webpack output
4. Coverage report upload times

### Future Optimizations

Potential future improvements:

1. **Matrix builds**: Test on multiple Node versions if needed
2. **Conditional jobs**: Skip unchanged areas using path filters
3. **Incremental testing**: Only test changed files
4. **Remote caching**: Use remote cache service for larger projects
5. **Coverage optimization**: Separate coverage job or disable for draft PRs
6. **Build artifacts**: Share between workflows via artifacts instead of rebuilding

## References

- [GitHub Actions Cache Documentation](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Webpack Production Optimization](https://webpack.js.org/guides/production/)
- [Playwright CI Guide](https://playwright.dev/docs/ci)
- rad.io issue: "Feature request: Audit and optimize CI/CD pipeline"
