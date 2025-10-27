# Build Performance Optimization

This document describes how to use the build performance optimizations in rad.io effectively.

## Overview

The build system uses several caching and optimization strategies:

- **TypeScript Incremental Compilation**: Caches type-checking results between builds
- **Webpack Filesystem Cache**: Persistent build cache for fast rebuilds
- **Jest Parallel Execution**: Runs tests across multiple CPU cores
- **AssemblyScript Optimization**: Aggressive WASM optimization for smaller binaries

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
  - node_modules/.cache/webpack # Webpack cache
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
