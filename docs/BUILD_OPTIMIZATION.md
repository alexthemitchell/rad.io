# Build Performance Optimization

This document describes the build performance optimizations implemented in rad.io and how to use them effectively.

## Overview

Build performance has been optimized across all build targets:

- JavaScript/TypeScript compilation with Webpack
- WebAssembly compilation with AssemblyScript
- Test execution with Jest

## Performance Improvements

### Measured Results

| Build Type  | Before | After (Cold) | After (Cached) | Improvement                            |
| ----------- | ------ | ------------ | -------------- | -------------------------------------- |
| Development | 1.4s   | 1.5s         | 0.4s           | 73% faster (cached)                    |
| Production  | 16s    | 10.3s        | 4.7s           | 35% faster (cold), 71% faster (cached) |
| Tests       | 49s    | 48.7s        | -              | 1% faster                              |
| WASM        | <1s    | <1s          | <1s            | Optimized output size                  |

### Key Optimizations

1. **TypeScript Incremental Compilation**
   - Enabled `incremental: true` in `tsconfig.json`
   - Creates `.tsbuildinfo` cache for faster rebuilds
   - Reduces type-checking time on subsequent builds

2. **Webpack Filesystem Cache**
   - Enabled persistent caching to disk
   - Cache invalidates on config changes
   - Dramatically speeds up second and subsequent builds

3. **Optimized Code Splitting**
   - Added `chunks: "all"` to enable more aggressive splitting
   - Added `reuseExistingChunk: true` to avoid duplicating modules
   - Separates React vendors from other dependencies for better caching

4. **Jest Parallel Execution**
   - Configured `maxWorkers: "50%"` to use half of CPU cores
   - Balances speed with system resources
   - Can be overridden with `--maxWorkers` flag

5. **AssemblyScript Optimization**
   - Enabled `converge: true` for better optimization passes
   - Enabled `noAssert: true` in release builds for smaller output
   - Increased `shrinkLevel: 2` for better size optimization
   - Reduced WASM size from 13.5KB to 11.9KB (12% smaller)

6. **SWC Transpiler Configuration**
   - Uses browser-specific targets for optimized output
   - Reduces unnecessary polyfills
   - Faster than TypeScript compiler

## Using the Optimizations

### Development Workflow

For the best development experience:

```bash
# First build (cold cache)
npm run build

# Subsequent builds (warm cache) - much faster!
npm run build

# Watch mode for continuous development
npm run start
```

The filesystem cache persists between builds, so you'll see significant speedups on the second and subsequent builds.

### Production Builds

For production deployments:

```bash
# First production build
npm run build:prod

# Subsequent builds benefit from cache
npm run build:prod
```

### Testing

Tests now run in parallel by default:

```bash
# Run all tests with default parallelization (50% of cores)
npm test

# Run tests with more parallelization
npm test -- --maxWorkers=75%

# Run tests without parallelization (for debugging)
npm test -- --maxWorkers=1
```

### Cleaning Cache

If you encounter build issues, you can clean all caches:

```bash
# Clean build outputs and caches
npm run clean

# Reinstall dependencies
npm install

# Rebuild from scratch
npm run build
```

## CI/CD Considerations

### Cache Strategy

For CI/CD pipelines, consider caching these directories:

```yaml
# Example for GitHub Actions
cache:
  - node_modules
  - node_modules/.cache # Webpack cache
  - .tsbuildinfo # TypeScript cache
  - build # WASM build outputs
```

### Build Times

Expected build times in CI (without warm cache):

- Development build: ~6-10 seconds
- Production build: ~10-15 seconds
- Full test suite: ~45-55 seconds

With warm cache:

- Development build: ~4-6 seconds
- Production build: ~4-7 seconds

## Optimization Details

### TypeScript Configuration

The following options enable incremental compilation:

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./.tsbuildinfo"
  }
}
```

### Webpack Configuration

Key webpack optimizations:

```typescript
{
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename], // Invalidate on config change
    },
  },
  optimization: {
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: {
          reuseExistingChunk: true,
        },
      },
    },
  },
}
```

### Jest Configuration

Parallel test execution:

```javascript
{
  maxWorkers: "50%", // Use half of CPU cores
}
```

### AssemblyScript Configuration

Release build optimizations:

```json
{
  "targets": {
    "release": {
      "optimizeLevel": 3,
      "shrinkLevel": 2,
      "converge": true,
      "noAssert": true
    }
  }
}
```

## Troubleshooting

### Stale Cache Issues

If builds produce unexpected results:

1. Clean the cache: `npm run clean`
2. Reinstall dependencies: `npm install`
3. Rebuild: `npm run build`

### Slow First Builds

First builds after cache cleanup will be slower. This is expected:

- Development builds: ~6 seconds
- Production builds: ~10 seconds

Subsequent builds should be much faster.

### Memory Issues

If you encounter memory issues during builds:

1. Reduce Jest workers: `npm test -- --maxWorkers=25%`
2. Increase Node memory: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`
3. Close other applications to free up RAM

### WASM Build Warnings

The message "Last converge was suboptimal" from AssemblyScript is informational and can be ignored. It indicates that the optimizer couldn't find additional improvements in the final pass, which is normal.

## Future Improvements

Potential future optimizations to consider:

1. **Webpack Module Federation**: For micro-frontend architecture
2. **esbuild Integration**: Faster bundling than webpack
3. **Persistent Jest Cache**: Cache test results between runs
4. **Parallel WASM Builds**: Build debug and release simultaneously
5. **Worker Threads for DSP**: Parallel FFT calculations
6. **Code Splitting by Route**: Lazy load page components

## References

- [Webpack Caching Documentation](https://webpack.js.org/configuration/cache/)
- [TypeScript Incremental Compilation](https://www.typescriptlang.org/tsconfig#incremental)
- [Jest Performance](https://jestjs.io/docs/cli#--maxworkersnumstring)
- [AssemblyScript Compiler Options](https://www.assemblyscript.org/compiler.html)
- [SWC Configuration](https://swc.rs/docs/configuration/swcrc)

## Contributing

When modifying build configurations:

1. Always test both cold and warm cache scenarios
2. Document performance impact in PR description
3. Update this document with new optimizations
4. Verify all tests pass: `npm test`
5. Verify production build works: `npm run build:prod`
