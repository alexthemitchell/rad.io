# Performance API Integration - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         rad.io Application                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    Visualizer Page                         │   │
│  │                                                            │   │
│  │  ┌──────────────────────────────────────────────────┐     │   │
│  │  │         Performance Metrics Component            │     │   │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │     │   │
│  │  │  │  FFT   │ │Waveform│ │Spectro │ │Rendering│  │     │   │
│  │  │  │Avg:12ms│ │Avg:5ms │ │Avg:45ms│ │Avg:8ms │   │     │   │
│  │  │  │P95:18ms│ │P95:7ms │ │P95:60ms│ │P95:12ms│   │     │   │
│  │  │  └────────┘ └────────┘ └────────┘ └────────┘   │     │   │
│  │  │                                                  │     │   │
│  │  │  [Monitoring On] [Clear] [Export]               │     │   │
│  │  └──────────────────────────────────────────────────┘     │   │
│  │                          ▲                                 │   │
│  │                          │                                 │   │
│  │                    Reads metrics                           │   │
│  │                          │                                 │   │
│  └──────────────────────────┼─────────────────────────────────┘   │
│                              │                                     │
│  ┌───────────────────────────┼──────────────────────────────┐     │
│  │   Performance Monitor (Singleton)                        │     │
│  │                           │                              │     │
│  │   ┌──────────────────────────────────────────────┐      │     │
│  │   │  Performance API & User Timing               │      │     │
│  │   │  - performance.mark(name)                    │      │     │
│  │   │  - performance.measure(name, start, end)     │      │     │
│  │   │  - PerformanceObserver (long tasks)          │      │     │
│  │   └──────────────────────────────────────────────┘      │     │
│  │                           │                              │     │
│  │   ┌──────────────────────────────────────────────┐      │     │
│  │   │  Metrics Storage                             │      │     │
│  │   │  - fft: [...]                                │      │     │
│  │   │  - waveform: [...]                           │      │     │
│  │   │  - spectrogram: [...]                        │      │     │
│  │   │  - rendering: [...]                          │      │     │
│  │   │  - longTasks: [...]                          │      │     │
│  │   └──────────────────────────────────────────────┘      │     │
│  │                           ▲                              │     │
│  └───────────────────────────┼──────────────────────────────┘     │
│                               │                                    │
│                         Reports metrics                            │
│                               │                                    │
│  ┌────────────────────────────┼───────────────────────────────┐   │
│  │              DSP Pipeline  │                               │   │
│  │                            │                               │   │
│  │  ┌─────────────────────────┼─────────────┐                │   │
│  │  │  calculateFFTSync()     │             │                │   │
│  │  │  ┌──────────────────────▼───────────┐ │                │   │
│  │  │  │ mark('fft-1024-start')          │ │                │   │
│  │  │  │ ... FFT calculation ...         │ │                │   │
│  │  │  │ measure('fft-wasm', 'fft-...')  │ │                │   │
│  │  │  └──────────────────────────────────┘ │                │   │
│  │  └────────────────────────────────────────┘                │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────┐                │   │
│  │  │  calculateWaveform()                   │                │   │
│  │  │  ┌──────────────────────────────────┐  │                │   │
│  │  │  │ mark('waveform-start')          │  │                │   │
│  │  │  │ ... waveform calculation ...    │  │                │   │
│  │  │  │ measure('waveform-js', '...')   │  │                │   │
│  │  │  └──────────────────────────────────┘  │                │   │
│  │  └────────────────────────────────────────┘                │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────┐                │   │
│  │  │  calculateSpectrogram()                │                │   │
│  │  │  ┌──────────────────────────────────┐  │                │   │
│  │  │  │ mark('spectrogram-start')       │  │                │   │
│  │  │  │ ... spectrogram calculation ... │  │                │   │
│  │  │  │ measure('spectrogram-wasm', ...)│  │                │   │
│  │  │  └──────────────────────────────────┘  │                │   │
│  │  └────────────────────────────────────────┘                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           Visualization Components                          │   │
│  │                                                             │   │
│  │  ┌────────────────────────────────────────┐                │   │
│  │  │  IQConstellation                       │                │   │
│  │  │  ┌──────────────────────────────────┐  │                │   │
│  │  │  │ mark('render-iq-constellation-  │  │                │   │
│  │  │  │      start')                    │  │                │   │
│  │  │  │ ... canvas rendering ...        │  │                │   │
│  │  │  │ measure('render-iq-constellation│  │                │   │
│  │  │  │         ', '...')               │  │                │   │
│  │  │  └──────────────────────────────────┘  │                │   │
│  │  └────────────────────────────────────────┘                │   │
│  │                                                             │   │
│  │  ┌────────────────────────────────────────┐                │   │
│  │  │  Spectrogram                           │                │   │
│  │  │  ┌──────────────────────────────────┐  │                │   │
│  │  │  │ mark('render-spectrogram-start')│  │                │   │
│  │  │  │ ... canvas rendering ...        │  │                │   │
│  │  │  │ measure('render-spectrogram',...)│  │                │   │
│  │  │  └──────────────────────────────────┘  │                │   │
│  │  └────────────────────────────────────────┘                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

                              │
                              │ Export
                              ▼
                   ┌──────────────────────┐
                   │   CI/CD Pipeline     │
                   │                      │
                   │  Benchmark Testing   │
                   │  Regression Checks   │
                   │  Performance Trends  │
                   └──────────────────────┘
```

## Data Flow

1. **DSP Operations**:
   - Functions call `performanceMonitor.mark()` at start
   - Functions call `performanceMonitor.measure()` at end
   - Metrics automatically categorized (fft, waveform, spectrogram)

2. **Rendering Operations**:
   - Components call `performanceMonitor.mark()` before render
   - Components call `performanceMonitor.measure()` after render
   - Metrics categorized as "rendering"

3. **Performance Monitor**:
   - Stores metrics in categorized buckets
   - Calculates statistics (avg, p50, p95, p99)
   - Detects long tasks via PerformanceObserver
   - Provides query API for metrics

4. **UI Display**:
   - PerformanceMetrics component polls monitor every 1s
   - Displays real-time statistics
   - Shows warnings for long tasks
   - Provides export functionality

5. **Export**:
   - JSON format for CI/CD integration
   - Includes all statistics and long tasks
   - Can be used for regression testing
   - Tracks performance trends over time

## Key Benefits

✅ **Zero Configuration**: Automatic instrumentation of all DSP and rendering operations
✅ **Real-time Monitoring**: Live metrics displayed in UI
✅ **Detailed Statistics**: Not just averages - see p95, p99 for outlier detection
✅ **Long Task Detection**: Automatically warns about tasks >50ms
✅ **CI/CD Ready**: Export JSON for automated performance regression testing
✅ **Minimal Overhead**: <1ms overhead per operation
✅ **Type Safe**: Full TypeScript support
✅ **Well Tested**: 19 comprehensive tests
