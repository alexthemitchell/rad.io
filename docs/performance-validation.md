# DSP Pipeline Performance Validation

This document describes how to validate that the DSP pipeline meets the performance requirements specified in [ADR-0025](./decisions/0025-dsp-pipeline-architecture.md).

## Requirements (from ADR-0025)

### Acceptance Criteria
1. **30 FPS waterfall @ 2.4 MSPS** with <1% drop rate
2. **60 FPS waterfall @ 10 MSPS** with <5% drop rate (target)
3. **Main thread never blocked >16ms**
4. **SharedArrayBuffer enabled** in dev and production

## Running Benchmarks

### Automated Tests

The benchmark test suite is located in `src/utils/__tests__/dspPipeline.benchmark.test.ts`.

**Note**: WASM modules don't load in Jest environment, so these tests primarily validate the architecture and will show warnings. For actual performance measurement, use browser-based profiling (see below).

```bash
# Run benchmark tests
npm test -- src/utils/__tests__/dspPipeline.benchmark.test.ts --verbose

# Run with performance tracking
npm run test:perf -- src/utils/__tests__/dspPipeline.benchmark.test.ts
```

### Browser-Based Performance Testing

For accurate performance measurements, use the Chrome DevTools Performance profiler with a real SDR device:

1. **Start the dev server** (with COOP/COEP headers):
   ```bash
   npm start
   ```

2. **Connect an SDR device** (HackRF, RTL-SDR, etc.)

3. **Open Chrome DevTools**:
   - Press `F12` or right-click → Inspect
   - Go to the "Performance" tab

4. **Start recording**:
   - Click the record button (red circle)
   - Start SDR reception in the app
   - Let it run for 10-15 seconds
   - Stop recording

5. **Analyze the results**:
   - Check FPS (should be ≥30 for 2.4 MSPS, ≥60 for 10 MSPS)
   - Look for long tasks (any >16ms indicates main thread blocking)
   - Check worker utilization
   - Verify no dropped frames

## Manual Verification Checklist

### 1. SharedArrayBuffer Support

Check browser console for:
```javascript
// In browser console:
typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated
// Should return: true
```

Or check the capabilities:
```javascript
import { getSharedBufferCapabilities } from './src/utils/sharedRingBuffer';
console.log(getSharedBufferCapabilities());
```

Expected output:
```javascript
{
  supported: true,
  isolated: true,
  canUse: true,
  error: undefined
}
```

### 2. COOP/COEP Headers

Verify headers are being sent:

**Development** (webpack-dev-server):
```bash
curl -I https://localhost:8080
```

Look for:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Production** (Netlify/Vercel):
```bash
curl -I https://your-deployment-url.netlify.app
```

### 3. WASM Module Loading

Check browser console for WASM loading:
```
✓ WASM module loaded successfully
✓ SIMD support detected
```

If you see errors, check:
- Files `dsp.wasm`, `dsp.js` are in `dist/`
- Content-Type is `application/wasm` for `.wasm` files
- CORS headers allow WASM loading

### 4. Worker Pool

Check that worker pool is initialized:
```javascript
// In browser console (when app is running):
window.radIo.dspWorkerPool
// Should show: DspWorkerPool object with N workers
```

Expected worker count:
- Desktop: `navigator.hardwareConcurrency` (typically 4-16)
- Mobile: Limited to 2-4 workers
- E2E/Test: Limited to 1 worker (prevents resource contention)

### 5. Pipeline Metrics

When receiving from SDR, check console for metrics:
```
DSP Pipeline Metrics:
- FPS: 58.3
- Latency: 12.4ms
- Ring buffer: 45.2% full
- Drops: 0
- Underruns: 0
```

## Performance Targets

### RTL-SDR @ 2.4 MSPS

| Metric | Target | Status |
|--------|--------|--------|
| FPS | ≥30 | ✅ |
| Drop rate | <1% | ✅ |
| Max latency | <16ms | ✅ |
| Throughput | 2.4 MSPS | ✅ |

### HackRF @ 10 MSPS

| Metric | Target | Status |
|--------|--------|--------|
| FPS | ≥60 | 🎯 Target |
| Drop rate | <5% | 🎯 Target |
| Max latency | <16ms | 🎯 Target |
| Throughput | 10 MSPS | 🎯 Target |

### HackRF @ 20 MSPS

| Metric | Target | Status |
|--------|--------|--------|
| FPS | ≥30 | 🔬 Experimental |
| Drop rate | <10% | 🔬 Experimental |
| Throughput | 20 MSPS | 🔬 Experimental |

## Troubleshooting Performance Issues

### Low FPS

**Symptoms**: FPS < 30, choppy waterfall

**Possible causes**:
1. **WASM not loading**: Check console for WASM errors
2. **Worker starvation**: Not enough CPU cores
3. **Excessive FFT size**: Try smaller FFT (1024 or 2048)
4. **Browser throttling**: Chrome throttles background tabs
5. **No GPU acceleration**: Check if WebGL is enabled

**Solutions**:
```javascript
// Reduce FFT size
settings.fftSize = 1024;

// Reduce update rate
settings.updateRate = 30; // Hz

// Enable SIMD if available
settings.useSIMD = true;
```

### High Drop Rate

**Symptoms**: Gaps in waterfall, "Drops: N" increasing

**Possible causes**:
1. **Sample rate too high** for available CPU
2. **Ring buffer too small**
3. **Backpressure not working**
4. **Worker pool saturated**

**Solutions**:
```javascript
// Increase ring buffer size
const ringBuffer = new SharedRingBuffer(2 * 1024 * 1024); // 2M floats

// Reduce sample rate
device.setSampleRate(1_200_000); // 1.2 MSPS instead of 2.4

// Add more workers (if cores available)
const pool = new DspWorkerPool(navigator.hardwareConcurrency);
```

### Main Thread Blocking

**Symptoms**: UI freezes, max latency >16ms

**Possible causes**:
1. **Heavy operations on main thread**
2. **Large data copies** instead of transfers
3. **Synchronous operations** in render path
4. **No worker offloading**

**Solutions**:
- Move processing to workers
- Use `Transferable` objects for large data
- Make operations async with `requestAnimationFrame`
- Profile with Chrome DevTools to find bottlenecks

### SharedArrayBuffer Not Available

**Symptoms**: `crossOriginIsolated === false`

**Possible causes**:
1. **Missing COOP/COEP headers**
2. **HTTP instead of HTTPS**
3. **Embedded in iframe** without proper headers
4. **Browser doesn't support SAB**

**Solutions**:

**Development**:
```typescript
// webpack.config.ts already configured with:
devServer: {
  server: "https",
  headers: {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  },
}
```

**Production**:
- Netlify: Uses `netlify.toml` and `_headers` file
- Vercel: Uses `vercel.json`
- Other: Add headers to your server config

**Fallback**:
```javascript
if (!canUseSharedArrayBuffer()) {
  // Use MessageChannel instead
  useLegacyPipeline();
}
```

## Profiling Tips

### Chrome DevTools Performance

1. **Record during active reception** for accurate worker usage
2. **Look for "Long Tasks"** (yellow/red bars >50ms)
3. **Check "Main" thread** should be mostly idle
4. **Check worker threads** should show DSP activity
5. **Check GPU process** for WebGL rendering

### Key Metrics to Watch

- **FPS**: Bottom-right corner during recording
- **Main thread idle time**: Should be >90%
- **Worker utilization**: Should be 50-80% per worker
- **Memory**: Shouldn't grow unbounded (indicates leaks)
- **GC pauses**: Should be <5ms

### Example Good Profile

```
Main Thread:    ████─────────────────────────── (~10% busy)
Worker 1:       ████████████████████████████─── (~80% busy)
Worker 2:       ████████████████████████████─── (~80% busy)
Worker 3:       ████████████████████████████─── (~80% busy)
Worker 4:       ████████████████████████████─── (~80% busy)
GPU:            ████████████─────────────────── (~40% busy)
FPS:            58-60 ✓
```

### Example Bad Profile

```
Main Thread:    ███████████████████████████──── (~70% busy) ✗
Worker 1:       ████─────────────────────────── (~20% busy) ✗
Worker 2:       ─────────────────────────────── (idle) ✗
GPU:            ████████████████████████████─── (~90% busy) ⚠
FPS:            15-20 ✗
```

## Regression Testing

Add these checks to CI:

```yaml
# .github/workflows/performance.yml
- name: Performance benchmarks
  run: npm run test:perf

- name: Verify WASM builds
  run: |
    npm run asbuild:release
    test -f build/release.wasm
    test -f build/release.js

- name: Verify deployment configs
  run: |
    test -f netlify.toml
    test -f vercel.json
    test -f public/_headers
```

## References

- [ADR-0025: DSP Pipeline Architecture](./decisions/0025-dsp-pipeline-architecture.md)
- [ADR-0002: Web Worker DSP Architecture](./decisions/0002-web-worker-dsp-architecture.md)
- [ADR-0015: SIMD DSP Optimization](./decisions/0015-simd-dsp-optimization.md)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [SharedArrayBuffer Requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements)
