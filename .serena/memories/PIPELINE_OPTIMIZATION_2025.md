# Pipeline Optimization Patterns

## Overview

Reusable patterns and tools for optimizing rad.io's build, test, and deploy pipeline. Focus on webpack configuration, CI optimization, and bundle analysis.

## Key Tools & Configurations

### Bundle Compression

Use CompressionPlugin for production builds to reduce delivery size:

```typescript
// webpack.config.ts
import CompressionPlugin from "compression-webpack-plugin";

plugins: [
  ...(isProduction ? [
    new CompressionPlugin({
      filename: "[path][base].gz",
      algorithm: "gzip",
      test: /\.(js|css|html|svg|wasm)$/,
      threshold: 10240, // Only compress files > 10KB
      minRatio: 0.8,
    }),
  ] : []),
]
```

**Results**: Typically 70-80% size reduction for text assets.

### Bundle Analysis

Use webpack-bundle-analyzer conditionally:

```typescript
// webpack.config.ts
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";

const analyzeBundle = process.env["ANALYZE"] === "true";

plugins: [
  ...(analyzeBundle ? [
    new BundleAnalyzerPlugin({
      analyzerMode: "static",
      reportFilename: "bundle-report.html",
      generateStatsFile: true,
      statsFilename: "bundle-stats.json",
    }),
  ] : []),
]
```

**Usage**: `ANALYZE=true npm run build:prod`

### CI Test Optimization

Dynamic Jest worker configuration for CI vs local:

```typescript
// jest.config.ts
maxWorkers: process.env["CI"] ? 2 : "50%"
```

**Rationale**: CI environments benefit from fixed worker count (stability), local dev benefits from percentage-based (speed).

## Build Analysis

### Quick Bundle Inspection

Use standard shell commands:

```bash
# List all artifacts with sizes
ls -lh dist/

# Total bundle size
du -sh dist/

# Breakdown by file type
du -sh dist/*.js dist/*.wasm

# Top 5 largest files
du -h dist/* | sort -hr | head -5
```

### Detailed Bundle Analysis

For deep analysis of dependencies and chunks:

```bash
npm run build:analyze    # Visual HTML report
npm run build:stats      # Export webpack stats JSON
```

### Available Scripts

```bash
npm run build:analyze    # Visual bundle analysis (opens HTML report)
npm run build:stats      # Export webpack stats JSON
npm run test:ci          # CI-optimized test execution
```

## Performance Patterns

### Webpack Caching

Enable filesystem caching for faster rebuilds:

```typescript
// webpack.config.ts
cache: {
  type: "filesystem",
  buildDependencies: {
    config: [__filename],
  },
}
```

### Code Splitting Strategy

Separate React/vendors for better caching:

```typescript
optimization: {
  splitChunks: {
    cacheGroups: {
      react: {
        test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
        name: "react-vendors",
        priority: 20,
      },
      vendor: {
        test: /[\\/]node_modules[\\/](?!(react|react-dom|react-router-dom)[\\/])/,
        name: "vendors",
        priority: 10,
      },
    },
  },
}
```

## CI/CD Patterns

### Bundle Size Tracking

Add to GitHub Actions workflow for visibility:

```yaml
- name: Analyze bundle size
  run: |
    echo "## 📦 Bundle Size Report" >> $GITHUB_STEP_SUMMARY
    echo "### JavaScript Bundles" >> $GITHUB_STEP_SUMMARY
    echo "\`\`\`" >> $GITHUB_STEP_SUMMARY
    ls -lh dist/*.js | awk '{printf "%-40s %10s\n", $9, $5}' >> $GITHUB_STEP_SUMMARY
    echo "\`\`\`" >> $GITHUB_STEP_SUMMARY
    total_size=$(du -sh dist/ | cut -f1)
    echo "**Total Size:** $total_size" >> $GITHUB_STEP_SUMMARY
```

### Budget Enforcement

Example budget check in CI:

```bash
size_bytes=$(du -sb dist/ | cut -f1)
budget_bytes=3145728  # 3MB
if [ "$size_bytes" -gt "$budget_bytes" ]; then
  echo "⚠️ Bundle exceeds budget"
  # Can fail build or just warn
fi
```

## Troubleshooting

### Build Performance Issues

**Symptom**: Slow webpack builds
**Check**:
1. Verify filesystem cache enabled
2. Check if running in production mode unnecessarily
3. Use `ANALYZE=true` to identify large dependencies

**Symptom**: Large bundle sizes
**Fix**:
1. Run `npm run build:analyze` to visualize
2. Check for duplicate dependencies
3. Ensure tree shaking enabled (production mode)

### Test Performance Issues

**Symptom**: Tests slow in CI
**Check**:
1. Verify `maxWorkers` set to fixed number (e.g., 2)
2. Look for memory leaks in test setup/teardown
3. Use `--maxWorkers=1` to isolate if parallelization issue

## Related Files

- `webpack.config.ts` - Build configuration
- `jest.config.ts` - Test configuration  
- `.github/workflows/quality-checks.yml` - CI pipeline
- `package.json` - Build/test scripts

## References

- webpack-bundle-analyzer: https://github.com/webpack-contrib/webpack-bundle-analyzer
- compression-webpack-plugin: https://github.com/webpack-contrib/compression-webpack-plugin
- Jest CLI: https://jestjs.io/docs/cli
