# Build Performance Optimization Patterns

**Purpose**: Document proven patterns for optimizing TypeScript/Webpack/WASM builds in rad.io.

## Key Optimizations Applied

**TypeScript Incremental Compilation**

- Enable `incremental: true` in tsconfig.json
- Add `.tsbuildinfo` to .gitignore
- Result: 70%+ speedup on cached builds

**Webpack Filesystem Cache**

- Add `cache: { type: 'filesystem' }` to webpack config
- Cache invalidates automatically on config changes
- Result: 4-10x faster subsequent builds

**Code Splitting Optimization**

- Use `chunks: "all"` and `reuseExistingChunk: true`
- Separate React vendors for better long-term caching
- Reduces duplicate code across chunks

**AssemblyScript WASM Optimization**

- Release builds: `optimizeLevel: 3, shrinkLevel: 2, converge: true, noAssert: true`
- Debug builds: Keep assertions and source maps
- Result: 12% smaller WASM binaries

**Jest Parallel Execution**

- Configure `maxWorkers: "50%"` for balanced parallelization
- Can override with `--maxWorkers=N` flag
- Avoid 100% to prevent system resource exhaustion

## Performance Expectations

**Cold builds (no cache)**:

- Development: 6-10s
- Production: 10-15s

**Warm builds (with cache)**:

- Development: 0.4-1.5s (73% faster)
- Production: 4-7s (71% faster)

## Critical Files

- `tsconfig.json`: incremental, tsBuildInfoFile
- `webpack.config.ts`: cache, optimization.splitChunks
- `jest.config.js`: maxWorkers
- `asconfig.json`: optimizeLevel, shrinkLevel, converge, noAssert
- `.gitignore`: .tsbuildinfo, node_modules/.cache

## Troubleshooting

**Stale cache**: `npm run clean && npm install && npm run build`

**Memory issues**: Reduce Jest workers or increase Node memory with NODE_OPTIONS

**See also**: docs/BUILD_OPTIMIZATION.md for full documentation
