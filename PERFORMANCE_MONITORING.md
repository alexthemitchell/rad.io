# Performance Monitoring with Performance API & User Timing

This document describes the performance monitoring system integrated throughout the rad.io DSP and rendering pipeline.

## Overview

The Performance API and User Timing integration provides:

- **Automatic timing** of DSP operations (FFT, waveform, spectrogram)
- **Rendering performance tracking** for all visualization components
- **Long task detection** using PerformanceObserver
- **Real-time metrics visualization** in the UI
- **Performance data export** for CI/CD benchmarking

## Architecture

### Core Components

1. **PerformanceMonitor** (`src/utils/performanceMonitor.ts`)
   - Singleton service managing all performance measurements
   - Uses browser Performance API and User Timing
   - Automatically categorizes metrics by operation type
   - Provides statistics (avg, p50, p95, p99)

2. **DSP Integration** (`src/utils/dsp.ts`)
   - All DSP functions instrumented with performance marks
   - Measures both WASM and JavaScript implementations
   - Tracks FFT, waveform, and spectrogram calculations

3. **Visualization Integration** (`src/components/`)
   - IQ Constellation, Spectrogram components instrumented
   - Measures rendering time for each frame
   - Helps identify rendering bottlenecks

4. **Performance Metrics UI** (`src/components/PerformanceMetrics.tsx`)
   - Real-time display of performance statistics
   - Shows metrics for FFT, waveform, spectrogram, and rendering
   - Warns about long tasks (>50ms)
   - Export functionality for analysis

## Usage

### Viewing Performance Metrics

The Performance Metrics component is automatically displayed in the Visualizer page. It shows:

- **Count**: Number of measurements taken
- **Avg**: Average duration in milliseconds
- **P95**: 95th percentile duration
- **Max**: Maximum duration observed

### Monitoring Specific Operations

Performance monitoring is automatic. All DSP and rendering operations are tracked:

```typescript
// DSP operations (automatic)
calculateFFTSync(samples, fftSize);  // Tracked as "fft-wasm" or "fft-js"
calculateWaveform(samples);          // Tracked as "waveform-wasm" or "waveform-js"
calculateSpectrogram(samples, size); // Tracked as "spectrogram-wasm" or "spectrogram-js"

// Rendering operations (automatic)
<IQConstellation samples={data} />   // Tracked as "render-iq-constellation"
<Spectrogram fftData={data} />       // Tracked as "render-spectrogram"
```

### Programmatic Access

```typescript
import { performanceMonitor } from './utils/performanceMonitor';

// Get statistics for a category
const fftStats = performanceMonitor.getStats('fft');
console.log(`FFT avg: ${fftStats.avg.toFixed(2)}ms`);
console.log(`FFT p95: ${fftStats.p95.toFixed(2)}ms`);

// Get all pipeline metrics
const metrics = performanceMonitor.getPipelineMetrics();

// Check for long tasks
const longTasks = performanceMonitor.getLongTasks();
if (longTasks.length > 0) {
  console.warn('Long tasks detected:', longTasks);
}

// Export for CI benchmarking
const exportData = performanceMonitor.exportMetrics();
```

### Adding Custom Measurements

```typescript
import { performanceMonitor, measurePerformance } from './utils/performanceMonitor';

// Manual marks and measures
performanceMonitor.mark('operation-start');
// ... do work ...
performanceMonitor.measure('my-operation', 'operation-start');

// Using decorator (for functions)
const optimizedFunction = measurePerformance('my-function', (data) => {
  // Function implementation
  return processData(data);
});
```

### Disabling Monitoring

```typescript
import { performanceMonitor } from './utils/performanceMonitor';

// Disable monitoring (e.g., for production)
performanceMonitor.setEnabled(false);

// Re-enable
performanceMonitor.setEnabled(true);
```

## Performance Metrics Categories

The system automatically categorizes metrics:

- **fft**: FFT calculations (both WASM and JS implementations)
- **waveform**: Waveform amplitude/phase calculations
- **spectrogram**: Full spectrogram generation
- **rendering**: Canvas rendering operations
- **total**: End-to-end pipeline measurements

## Long Task Detection

The PerformanceObserver monitors for tasks exceeding 50ms:

- Automatically tracked in the background
- Displayed in the UI with a warning badge
- Helps identify performance bottlenecks
- Accessible via `getLongTasks()`

## CI/CD Integration

### Exporting Metrics

Use the export button in the UI or programmatically:

```typescript
const metrics = performanceMonitor.exportMetrics();
// Outputs JSON with all statistics
```

### Example Export Format

```json
{
  "fft": {
    "count": 150,
    "avg": 12.34,
    "min": 8.21,
    "max": 45.67,
    "p50": 11.23,
    "p95": 23.45,
    "p99": 38.90
  },
  "waveform": { ... },
  "spectrogram": { ... },
  "rendering": { ... },
  "longTasks": {
    "count": 3,
    "tasks": [...]
  }
}
```

### Benchmark Regression Testing

1. Export baseline metrics from current version
2. Run tests on new code
3. Export new metrics
4. Compare averages and percentiles
5. Fail CI if regressions exceed threshold

Example benchmark script:

```javascript
const baseline = JSON.parse(fs.readFileSync('baseline-metrics.json'));
const current = JSON.parse(performanceMonitor.exportMetrics());

// Check for regressions (>20% slower)
for (const category of ['fft', 'waveform', 'spectrogram', 'rendering']) {
  const baselineAvg = baseline[category].avg;
  const currentAvg = current[category].avg;
  const regression = (currentAvg - baselineAvg) / baselineAvg;
  
  if (regression > 0.2) {
    console.error(`Performance regression in ${category}: ${(regression * 100).toFixed(1)}%`);
    process.exit(1);
  }
}
```

## Performance Optimization Tips

Based on metrics, consider:

1. **High FFT times**: Switch to WASM implementation
2. **High rendering times**: 
   - Reduce sample count
   - Use OffscreenCanvas with Web Workers
   - Implement adaptive downsampling
3. **Long tasks detected**:
   - Break work into smaller chunks
   - Use requestIdleCallback
   - Move to Web Workers

## Browser Compatibility

The Performance API is widely supported:
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (14.1+)

Graceful degradation is built-in:
- Falls back silently if Performance API unavailable
- PerformanceObserver optional (warnings logged)
- No impact on functionality if monitoring disabled

## Best Practices

1. **Keep monitoring enabled in development** to catch regressions early
2. **Export metrics regularly** to track performance over time
3. **Monitor p95/p99** not just averages to catch outliers
4. **Watch for long tasks** as they can cause frame drops
5. **Test on real hardware** as performance varies significantly

## Testing

Comprehensive test suite at `src/utils/__tests__/performanceMonitor.test.ts`:

```bash
npm test -- performanceMonitor.test.ts
```

Tests cover:
- Basic functionality (marks, measures, categories)
- Statistics calculation (avg, percentiles)
- Enable/disable behavior
- Export functionality
- Decorator pattern
- Error handling

## Future Enhancements

Potential improvements:
- WebGL/GPU performance tracking
- Memory usage monitoring
- Network request timing
- User interaction latency
- Custom performance marks in user code
- Automatic slowdown alerts
- Historical trend visualization
