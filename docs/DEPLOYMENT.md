# Deployment Process Documentation

This document describes the deployment infrastructure, processes, and best practices for rad.io.

## Table of Contents

- [Overview](#overview)
- [Automated Deployment](#automated-deployment)
- [Manual Deployment](#manual-deployment)
- [Artifact Management](#artifact-management)
- [Post-Deployment Validation](#post-deployment-validation)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

## Overview

rad.io uses GitHub Pages for hosting with an automated CI/CD pipeline that builds and deploys on every push to the `main` branch.

**Key Components:**

- **Hosting**: GitHub Pages (static site hosting with CDN)
- **Build Tool**: Webpack 5 with production optimizations
- **Deployment Target**: `https://alexthemitchell.github.io/rad.io/`
- **Build Artifacts**: JavaScript bundles, WASM modules, HTML, source maps

## Automated Deployment

### Workflow Overview

The deployment process is fully automated via `.github/workflows/deploy-pages.yml`:

```
┌─────────────────┐
│  Push to main   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Build Job      │
│  - Install deps │
│  - Build WASM   │
│  - Build Webpack│
│  - Validate     │
│  - Upload       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Deploy Job     │
│  - Deploy Pages │
│  - Validate     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Live on Pages  │
└─────────────────┘
```

### Build Process

1. **Checkout**: Clones the repository
2. **Setup**: Configures Node.js 20 with npm cache
3. **Cache Restore**: Attempts to restore cached dependencies and build outputs
4. **Install**: Runs `npm ci` if cache miss
5. **Build**: Executes `npm run build:prod`:
   - Builds AssemblyScript WASM modules
   - Bundles TypeScript/React with Webpack
   - Generates production-optimized bundles
6. **Add SPA Fallback**: Copies `index.html` to `404.html` for client-side routing
7. **Validate**: Checks build output integrity
8. **Upload**: Creates Pages artifact

### Deployment Process

1. **Deploy**: Uses `actions/deploy-pages@v4` to publish
2. **Validate**: Performs HTTP health check on deployed site
3. **Report**: Outputs deployment URL

### Cache Strategy

The workflow uses aggressive caching to minimize build times:

```yaml
key: deploy-${{ runner.os }}-${{ hashFiles('package-lock.json', 'src/**/*.{ts,tsx,js,jsx,css}', 'assembly/**', 'webpack.config.ts') }}
```

**Cached Items:**

- `node_modules/` - Dependencies
- `build/` - AssemblyScript WASM output
- `dist/` - Webpack bundles

**Cache Invalidation:**

- Package dependencies change (`package-lock.json`)
- Source files change (TypeScript, JSX, CSS)
- AssemblyScript files change
- Webpack config changes

### Trigger Conditions

The deployment workflow runs on:

1. **Push to main**: Automatic deployment on every commit
2. **Manual trigger**: Via GitHub Actions UI (`workflow_dispatch`)

## Manual Deployment

While automated deployment is recommended, manual deployment may be necessary for:

- Testing deployment process changes
- Emergency rollbacks
- Local verification before pushing

### Prerequisites

```bash
# Install dependencies
npm ci

# Verify environment
node --version  # Should be 20.x
npm --version
```

### Manual Build Steps

```bash
# 1. Clean previous builds
npm run clean
npm ci

# 2. Build production bundle
npm run build:prod

# 3. Verify build output
ls -lh dist/
du -sh dist/

# 4. Test locally (optional)
npx http-server dist/ -p 8080 --cors

# 5. Manual deploy to Pages
# Not recommended - use GitHub Actions workflow_dispatch instead
```

### Manual Deployment via GitHub Actions

**Recommended manual deployment method:**

1. Navigate to: `https://github.com/alexthemitchell/rad.io/actions/workflows/deploy-pages.yml`
2. Click "Run workflow" button
3. Select branch (usually `main`)
4. Click "Run workflow"
5. Monitor deployment progress
6. Verify deployment at output URL

## Artifact Management

### Build Artifacts

**Produced artifacts (dist/):**

The build typically includes:

- Main application bundle (JavaScript)
- React framework bundle (code-split from main)
- Third-party dependencies bundle (vendors)
- Webpack runtime
- WASM modules for DSP processing
- Source maps for debugging
- HTML entry point

Total deployment size varies based on features and dependencies.

**Checking Bundle Sizes:**

To check current bundle sizes and composition:

```bash
npm run build:prod
du -h dist/*.js | sort -hr
du -sh dist/
```

### GitHub Actions Artifacts

The build job uploads artifacts for debugging and archival:

```yaml
name: build-output
path: dist/
retention-days: 7
```

**Retention Policy:** 7 days (automatically cleaned up)

### Artifact Cleanup

An automated cleanup workflow runs daily to remove old artifacts:

- **Workflow**: `.github/workflows/cleanup-artifacts.yml`
- **Schedule**: Daily at 2 AM UTC
- **Policy**: Delete artifacts older than 7 days
- **Manual Trigger**: Available via workflow_dispatch

## Post-Deployment Validation

### Automated Validation

The deployment workflow includes automatic validation:

1. **Build Validation**:
   - Verifies required files exist (`index.html`, `404.html`)
   - Checks for WASM and JS bundles
   - Reports bundle sizes
   - Warns if total size exceeds 5 MB

2. **Deployment Validation**:
   - Waits 10 seconds for CDN propagation
   - Performs HTTP health check (expects 200 OK)
   - Reports deployment URL

### Manual Validation Checklist

After deployment, verify:

- [ ] Site loads at `https://alexthemitchell.github.io/rad.io/`
- [ ] All assets load without errors (check browser console)
- [ ] WASM modules load successfully
- [ ] Client-side routing works (navigate and refresh)
- [ ] Device connection works (if SDR hardware available)
- [ ] Visualizations render correctly
- [ ] No console errors or warnings

### Testing Deployment Locally

```bash
# Build production bundle
npm run build:prod

# Serve with production-like environment
npx http-server dist/ -p 8080 --cors -c-1

# Open in browser
open http://localhost:8080
```

## Rollback Procedures

### Quick Rollback via GitHub

If a deployment introduces critical issues:

1. **Identify last known good commit**:

   ```bash
   git log --oneline main
   ```

2. **Revert the problematic commit**:

   ```bash
   git revert <commit-sha>
   git push origin main
   ```

   This triggers automatic redeployment of the previous version.

3. **Alternative - Force push previous version** (use with caution):

   ```bash
   git reset --hard <good-commit-sha>
   git push --force origin main
   ```

### Emergency Rollback

For critical production issues:

1. Navigate to repository **Deployments** page
2. Find the last successful deployment
3. Click "View deployment"
4. Verify it's the correct version
5. Re-deploy from that commit via workflow_dispatch

### Post-Rollback Actions

After rollback:

- [ ] Verify site is working correctly
- [ ] Document the issue in GitHub Issues
- [ ] Create hotfix branch to address the problem
- [ ] Test thoroughly before redeploying

## Troubleshooting

### Build Failures

**Symptom**: Workflow fails during build step

**Common Causes:**

1. **Type errors**: Run `npm run type-check` locally
2. **Lint errors**: Run `npm run lint` locally
3. **Test failures**: Run `npm test` locally
4. **Out of memory**: Check bundle sizes, may need optimization

**Resolution:**

```bash
# Run full validation locally
npm run validate

# If passing locally, check CI logs for environment-specific issues
```

### Deployment Failures

**Symptom**: Build succeeds but deployment fails

**Common Causes:**

1. **GitHub Pages not enabled**: Check repository settings
2. **Permissions issue**: Verify workflow has `pages: write` permission
3. **Artifact too large**: Check artifact size (max 10 GB)

**Resolution:**

- Check workflow permissions in `.github/workflows/deploy-pages.yml`
- Verify Pages is enabled in repository settings
- Review GitHub status page for service issues

### Site Not Loading After Deployment

**Symptom**: Deployment succeeds but site shows errors

**Common Causes:**

1. **CDN propagation delay**: Wait 5-10 minutes
2. **Browser cache**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. **Asset loading errors**: Check browser console
4. **Base URL mismatch**: Verify paths in HTML

**Resolution:**

```bash
# Test locally first
npm run build:prod
npx http-server dist/ -p 8080

# Check for console errors
# Verify all assets load
```

### Cache Issues

**Symptom**: Builds using stale dependencies or old code

**Resolution:**

```bash
# Clear local cache
npm run clean
rm -rf node_modules
npm ci

# For CI cache issues:
# Manually delete cache via GitHub Actions UI
# or update cache key in workflow
```

### Performance Issues

**Symptom**: Site loads slowly or performs poorly

**Diagnostics:**

```bash
# Check bundle sizes
npm run build:prod
du -h dist/*.js | sort -hr

# Analyze bundle composition
npx webpack-bundle-analyzer dist/stats.json
```

**Resolution:**

- Review Webpack optimization settings
- Consider code splitting for large components
- Lazy load non-critical features
- Optimize images and assets

## Monitoring and Metrics

### Deployment Metrics

Monitor these metrics for deployment health:

- **Build time**: Should be < 6 seconds with cache, < 60 seconds without
- **Deploy time**: Typically 30-60 seconds total
- **Bundle size**: Should stay under 650 KB entrypoint
- **Total artifact size**: Should stay under 5 MB
- **Cache hit rate**: Target > 80% for faster builds

### Key Performance Indicators

- **Deployment frequency**: Continuous (on every main commit)
- **Deployment success rate**: Target > 95%
- **Time to deployment**: < 5 minutes from commit
- **Rollback time**: < 10 minutes
- **Validation success rate**: 100%

## Best Practices

### For Developers

1. **Test locally before pushing**:

   ```bash
   npm run validate  # Runs all checks
   npm run build:prod  # Test production build
   ```

2. **Keep bundle sizes manageable**:
   - Monitor Webpack warnings
   - Use dynamic imports for large dependencies
   - Regularly review bundle composition

3. **Use meaningful commit messages**:
   - Helps identify issues in deployment history
   - Enables quick rollbacks

4. **Monitor deployment workflows**:
   - Check GitHub Actions for failures
   - Review deployment validation results

### For Maintainers

1. **Regularly review artifact storage**:
   - Monitor storage usage in repository settings
   - Adjust retention policies if needed

2. **Keep dependencies updated**:
   - Regular security updates
   - Test deployments after updates

3. **Document changes**:
   - Update this document when deployment process changes
   - Keep ADRs (Architecture Decision Records) for major changes

4. **Monitor deployment performance**:
   - Track build times
   - Investigate cache misses
   - Optimize as needed

## Related Documentation

- [README.md](../README.md) - Project overview and quick start
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [Deploy Pages Workflow](../.github/workflows/deploy-pages.yml)
- [Cleanup Artifacts Workflow](../.github/workflows/cleanup-artifacts.yml)
- [ADR-0028: DSP Environment Detection](./decisions/0028-dsp-environment-detection.md)
- [ADR-0027: DSP Pipeline Architecture](./decisions/0027-dsp-pipeline-architecture.md)

## Performance Optimization and Alternative Platforms

### Current Deployment: GitHub Pages (Fallback Mode)

rad.io is currently deployed to GitHub Pages, which provides:
- ✅ Free hosting
- ✅ Automatic deployment
- ✅ CDN distribution
- ❌ **No custom HTTP headers** (performance limitation)

**Impact:** The application runs in **MessageChannel fallback mode** with ~50x reduced DSP performance:
- MessageChannel Mode: ~200 MB/s throughput, 1-5ms latency
- Optimal (SAB) Mode: 10+ GB/s throughput, <0.1ms latency

### Why Headers Matter

SharedArrayBuffer enables zero-copy data transfer between threads, critical for real-time SDR processing. It requires these HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

GitHub Pages cannot send these headers, forcing fallback to slower MessageChannel communication.

### Deployment Options for Optimal Performance

For production deployments requiring maximum DSP performance, consider these platforms:

#### Option 1: Vercel (Recommended)
- Free tier available
- Easy header configuration via `vercel.json`
- Automatic HTTPS and CDN
- Deploy command: `vercel --prod`

#### Option 2: Netlify
- Free tier available  
- Header configuration via `_headers` file (already in repo)
- Deploy command: `netlify deploy --prod`

#### Option 3: Cloudflare Pages
- Free tier with unlimited bandwidth
- Header configuration via `_headers` file
- Cloudflare's global network

#### Option 4: Custom Server
- Full control over headers and caching
- Requires server maintenance
- See ADR-0028 for Nginx/Apache examples

### Verifying DSP Mode

After deployment, verify the DSP execution mode:

**Via Console:**
```javascript
// Open DevTools → Console
// Look for startup message:
🚀 DSP Environment Capabilities { mode: "shared-array-buffer", ... }  // Optimal
⚡ DSP Environment Capabilities { mode: "message-channel", ... }       // Fallback
```

**Via Diagnostics Panel:**
1. Navigate to Diagnostics in the app
2. Check DSP Status section
3. Verify mode indicator and features

### Migration Guide

To migrate from GitHub Pages to a platform with optimal performance:

1. **Choose platform** (Vercel/Netlify recommended)
2. **Configure headers** (see platform-specific guides in ADR-0028)
3. **Deploy and verify** optimal mode activated
4. **Update DNS** (if using custom domain)
5. **Monitor performance** via diagnostics panel

See [ADR-0028](./decisions/0028-dsp-environment-detection.md) for detailed migration instructions and platform comparisons.

## Support

For deployment issues:

1. Check [Troubleshooting](#troubleshooting) section
2. Review workflow logs in GitHub Actions
3. Search existing issues on GitHub
4. Create new issue with deployment logs if problem persists

---

**Last Updated**: 2025-10-27
**Maintained by**: rad.io team
