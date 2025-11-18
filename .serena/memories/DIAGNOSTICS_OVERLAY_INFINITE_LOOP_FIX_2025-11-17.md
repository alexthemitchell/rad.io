# DiagnosticsOverlay Infinite Loop Fix

## Problem
DiagnosticsOverlay component was causing infinite re-renders with errors:
- "Maximum update depth exceeded"
- "The result of getSnapshot should be cached to avoid an infinite loop"

## Root Cause
The `useDiagnostics()` hook in `src/store/index.ts` was returning a new object literal on every selector call, causing React to detect state changes on every render even when the actual values hadn't changed.

```typescript
// INCORRECT (causes infinite loop)
export const useDiagnostics = () => {
  return useStore((state: RootState) => ({
    events: state.events,
    demodulatorMetrics: state.demodulatorMetrics,
    // ... more fields
  }));
};
```

## Solution
Wrap the selector with `useShallow` from `zustand/react/shallow` to perform shallow equality comparison:

```typescript
import { useShallow } from "zustand/react/shallow";

export const useDiagnostics = () => {
  return useStore(
    useShallow((state: RootState) => ({
      events: state.events,
      demodulatorMetrics: state.demodulatorMetrics,
      // ... more fields
    }))
  );
};
```

## Verification
- Playwright MCP browser testing confirmed no console errors
- DiagnosticsOverlay renders correctly in Monitor and ATSCPlayer pages
- Store unit tests pass (22/22)
- No compiler errors or warnings

## Best Practice
**Any Zustand selector that returns an object or array must use `useShallow`** to prevent infinite re-renders. This applies to all custom hooks in `src/store/index.ts`.
