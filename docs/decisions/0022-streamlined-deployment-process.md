# ADR 0022: Streamlined Deployment Process with Validation and Artifact Management

## Status

Accepted

## Context

The rad.io project uses GitHub Pages for hosting and has an automated deployment pipeline via GitHub Actions. However, several issues were identified:

1. **No deployment validation**: Deployments could succeed but result in a broken site
2. **No build output validation**: Missing or corrupt files could be deployed
3. **Artifact accumulation**: GitHub Actions artifacts were accumulating without cleanup
4. **Lack of documentation**: No comprehensive deployment documentation or runbook
5. **Manual processes**: No clear procedures for rollback or troubleshooting

The deployment process needed to be more reliable, observable, and maintainable to support the project's growth and ensure production stability.

## Decision

We have implemented a comprehensive deployment enhancement consisting of:

### 1. Build Output Validation

Added validation step in `.github/workflows/deploy-pages.yml` that:

- Verifies required files exist (`index.html`, `404.html`)
- Checks for presence of WASM and JS bundles
- Reports bundle sizes for monitoring
- Warns if total deployment size exceeds 5 MB threshold
- Fails the build if critical files are missing

This catches build issues before they reach production.

### 2. Post-Deployment Validation

Added health check after deployment:

- Waits 10 seconds for CDN propagation
- Performs HTTP health check on deployed URL
- Expects 200 OK response
- Reports deployment URL in logs
- Fails if site is not accessible

This ensures deployments are actually successful and the site is reachable.

### 3. Automated Artifact Cleanup

Created `.github/workflows/cleanup-artifacts.yml`:

- Runs daily at 2 AM UTC
- Deletes artifacts older than 7 days
- Keeps recent artifacts for debugging
- Provides summary of cleanup actions
- Can be triggered manually via workflow_dispatch

This prevents unbounded artifact accumulation and storage costs.

### 4. Comprehensive Documentation

Created `docs/DEPLOYMENT.md` covering:

- Automated and manual deployment procedures
- Build artifact management
- Post-deployment validation checklists
- Rollback procedures
- Troubleshooting guides
- Best practices for developers and maintainers
- Monitoring and metrics

Updated `README.md` to reference deployment documentation.

### 5. Webpack Performance Optimization

Enhanced webpack configuration:

- Conditional performance hints (disabled in development, warnings in production)
- Maintains current size limits (630 KB)
- Provides clear feedback on bundle size issues

## Consequences

### Positive

1. **Higher Reliability**:
   - Build validation prevents deploying broken builds
   - Post-deployment checks ensure site is accessible
   - Early detection of issues reduces production incidents

2. **Better Observability**:
   - Bundle size reporting in CI logs
   - Deployment validation status visible in workflow
   - Clear success/failure indicators

3. **Reduced Manual Effort**:
   - Automated artifact cleanup eliminates manual maintenance
   - Documented procedures reduce time to resolve issues
   - Clear rollback process minimizes downtime

4. **Improved Maintainability**:
   - Comprehensive documentation reduces knowledge gaps
   - Standardized procedures improve consistency
   - Clear troubleshooting guides reduce resolution time

5. **Cost Control**:
   - Automated cleanup prevents unbounded artifact storage
   - 7-day retention balances debugging needs with storage costs

### Negative

1. **Slightly Longer Deployments**:
   - Validation steps add ~15-20 seconds to deployment
   - Acceptable trade-off for increased reliability

2. **Additional Workflow**:
   - New cleanup workflow to maintain
   - Minimal maintenance burden (runs automatically)

3. **Documentation Overhead**:
   - Documentation must be kept up-to-date
   - Worth the investment for long-term maintainability

### Neutral

1. **No Changes to Core Build Process**:
   - Existing webpack configuration remains largely unchanged
   - Build outputs and artifacts are identical
   - Only validation and cleanup are new

2. **Backward Compatible**:
   - Changes are additive, not breaking
   - Existing deployments continue to work
   - No migration required

## Implementation Details

### Build Validation Script

The validation script checks:

```bash
# Required files
- dist/index.html
- dist/404.html

# Critical assets
- *.wasm files (DSP modules)
- *.js files (application bundles)

# Size monitoring
- Individual bundle sizes
- Total deployment size
- Warning if > 5 MB
```

### Deployment Validation

Simple but effective health check:

```bash
# Wait for CDN propagation
sleep 10

# HTTP health check
curl -s -o /dev/null -w "%{http_code}" $URL
# Expect 200 OK
```

### Artifact Cleanup Strategy

Using GitHub's `actions/github-script`:

- Queries all repository artifacts
- Calculates 7-day cutoff date
- Deletes artifacts older than cutoff
- Reports deleted and kept counts
- Uses GitHub's REST API for reliability

### Documentation Structure

Organized for discoverability:

- Table of contents for easy navigation
- Separate sections for different audiences
- Step-by-step procedures
- Troubleshooting organized by symptom
- Related documentation links

## Alternatives Considered

### 1. Third-Party Deployment Service

**Option**: Use Netlify, Vercel, or similar service

**Rejected because**:

- GitHub Pages is free and sufficient
- Adds external dependency
- Requires configuration migration
- GitHub Actions integration already works well

### 2. Manual Validation Only

**Option**: Only document manual validation steps

**Rejected because**:

- Automation prevents human error
- Manual steps often skipped under pressure
- Automated validation is more reliable
- CI/CD philosophy is automation

### 3. Longer Artifact Retention

**Option**: Keep artifacts for 30+ days

**Rejected because**:

- 7 days sufficient for debugging recent issues
- Longer retention increases storage costs
- Rarely need artifacts older than a week
- Can always re-run workflows if needed

### 4. External Monitoring Service

**Option**: Use UptimeRobot, Pingdom, etc.

**Rejected because**:

- Built-in validation sufficient for deployment checks
- External service adds complexity and cost
- Can add external monitoring later if needed
- GitHub Actions provides basic monitoring

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Webpack Performance Documentation](https://webpack.js.org/configuration/performance/)
- Previous ADR: [0021-cicd-pipeline-optimization.md](./0021-cicd-pipeline-optimization.md)

## Related Documents

- [docs/DEPLOYMENT.md](../DEPLOYMENT.md) - Deployment runbook
- [.github/workflows/deploy-pages.yml](../../.github/workflows/deploy-pages.yml) - Deployment workflow
- [.github/workflows/cleanup-artifacts.yml](../../.github/workflows/cleanup-artifacts.yml) - Cleanup workflow
- [webpack.config.ts](../../webpack.config.ts) - Webpack configuration

---

**Date**: 2025-10-27
**Author**: GitHub Copilot
**Reviewers**: TBD
