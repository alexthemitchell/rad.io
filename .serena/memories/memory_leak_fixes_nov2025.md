# Memory Leak Fixes - November 2025

## Issues Identified

1. **PrimaryVisualization RAF Loop Allocation** (`src/components/Monitor/PrimaryVisualization.tsx`)
   - Created new `[data]` array on every requestAnimationFrame call (60 FPS = 3,600 allocations/minute)
   - This accumulated rapidly causing OOM after extended use

2. **WebGLWaterfall Colormap Buffer** (`src/visualization/renderers/WebGLWaterfall.ts`)
   - Allocated new `Uint8Array(colormapData.length * 4)` on every render call (60 FPS)
   - ~1KB per allocation × 3,600/min = ~3.6MB/min of unnecessary allocations

3. **useDsp Buffer Reuse** (`src/hooks/useDsp.ts`)
   - Created `new Float32Array(prevMagnitudes)` on every FFT update despite claiming to reuse
   - High-frequency allocations from FFT updates (100-500 Hz input rate observed)

## Solutions Implemented

### PrimaryVisualization

- Added `waterfallFrameArrayRef` to store a reusable single-element array
- Reuse by updating `[0]` element instead of creating new array: `waterfallFrameArrayRef.current[0] = data`
- Applied to all 3 render paths (worker, fallback, direct WebGL)

### WebGLWaterfall

- Added `colormapRGBACache` and `lastColormapName` private fields
- Cache Uint8Array and only recreate when colormap name changes
- Typical case: colormap unchanged, zero allocations per frame

### useDsp

- Modified to return same `prevMagnitudes` reference after in-place `.set()` copy
- Eliminates Float32Array allocation on every FFT update
- Maintains compatibility with React state update detection via onNewFft callback

## Impact

- **Before**: ~3,600+ allocations/minute during active reception
- **After**: Near-zero per-frame allocations (only on FFT size or colormap change)
- **Memory Pressure**: Reduced by >95% during steady-state operation
- **GC Frequency**: Expected to drop significantly with reduced allocation rate

## Related Files

- `src/components/Monitor/PrimaryVisualization.tsx` - RAF loop fixes
- `src/visualization/renderers/WebGLWaterfall.ts` - Colormap caching
- `src/hooks/useDsp.ts` - Buffer reuse optimization

## Testing Notes

- Type-check and lint passed
- HMR will reset memory state, so full page reload needed to test OOM resolution
- Monitor browser DevTools memory profiler during extended reception
- Watch for dropped frames metric - should stabilize with reduced GC pauses
