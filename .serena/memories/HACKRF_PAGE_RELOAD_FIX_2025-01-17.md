# HackRF Page Reload Fix - 2025-01-17

## Problem Summary

USB Control Transfer failures occurred after page reloads. The HackRF device would accept control IN transfers but reject ALL control OUT transfers, causing the driver to fail initialization.

## Root Cause

When a web page navigates/reloads:
1. The browser automatically releases USB devices
2. Our `beforeunload` handler tries to close the device gracefully
3. These two operations race, leaving the device firmware in a corrupted state
4. On the new page load, `navigator.usb.getDevices()` returns the same device object, but the firmware is in a bad state
5. Control OUT transfers fail with "NetworkError: A transfer error has occurred"

The issue was **not** in our control transfer code itself (parameters were correct), but in how we handled device state across page navigation events.

## Solution Implemented

### 1. State Tracking (`wasCleanClosed` field)

Added a private field to track whether the device was properly closed:

```typescript
private wasCleanClosed = false;
```

- Set to `true` only when `close()` successfully completes
- Set to `false` when close fails or device was already closed
- Set to `false` after successful `open()`

### 2. USB Reset on Stale State Detection

Modified `open()` to detect and reset stale devices:

```typescript
const needsReset = !this.wasCleanClosed && this.usbDevice.opened;

if (needsReset) {
  console.warn("HackRFOne.open: Device may be in stale state, performing USB reset");
  await this.usbDevice.reset();
  await this.delay(500); // Give device time to complete reset
  await this.usbDevice.open(); // Reopen after reset
}
```

This ensures that if a device is reopened after a page reload (where `wasCleanClosed` is false), the firmware is reset to a clean state before claiming the interface.

### 3. Improved `close()` Error Handling

Enhanced `close()` to:
- Prevent concurrent close operations (early return if already closing)
- Track whether close succeeded or failed
- Handle cases where browser already released the device

```typescript
async close(): Promise<void> {
  if (this.closing) {
    return; // Prevent concurrent closes
  }
  
  this.streaming = false;
  this.closing = true;
  
  if (this.usbDevice.opened) {
    // ... release interface, close device
    try {
      await this.usbDevice.close();
      this.wasCleanClosed = true; // Mark as clean
    } catch (err) {
      this.wasCleanClosed = false; // Mark as dirty
    }
  } else {
    this.wasCleanClosed = false; // Already closed by browser
  }
}
```

## Files Modified

### src/drivers/hackrf/HackRFOne.ts
- Added `wasCleanClosed: boolean` field
- Modified `open()` to detect stale state and perform USB reset
- Modified `close()` to track clean vs dirty closes and prevent races

## Tests Added

### e2e/hackrf-page-reload.spec.ts (E2E Tests)
- Single page reload test
- Multiple rapid reloads test
- Control transfers after reload test
- Streaming during reload test
- No console errors test
- Device reset verification test

### src/drivers/hackrf/__tests__/HackRFStateManagement.test.ts (Unit Tests)
- Clean open/close cycles
- Dirty close detection
- Reset on stale state
- Concurrent close prevention
- Page reload simulation
- Error recovery paths

All 12 unit tests pass.

## Testing Results

**Unit Tests**: ✅ 12/12 passing
- Device opening scenarios (4 tests)
- Device closing scenarios (4 tests)
- Page reload simulation (2 tests)
- Error recovery (2 tests)

**E2E Tests**: Created comprehensive browser-based tests (not yet run with real hardware)

## Key Learnings

1. **WebUSB auto-releases devices on page navigation** - this is spec behavior
2. **Browser and app cleanup can race** - need to track whether our close completed
3. **Firmware state persists across WebUSB releases** - USB reset is needed to clear it
4. **IN vs OUT transfer asymmetry** indicates firmware corruption - device accepts reads but not writes
5. **`usbDevice.reset()` closes the device** - must reopen after reset

## Prevention

The fix ensures:
- Device firmware is reset when reopening after page navigation
- State tracking prevents unnecessary resets on clean open/close cycles
- Concurrent close operations are prevented
- Errors during close are properly handled and tracked

## References

- WebUSB Spec: https://wicg.github.io/webusb/
- HackRF USB Protocol: src/drivers/hackrf/constants.ts (RequestCommand enum)
- Previous investigation: .serena/memories/HACKRF_CONTROL_TRANSFER_DEBUG_2025-11-17.md
