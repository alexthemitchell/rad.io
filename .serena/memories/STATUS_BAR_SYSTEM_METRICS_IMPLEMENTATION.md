# Status Bar System Metrics Implementation

## Overview
Implemented comprehensive system metrics tracking and display via StatusBar component with centralized render tier detection, FPS calculation, buffer health monitoring, and storage tracking.

## Key Components

### 1. RenderTierManager (src/lib/render/RenderTierManager.ts)
**Singleton pattern** to track highest successful rendering backend across all visualization components.

- **Tier Priority**: WebGPU (5) > WebGL2 (4) > WebGL1 (3) > Worker (2) > Canvas2D (1) > Unknown (0)
- **API**:
  - `reportSuccess(tier)`: Reports successful render; upgrades global tier if higher
  - `subscribe(listener)`: Subscribes to tier changes; returns unsubscribe function
  - `getTier()`: Returns current highest tier
  - `reset()`: Resets to Unknown (mainly for tests)

**Integration Points**: All three visualization components (IQConstellation, Spectrogram, WaveformVisualizer) report their successful render path to RenderTierManager on each render cycle.

### 2. FPS Calculation (src/utils/performanceMonitor.ts)
Added `getFPS()` method to PerformanceMonitor:
- Calculates FPS from average render duration: `fps = 1000 / avgDuration`
- Uses "rendering" category metrics (any measure name containing "render")
- Returns 0 if no metrics or invalid duration
- Rounds to 1 decimal place

### 3. Buffer Health Tracking (src/pages/LiveMonitor.tsx)
Computed from three sources (polled every 1 second):
1. **Device receive buffer**: `device.getMemoryInfo()` → `currentSamples / maxSamples * 100`
2. **Audio buffer**: `audioSampleBufferRef.current.length / AUDIO_BUFFER_SIZE * 100`
3. Takes **maximum** of all computed percentages

### 4. Storage API Integration
Polls `navigator.storage.estimate()` every 5 seconds:
- Populates `storageUsed` and `storageQuota` state
- Handles API unavailability gracefully

## LiveMonitor Integration

### State Management
```typescript
const [renderTier, setRenderTier] = useState<RenderTier>(RenderTier.Unknown);
const [fps, setFps] = useState<number>(0);
const [storageUsed, setStorageUsed] = useState<number>(0);
const [storageQuota, setStorageQuota] = useState<number>(0);
const [sampleRateState, setSampleRateState] = useState<number>(0);
const [bufferHealth, setBufferHealth] = useState<number>(100);
```

### Update Cycles
- **Render Tier**: Subscribe on mount via `renderTierManager.subscribe()`
- **FPS**: Poll `performanceMonitor.getFPS()` every 1 second
- **Storage**: Poll `navigator.storage.estimate()` every 5 seconds
- **Sample Rate**: Fetch from device on device change
- **Buffer Health**: Compute every 1 second from device + audio buffers

### StatusBar Placement
Rendered at bottom of `LiveMonitor` container with all metric props passed:
```tsx
<StatusBar
  renderTier={renderTier}
  fps={fps}
  sampleRate={sampleRateState}
  bufferHealth={bufferHealth}
  storageUsed={storageUsed}
  storageQuota={storageQuota}
  deviceConnected={Boolean(device)}
/>
```

## Shared Types (src/types/rendering.ts)
- `RenderTier` enum: WebGPU, WebGL2, WebGL1, Worker, Canvas2D, Unknown
- `RenderTierPriority`: Numeric mapping for comparison
- `maxTier(a, b)`: Utility to find higher-priority tier

## Testing
- **RenderTierManager**: 10 tests covering singleton, upgrades, downgrades, subscriptions, error handling
- **PerformanceMonitor.getFPS**: 3 tests covering zero metrics, calculation, and edge cases
- All tests pass; lint and type-check clean

## Future Considerations
- Could expose worker message queue depth if visualization workers implement queue tracking
- AudioContext.baseLatency could supplement buffer health if needed
- StatusBar currently displays but not yet positioned in App.tsx (only LiveMonitor)
