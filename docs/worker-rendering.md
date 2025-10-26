# Off-Main-Thread Visualization Rendering

## Overview

This implementation enables visualization components to render in a Web Worker using OffscreenCanvas, moving expensive rendering operations off the main thread to improve UI responsiveness.

## Features

### 1. Worker-Based Rendering
- Rendering happens in a dedicated Web Worker
- Uses OffscreenCanvas for GPU-accelerated rendering off-main-thread
- Supports both WebGL and Canvas2D rendering paths

### 2. Backpressure Handling
- Frame queue with configurable maximum size (default: 3 frames)
- When queue is full, oldest frames are automatically dropped
- Prevents memory buildup during high-frequency updates

### 3. Frame Drop Policy
- Tracks and reports dropped frames
- Provides metrics for monitoring system load
- Helps maintain consistent frame rates under stress

### 4. Performance Metrics
- Real-time rendering time tracking
- Queue size monitoring
- Frame drop statistics
- Rendered frame counter

## Architecture

### Components

1. **visualization.worker.ts** (Enhanced)
   - Original worker with added backpressure handling
   - Used by existing components (IQConstellation, Spectrogram, etc.)
   - Supports 2D Canvas rendering

2. **visualization-renderer.worker.ts** (New)
   - Advanced worker with WebGL support
   - Renders using GPU acceleration in worker thread
   - Provides better performance for complex visualizations

3. **VisualizationWorkerManager.ts** (New)
   - High-level API for managing worker lifecycle
   - Handles OffscreenCanvas transfer
   - Provides callbacks for metrics and errors

### Rendering Tiers

The visualization system uses a fallback hierarchy:

```
1. Worker + OffscreenCanvas (Primary)
   └─ WebGL rendering in worker
   └─ 2D Canvas rendering in worker

2. Main Thread (Fallback)
   └─ WebGPU (if available)
   └─ WebGL
   └─ 2D Canvas
```

## Usage

### Option 1: Using VisualizationWorkerManager (Recommended for new code)

```typescript
import { VisualizationWorkerManager } from "./workers/VisualizationWorkerManager";

function MyVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerManagerRef = useRef<VisualizationWorkerManager | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check if worker rendering is supported
    if (!VisualizationWorkerManager.isSupported()) {
      // Fallback to main thread rendering
      return;
    }

    const manager = new VisualizationWorkerManager();
    workerManagerRef.current = manager;

    // Initialize worker with canvas
    manager.initialize(canvas, "constellation", {
      width: 800,
      height: 600,
      dpr: window.devicePixelRatio || 1,
    }).then((success) => {
      if (success) {
        console.log("Worker initialized successfully");
        
        // Set up metrics callback
        manager.onMetrics((metrics) => {
          console.log("Render metrics:", metrics);
          if (metrics.droppedFrames > 0) {
            console.warn(`Dropped ${metrics.droppedFrames} frames`);
          }
        });

        // Set up error callback
        manager.onError((error) => {
          console.error("Worker error:", error);
        });
      } else {
        console.warn("Worker initialization failed, using main thread");
        // Fallback to main thread rendering
      }
    });

    return () => {
      manager.cleanup();
    };
  }, []);

  useEffect(() => {
    const manager = workerManagerRef.current;
    if (!manager || !manager.isReady()) return;

    // Render data
    manager.render({
      samples: mySamples,
      transform: myTransform,
    });
  }, [mySamples, myTransform]);

  return <canvas ref={canvasRef} />;
}
```

### Option 2: Using Existing Worker Integration

The existing visualization components (IQConstellation, Spectrogram, WaveformVisualizer) now include backpressure handling automatically. No code changes needed to benefit from frame dropping and queue management.

## Performance Considerations

### When to Use Worker Rendering

**Good candidates:**
- High-frequency updates (>30 FPS)
- Complex rendering (many samples, WebGL shaders)
- Visualization-heavy UIs with many concurrent charts
- Applications where main thread responsiveness is critical

**Not recommended:**
- Low-frequency updates (<1 FPS)
- Simple visualizations
- Very small data sets
- When OffscreenCanvas is not supported

### Backpressure Tuning

The frame queue size can be adjusted by modifying `MAX_QUEUE_SIZE` in the worker files:

```typescript
// In visualization.worker.ts or visualization-renderer.worker.ts
const MAX_QUEUE_SIZE = 3; // Adjust based on your needs
```

**Guidelines:**
- **Smaller queue (1-2)**: Lower latency, more dropped frames
- **Larger queue (4-6)**: Fewer dropped frames, higher latency
- **Default (3)**: Balanced approach for most use cases

### Monitoring Performance

Use the metrics callback to track performance:

```typescript
manager.onMetrics((metrics) => {
  const dropRate = metrics.droppedFrames / metrics.renderedFrames;
  if (dropRate > 0.1) {
    console.warn(`High drop rate: ${(dropRate * 100).toFixed(1)}%`);
    // Consider reducing update frequency or simplifying visualization
  }
  
  if (metrics.renderTimeMs > 16) {
    console.warn(`Slow rendering: ${metrics.renderTimeMs}ms per frame`);
    // Frame time should be <16ms for 60 FPS
  }
});
```

## Browser Support

### OffscreenCanvas Support
- ✅ Chrome 69+
- ✅ Edge 79+
- ✅ Firefox 105+ (partial)
- ❌ Safari (not yet supported)

The system automatically falls back to main thread rendering when OffscreenCanvas is not available.

### WebGL in Worker Support
- ✅ Chrome 69+
- ✅ Edge 79+
- ⚠️ Firefox (limited)
- ❌ Safari (not yet)

## Testing

Unit tests for the VisualizationWorkerManager are in `src/workers/__tests__/VisualizationWorkerManager.test.ts`.

**Note:** Full integration tests with real workers and OffscreenCanvas are complex to mock in Jest. End-to-end testing with Playwright is recommended for comprehensive validation.

## Troubleshooting

### Worker initialization fails
- Check browser console for errors
- Verify OffscreenCanvas support: `typeof OffscreenCanvas === 'function'`
- Ensure canvas doesn't already have a rendering context
- Check that `transferControlToOffscreen` is available

### Frames are being dropped
- Check metrics.queueSize - if consistently at MAX_QUEUE_SIZE, reduce update frequency
- Simplify rendering (fewer samples, less complex shaders)
- Increase MAX_QUEUE_SIZE if latency is acceptable

### No visible output
- Verify worker received initialization message
- Check for worker errors in console
- Ensure canvas dimensions are set correctly
- Verify data is being sent to worker

## Future Enhancements

Potential improvements for future iterations:

1. **Adaptive Queue Management**: Dynamically adjust queue size based on system load
2. **Priority-Based Frame Dropping**: Keep keyframes, drop intermediate frames
3. **Multiple Worker Pool**: Distribute rendering across multiple workers
4. **Predictive Frame Skipping**: Skip frames proactively based on performance trends
5. **WebGPU Support in Worker**: Use WebGPU when available for better performance

## References

- [OffscreenCanvas Specification](https://html.spec.whatwg.org/multipage/canvas.html#the-offscreencanvas-interface)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [WebGL in Workers](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/By_example/OffscreenCanvas)
