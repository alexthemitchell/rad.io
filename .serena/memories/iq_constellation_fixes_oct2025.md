# IQ Constellation Visualization Fixes - October 2025

## Critical Bugs Fixed

### 1. **Worker Creation Failure** (CRITICAL)
- **Problem**: Worker creation using `eval()` with `import.meta.url` failed with "SyntaxError: Cannot use 'import.meta' outside a module"
- **Root Cause**: TypeScript configuration had `"module": "es6"` which doesn't support `import.meta`
- **Solution**: 
  - Changed `tsconfig.json`: `"module": "esnext"` to enable `import.meta` support
  - Removed broken eval/blob fallback pattern
  - Use direct `new Worker(new URL(..., import.meta.url))` syntax
- **Files Changed**: `tsconfig.json`, `src/components/IQConstellation.tsx`

### 2. **Canvas Dimensions Not Set Before OffscreenCanvas Transfer** (CRITICAL)
- **Problem**: Canvas was transferred to OffscreenCanvas with default 300x150 dimensions instead of intended 750x400
- **Root Cause**: `canvas.style.width/height` was set but not `canvas.width/height` before transferring
- **Solution**: Set actual canvas dimensions with devicePixelRatio before calling `transferControlToOffscreen()`
- **Code Change**:
```typescript
// Set canvas dimensions BEFORE transferring to OffscreenCanvas
const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;

const offscreen = canvas.transferControlToOffscreen();
```
- **Files Changed**: `src/components/IQConstellation.tsx`

### 3. **Worker Missing Transform Support** (MAJOR)
- **Problem**: Pan/zoom transform was passed to worker but never applied to rendering
- **Root Cause**: Worker's `drawConstellation()` function didn't accept or use transform parameter
- **Solution**: 
  - Added `ViewTransform` type to worker
  - Updated `MessageRender` type to include optional `transform`
  - Modified `drawConstellation()` to save/restore context and apply transform via `ctx.translate()` and `ctx.scale()`
- **Files Changed**: `src/workers/visualization.worker.ts`

### 4. **Worker Missing devicePixelRatio Support** (MAJOR)
- **Problem**: Worker hardcoded `dpr = 1`, causing poor rendering on high-DPI displays
- **Root Cause**: OffscreenCanvas can't access `window.devicePixelRatio`
- **Solution**:
  - Pass `dpr` from main thread in `init` and `resize` messages
  - Store as module-level variable in worker
  - Apply correctly in `setup()` and resize handler
- **Files Changed**: `src/workers/visualization.worker.ts`, `src/components/IQConstellation.tsx`

### 5. **Improper Resize Handling in Worker** (MINOR)
- **Problem**: Resize message didn't properly rescale canvas with DPR or reset context
- **Solution**: 
  - Accept `dpr` in resize message
  - Recalculate `offscreen.width/height` with DPR
  - Reset and re-scale context after resize
- **Files Changed**: `src/workers/visualization.worker.ts`

## Test Results (via Playwright)

### Rendering
✅ Canvas renders correctly (750x400px)
✅ Dark background (#0a0e1a) displays properly
✅ Blue I/Q axes render
✅ Signal samples display with density-based coloring
✅ Worker renders in ~9-12ms (excellent performance)

### Interactions
✅ Mouse wheel zoom works (tested with WheelEvent)
✅ Transform state updates correctly
✅ "Reset View" button appears when zoomed/panned
✅ Reset button successfully resets transform
✅ Worker receives and applies transform in real-time

## Files Modified

1. `tsconfig.json` - Changed module from "es6" to "esnext"
2. `src/components/IQConstellation.tsx` - Fixed canvas sizing, worker creation, added DPR support
3. `src/workers/visualization.worker.ts` - Added transform support, DPR handling, proper resize logic

## Performance Impact

- Worker rendering: ~9-12ms per frame (excellent)
- OffscreenCanvas enables true off-main-thread rendering
- Pan/zoom interactions are smooth and responsive
- High-DPI displays now render crisply

## Remaining Work

- Update Jest mocks to handle new Worker syntax (tests may need updates)
- Consider adding pinch-to-zoom for mobile devices
- Add keyboard shortcuts for zoom (already supported via useVisualizationInteraction)

## Lessons Learned

1. Always set canvas dimensions before transferring to OffscreenCanvas
2. TypeScript module settings must support import.meta for Worker instantiation  
3. OffscreenCanvas can't access window APIs - must pass values from main thread
4. Context transforms must be saved/restored to avoid affecting subsequent renders
5. Playwright is excellent for testing canvas rendering and interactions
