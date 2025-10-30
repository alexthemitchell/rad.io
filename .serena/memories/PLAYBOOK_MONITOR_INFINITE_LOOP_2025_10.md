# Monitor Page Infinite Loop Bug (Oct 2025)

## Symptom
Browser hangs with `Monitor.tsx:134 Start failed` logging thousands of times per second.

## Root Cause
Circular dependency in `useEffect` causing infinite re-render loop:

1. **Auto-start effect** (line 156-164) depends on `[device, isReceiving, handleStart, scanner.state]`
2. **handleStart callback** (line 122-145) depends on `[device, tuneDevice, startDsp, scanner]`
3. **scanner** object (line 77) is returned by `useFrequencyScanner(device, callback)` and may be recreated on renders

### The Loop:
1. Auto-start effect runs → calls `handleStart()`
2. `handleStart()` tries to start MockSDR that's already receiving
3. Catches error, calls `setIsReceiving(false)` (line 135)
4. `isReceiving` change triggers effect again
5. Repeat infinitely

### Why "Already receiving" error?
MockSDRDevice may auto-start or be in receiving state when component mounts, causing the first call to fail.

## Fix Strategy

**Option A: Remove handleStart from dependencies (safest)**
```typescript
useEffect(() => {
  if (!device || !device.isOpen() || isReceiving || scanner.state !== "idle") {
    return;
  }
  void handleStart();
}, [device, isReceiving, scanner.state]); // removed handleStart
```

**Option B: Use ref to break cycle**
```typescript
const handleStartRef = useRef(handleStart);
useEffect(() => { handleStartRef.current = handleStart; }, [handleStart]);

useEffect(() => {
  if (!device || !device.isOpen() || isReceiving || scanner.state !== "idle") {
    return;
  }
  void handleStartRef.current();
}, [device, isReceiving, scanner.state]);
```

**Option C: Guard against already-receiving state**
Add check at start of `handleStart`:
```typescript
if (isReceiving) {
  console.warn("Already receiving, skipping start");
  return;
}
```

**Recommended: Combine A + C** for defense-in-depth.

## Prevention
- Watch for `useCallback` functions in `useEffect` dependencies
- Consider if callback deps cause unstable references (objects, arrays)
- Add guards against re-entrant operations (like "already receiving")
- Test auto-start scenarios with mock devices in e2e

## Related Files
- `src/pages/Monitor.tsx` (lines 122-164)
- `src/hooks/useFrequencyScanner.ts`
- `src/models/MockSDRDevice.ts`
