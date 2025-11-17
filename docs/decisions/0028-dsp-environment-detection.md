# ADR-0028: DSP Environment Detection and Fallback System

## Status

Accepted

## Context

The rad.io application uses SharedArrayBuffer (SAB) for zero-copy data transfer between the main thread and Web Workers, achieving 10+ GB/s throughput versus 200 MB/s with MessageChannel. However, SAB requires specific HTTP headers (COOP and COEP) that are not supported by GitHub Pages, our current deployment platform.

### The Problem

**Production vs Development Divergence:**

- **Development**: Webpack dev server sends COOP/COEP headers → SAB works → optimal performance
- **GitHub Pages**: Cannot configure custom HTTP headers → SAB unavailable → zero-copy pipeline fails

This creates several issues:

1. **User Confusion**: Features advertised in docs don't work in production
2. **Inconsistent Benchmarks**: Performance claims based on dev environment don't match deployment
3. **Poor Error Messaging**: Silent degradation or cryptic browser errors
4. **Support Burden**: Users report "broken" features that work in development

### GitHub Pages Limitation

GitHub Pages serves static files via GitHub's CDN and does not allow custom HTTP headers. The required headers are:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These headers enable cross-origin isolation, which is a prerequisite for SharedArrayBuffer due to Spectre vulnerability mitigations.

### Why Service Workers Don't Help

Service Workers can intercept requests but **cannot inject security headers** like COOP/COEP. These headers must come from the initial HTTP response before any JavaScript executes. This is a fundamental security model limitation, not a technical oversight.

## Decision

Implement a **three-tier fallback system** with automatic environment detection and user-visible diagnostics:

### Execution Modes (in order of preference)

#### 1. SharedArrayBuffer Mode (Optimal)

- **Requirements**: COOP/COEP headers, HTTPS
- **Performance**: 10+ GB/s throughput, <0.1ms latency
- **Use Case**: Production deployments on platforms supporting custom headers

#### 2. MessageChannel Mode (Fallback)

- **Requirements**: Web Workers support
- **Performance**: ~200 MB/s throughput, 1-5ms latency
- **Use Case**: GitHub Pages, browsers without cross-origin isolation

#### 3. Pure JavaScript Mode (Emergency Fallback)

- **Requirements**: None (always available)
- **Performance**: Blocks UI thread, not suitable for real-time
- **Use Case**: Unsupported browsers, debugging

### Implementation Components

#### A. Environment Detection Module (`src/utils/dspEnvironment.ts`)

```typescript
export enum DSPMode {
  SHARED_ARRAY_BUFFER = "shared-array-buffer",
  MESSAGE_CHANNEL = "message-channel",
  PURE_JS = "pure-js",
}

export interface DSPCapabilities {
  mode: DSPMode;
  sharedArrayBufferSupported: boolean;
  crossOriginIsolated: boolean;
  webWorkersSupported: boolean;
  wasmAvailable: boolean;
  wasmSIMDSupported: boolean;
  webGPUAvailable: boolean;
  deploymentEnvironment:
    | "development"
    | "github-pages"
    | "custom-headers"
    | "unknown";
  warnings: string[];
  performanceImpact: string;
}

export function detectDSPCapabilities(): DSPCapabilities;
```

**Detection Logic:**

1. Check `typeof SharedArrayBuffer !== "undefined"` (browser support)
2. Check `crossOriginIsolated === true` (headers present)
3. Check `typeof Worker !== "undefined"` (Web Workers support)
4. Determine deployment environment from hostname and headers
5. Select mode: SAB → MessageChannel → Pure JS
6. Generate warnings and performance impact messages

#### B. Diagnostics Store Integration

Added `dspCapabilities` to the diagnostics slice in Zustand store:

- Initialized on app startup via `useDSPInitialization()` hook
- Accessible throughout app via `useDiagnostics()` hook
- Persists for session lifetime (not saved to localStorage)

#### C. User-Visible DSP Status Component (`src/components/DSPStatus.tsx`)

Displays:

- **Current Mode**: Icon + title (🚀 Optimal, ⚡ Fallback, 🐢 Limited)
- **Performance Impact**: Expected throughput and latency
- **Browser Features**: Checklist of available capabilities
- **Warnings**: Explanations for degraded mode
- **Recommendations**: Links to platforms supporting optimal mode

Shown in:

- Diagnostics panel (detailed view)
- Optional banner on first load if fallback mode

#### D. Initialization Hook (`src/hooks/useDSPInitialization.ts`)

Called once in `App.tsx`:

- Detects capabilities on mount
- Stores in diagnostics state
- Logs to console for developers
- Adds diagnostic events for warnings

### Mode Selection Logic

```typescript
function determineDSPMode(capabilities): DSPMode {
  if (SAB_supported && crossOriginIsolated && workers) {
    return DSPMode.SHARED_ARRAY_BUFFER;
  }

  if (workers) {
    return DSPMode.MESSAGE_CHANNEL;
  }

  return DSPMode.PURE_JS;
}
```

### Performance Impact Messaging

Each mode provides clear performance expectations:

**SharedArrayBuffer Mode:**

> "Optimal performance: Zero-copy transfers, 10+ GB/s throughput, <0.1ms latency"

**MessageChannel Mode:**

> "Reduced performance: ~200 MB/s throughput, 1-5ms latency. UI responsive but slower than optimal."

**Pure JS Mode:**

> "Severely degraded: Main thread processing, UI freezes likely. Not recommended for real-time use."

## Consequences

### Positive

✅ **Clarity**: Users see exactly what mode they're running in  
✅ **Graceful Degradation**: App works (with warnings) on GitHub Pages  
✅ **Actionable Guidance**: Links to platforms supporting optimal mode  
✅ **Developer Insight**: Console logs show capability detection results  
✅ **Accurate Benchmarks**: Performance claims matched to deployment  
✅ **Reduced Support**: Self-service diagnostics reduce bug reports  
✅ **Future-Proof**: Easy to add new modes or capabilities

### Negative

❌ **Complexity**: More code paths to test and maintain  
❌ **Incomplete**: MessageChannel fallback not yet implemented (future PR)  
❌ **GitHub Pages Limitation**: Still can't achieve optimal performance there  
❌ **User Friction**: Extra step to understand mode differences

### Neutral

⚪ **Documentation Burden**: Need to explain modes in user docs  
⚪ **Testing Surface**: Must test all three modes  
⚪ **Migration Path**: Existing users see new warnings

## Alternatives Considered

### 1. Force Migration to Custom Hosting

**Option**: Immediately move to Vercel/Netlify/Cloudflare Pages

**Rejected because**:

- GitHub Pages is free and familiar to open-source projects
- Doesn't solve the fundamental browser compatibility issue
- Some users may need GitHub Pages for organizational reasons
- Detection system valuable even with optimal hosting (older browsers)

### 2. Service Worker Header Injection

**Option**: Use Service Worker to add COOP/COEP headers

**Rejected because**:

- **Not technically possible**: Security headers must come from initial HTTP response
- Service Worker intercepts requests _after_ initial page load
- Browser security model explicitly prevents this for Spectre mitigation
- Would create false expectations about what's achievable

### 3. Status Quo with Documentation

**Option**: Document GitHub Pages limitation, provide no runtime detection

**Rejected because**:

- Users don't read deployment docs before trying the app
- Silent degradation is confusing and frustrating
- No way to diagnose issues in production
- Misses opportunity to guide users toward better hosting

### 4. Remove SharedArrayBuffer Dependency

**Option**: Always use MessageChannel, accept performance hit

**Rejected because**:

- Gives up 50x performance improvement for optimal cases
- Competitive SDR apps use zero-copy techniques
- Research/professional use cases need maximum performance
- Modern browser APIs should be used when available

## Implementation Status

### Phase 1: Detection and UI (Complete)

- [x] Environment detection module (`dspEnvironment.ts`)
- [x] Diagnostics slice integration
- [x] DSP Status component with detailed view
- [x] Initialization hook
- [x] App integration
- [x] Tests for detection logic
- [x] Console logging for developers

### Phase 2: MessageChannel Fallback (Future PR)

- [ ] MessageChannel-based ring buffer implementation
- [ ] Worker pool fallback path
- [ ] Performance benchmarks for fallback mode
- [ ] Tests for MessageChannel path

### Phase 3: Documentation (Future PR)

- [ ] Update ARCHITECTURE.md with fallback system
- [ ] Add deployment guide comparing platforms
- [ ] Update README with deployment recommendations
- [ ] Add troubleshooting guide for performance issues
- [ ] Create migration guide from GitHub Pages

### Phase 4: Advanced Features (Future)

- [ ] Automatic platform detection and recommendation
- [ ] Performance profiling to verify selected mode
- [ ] Fallback effectiveness monitoring
- [ ] User preference to force a specific mode (debug)

## Testing Strategy

### Unit Tests

- ✅ `detectDSPCapabilities()` with various browser states
- ✅ Mode selection logic (SAB → MessageChannel → Pure JS)
- ✅ Warning generation for each mode
- ✅ Performance impact messaging

### Integration Tests

- [ ] App initialization with different capabilities
- [ ] DSP Status component rendering
- [ ] Diagnostics panel integration

### E2E Tests

- [ ] GitHub Pages deployment (MessageChannel mode)
- [ ] Vercel deployment (SAB mode)
- [ ] Browser compatibility (Chrome, Firefox, Safari)

### Manual Testing Checklist

- [ ] Verify detection in Chrome with COOP/COEP
- [ ] Verify detection in Chrome without COOP/COEP
- [ ] Test on actual GitHub Pages deployment
- [ ] Test on Vercel with custom headers
- [ ] Check console logs in each mode
- [ ] Verify DSP Status component in diagnostics panel

## Migration Guide

### For Developers

**Before:**

```typescript
// Assumed SAB always available
const buffer = new SharedArrayBuffer(size);
```

**After:**

```typescript
// Check capabilities first
const { dspCapabilities } = useDiagnostics();

if (dspCapabilities.mode === DSPMode.SHARED_ARRAY_BUFFER) {
  // Use zero-copy path
  const buffer = new SharedArrayBuffer(size);
} else {
  // Use fallback path
  const buffer = new ArrayBuffer(size);
  // Post via MessageChannel
}
```

### For Deployers

**GitHub Pages (Current - MessageChannel Mode):**

- App works with reduced performance
- Users see warning about optimal hosting
- No configuration changes needed

**Vercel/Netlify/Cloudflare (Recommended - SAB Mode):**

1. Create `_headers` or `vercel.json` configuration
2. Add COOP/COEP headers
3. Deploy
4. Verify optimal mode in diagnostics panel

Example Vercel configuration:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

## Metrics and Monitoring

### Success Metrics

- % of users in each mode (SAB vs MessageChannel vs Pure JS)
- % of deployments on optimal platforms
- User satisfaction with performance (via feedback)
- Reduction in "performance" related issues

### Observability

- Console logs show detected capabilities
- Diagnostics panel displays mode and features
- Warnings logged for degraded modes
- Performance metrics tagged by mode (future)

## References

### Standards and Security

- [SharedArrayBuffer Security Requirements - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements)
- [Cross-Origin-Opener-Policy - W3C](https://www.w3.org/TR/coop/)
- [Cross-Origin-Embedder-Policy - W3C](https://www.w3.org/TR/coep/)
- [Spectre Mitigations - Chrome](https://www.chromium.org/Home/chromium-security/ssca/)

### Platform Documentation

- [GitHub Pages - Custom Headers Limitation](https://github.com/orgs/community/discussions/13309)
- [Vercel - Custom Headers](https://vercel.com/docs/projects/project-configuration#headers)
- [Netlify - Custom Headers](https://docs.netlify.com/routing/headers/)
- [Cloudflare Pages - Custom Headers](https://developers.cloudflare.com/pages/configuration/headers/)

### Related ADRs

- **ADR-0027**: DSP Pipeline Architecture (SharedArrayBuffer design)
- **ADR-0002**: Web Worker DSP Architecture (worker pool foundation)
- **ADR-0012**: Parallel FFT Worker Pool (worker scaling)

### Performance Research

- [SharedArrayBuffer Performance - Web.dev](https://web.dev/articles/cross-origin-isolation-guide)
- [MessageChannel vs SharedArrayBuffer Benchmarks](https://github.com/GoogleChromeLabs/buffer-backed-object)

---

**Date**: 2025-11-17  
**Author**: GitHub Copilot  
**Reviewers**: TBD
