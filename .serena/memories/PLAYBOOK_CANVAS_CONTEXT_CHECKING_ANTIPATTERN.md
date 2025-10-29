# Canvas Context Checking Anti-Pattern

## Problem

**Never check if a canvas has a context by calling `getContext()`** - this creates the context!

## Root Cause

In browsers, calling `canvas.getContext(type)` on a fresh canvas **creates and returns** a context of that type. You cannot have multiple contexts on the same canvas - once one is created, attempts to get a different type will fail.

## The Anti-Pattern (DO NOT USE)

```typescript
// ❌ WRONG: This CREATES contexts instead of checking for them
const hasContext =
  canvas.getContext("2d") !== null ||
  canvas.getContext("webgl") !== null ||
  canvas.getContext("webgl2") !== null;
```

**What this code actually does:**
1. Tries to get "2d" context → creates and returns a 2D context
2. The check passes, but now the canvas is locked to 2D
3. Later attempts to get WebGL context return `null`

## The Correct Approach

**Option 1: Don't check** - Just try to transfer/initialize and handle failure:

```typescript
try {
  const offscreen = canvas.transferControlToOffscreen();
  // Proceed with worker...
} catch (err) {
  // Fallback to main thread rendering with a DIFFERENT canvas
  console.warn("Canvas transfer failed:", err);
}
```

**Option 2: Track state externally** - Use flags to remember what you did:

```typescript
let canvasTransferred = false;

if (!canvasTransferred && supportsOffscreen()) {
  canvas.transferControlToOffscreen();
  canvasTransferred = true;
}
```

## Real-World Impact (Oct 2025)

This bug prevented visualizations from appearing on the Monitor page:

1. `VisualizationWorkerManager` checked for existing contexts
2. The check created a 2D context on the waterfall canvas
3. Subsequent `WebGLWaterfall.initialize()` failed because WebGL context couldn't be created
4. Result: Black/empty visualization canvases

## Solution Applied

Removed the context-checking code from `VisualizationWorkerManager._initializeInternal()`:

```typescript
// Before (WRONG):
const hasContext =
  canvas.getContext("2d") !== null ||
  canvas.getContext("webgl") !== null ||
  canvas.getContext("webgl2") !== null ||
  canvas.getContext("webgpu") !== null;

if (hasContext) {
  return false;
}

// After (CORRECT):
// Check if transferControlToOffscreen is available
// Note: We cannot reliably check if a canvas already has a context
// without calling getContext(), which would create one.
// Instead, we'll try to transfer and handle failure gracefully.
```

## Key Takeaway

**Canvas contexts are stateful and exclusive.** Once created, you can't change the context type. Never use `getContext()` for existence checks - it's a factory method, not a query method.

## Related Files

- `src/workers/VisualizationWorkerManager.ts` - Fixed in Oct 2025
- `src/components/Monitor/PrimaryVisualization.tsx` - Simplified to avoid worker issues

## References

- MDN HTMLCanvasElement.getContext(): https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
- "The context mode is set to settings's context mode and never changes." - HTML Living Standard
