# Pipeline Optimization Patterns

## When to Optimize

Consider pipeline optimization when:
- CI feedback time exceeds 10 minutes
- Bundle sizes grow beyond reasonable limits (>1MB uncompressed for SPAs)
- Test execution becomes a bottleneck (>2 minutes for unit tests)
- Build times impact developer productivity

## Decision Framework

### Bundle Optimization Strategy

**When to add compression:**
- Production deployments where bandwidth matters
- File sizes > 10KB (compression threshold)
- Text-based assets (JS, CSS, HTML, SVG)

**Trade-off**: Slightly longer build time vs significantly smaller delivery size (typically 70-80% reduction).

**Implementation pattern**: Use webpack CompressionPlugin conditionally (production only).

### Bundle Analysis Strategy

**When to analyze:**
- Bundle size increases unexpectedly
- Build performance degrades
- Before adding major dependencies
- During performance optimization sprints

**Trade-off**: Analysis adds 20-30% to build time, so make it opt-in.

**Implementation pattern**: Use webpack-bundle-analyzer with environment flag (e.g., `ANALYZE=true`).

### Test Optimization Strategy

**CI vs Local considerations:**
- CI: Prefer fixed worker count (2-4) for stability and predictable resource usage
- Local: Prefer percentage-based (50%) for speed on varied hardware
- Rationale: CI runners have consistent resources; developer machines vary widely

**Implementation pattern**: Use environment detection (`process.env.CI`) in test config.

## Common Patterns

### Webpack Plugin Patterns

**Conditional plugins** - Add expensive plugins only when needed:
```typescript
plugins: [
  ...basePlugins,
  ...(condition ? [expensivePlugin] : []),
]
```

**Progressive enhancement** - Start with basics, add optimizations as needed:
1. Code splitting (free performance win)
2. Filesystem caching (faster rebuilds)
3. Compression (smaller delivery)
4. Analysis tooling (when debugging)

### CI/CD Patterns

**Job parallelization** - Run independent checks simultaneously:
- Lint, test, format, type-check can run in parallel
- Build depends on WASM compilation
- All checks gate merge

**Caching strategy** - Cache at appropriate granularity:
- npm dependencies: Hash package-lock.json
- WASM builds: Hash source files + config
- Playwright browsers: Hash package-lock.json

**Result visibility** - Surface metrics in job summaries:
- Bundle sizes with budget warnings
- Test execution times
- Coverage deltas

## Anti-Patterns to Avoid

1. **Over-optimization early** - Don't add complexity before measuring actual bottlenecks
2. **Custom tooling** - Prefer standard tools (webpack-bundle-analyzer, standard shell commands) over custom scripts
3. **Permanent documentation** - Don't document transient metrics in long-term files; use git commit messages
4. **Copy-paste configs** - Extract patterns to reusable memory, not full configs

## Troubleshooting Decision Tree

**Slow builds?**
1. Check if running unnecessary production optimizations in development
2. Verify filesystem cache is enabled and working
3. Profile with `--profile` flag to identify bottleneck

**Large bundles?**
1. Run bundle analyzer to visualize dependencies
2. Check for duplicate dependencies (common with multiple versions)
3. Ensure tree shaking enabled (production mode)
4. Consider code splitting for large pages

**Slow tests?**
1. Check worker configuration (CI vs local)
2. Profile test execution to find slow suites
3. Look for memory leaks in setup/teardown
4. Consider parallelization strategy

## Key Files Reference

- `webpack.config.ts` - Build configuration
- `jest.config.ts` - Test configuration
- `.github/workflows/quality-checks.yml` - CI pipeline
- `package.json` - Scripts and dependencies

## External Tools

- **webpack-bundle-analyzer**: Visualize bundle composition
- **compression-webpack-plugin**: Gzip compression for production
- **actionlint**: GitHub Actions workflow validation
- Standard shell: `ls`, `du`, `awk` for quick artifact inspection
