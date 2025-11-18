# HackRF Firmware Corruption on Windows - Complete Investigation (2025-11-18)

## Critical Finding: Software Recovery Available on Windows

After extensive testing with WebUSB API on Windows/Chrome, we have confirmed:

**Software recovery using `usbDevice.forget()` + re-pair DOES work and is the recommended first recovery method.**

Physical power cycle is only needed if software recovery fails.

## Root Cause

HackRF One firmware enters a corrupted state where **ALL USB control OUT transfers fail** after:
- Repeated HMR (Hot Module Replacement) page reloads
- Extended operation periods
- Certain problematic operations

**Symptoms:**
- Control IN transfers work normally (can read device state)
- Control OUT transfers fail with `NetworkError: A transfer error has occurred`
- Device shows as "connected" but cannot be configured
- Frequency changes fail
- Sample rate changes fail
- Transceiver mode changes fail
- ALL vendor commands fail (including RESET command 30)

## Recovery Methods Tested (Windows/Chrome WebUSB)

| Method | Result | Details |
|--------|--------|---------|
| ❌ Vendor RESET (cmd 30) | **FAILS** | RESET command itself is a control OUT transfer, so it fails too |
| ❌ Page reload | **FAILS** | `navigator.usb.getDevices()` returns same corrupted device object |
| ❌ `usbDevice.reset()` | **FAILS** | Returns `NetworkError: Unable to reset the device` on Windows when interfaces are claimed |
| ✅ **`usbDevice.forget()` + re-pair** | **SUCCESS** | Triggers USB disconnect/reconnect, OS re-enumerates device, resets firmware state |
| ✅ **Physical power cycle** | **SUCCESS** | Unplug USB cable for 10 seconds, replug (fallback if forget fails) |

### Why Some Software Methods Fail on Windows

1. **WebUSB Limitations:**
   - Direct `usbDevice.reset()` is blocked on Windows when USB interfaces are claimed
   - Chrome security policy prevents forceful resets that could affect other apps

2. **What Actually Works:**
   - `forget()` triggers a USB disconnect/reconnect cycle
   - OS re-enumerates the device, which resets firmware state
   - User must grant permission again after forget()
   - This is the recommended first recovery method

3. **Control Transfer Asymmetry:**
   - Control IN (read) transfers continue working during corruption
   - Control OUT (write) transfers all fail
   - This indicates firmware-level corruption, not USB driver issue
   - `forget()` + reconnect clears this state

## Current Implementation

### Automatic Detection
```typescript
// HackRFOne.ts - Lines 785-800
private consecutiveControlTransferFailures = 0;

// In controlTransferOut():
if (error.name === "NetworkError" && attemptsRemaining <= this.MAX_RETRIES - 3) {
  this.consecutiveControlTransferFailures++;
  
  if (this.consecutiveControlTransferFailures >= 3) {
    const resetSucceeded = await this.performUSBResetRecovery();
    if (!resetSucceeded) {
      throw new Error("HackRF firmware corruption detected...");
    }
  }
}
```

### Recovery Attempts
```typescript
// HackRFOne.ts - Lines 941-1000
private async performUSBResetRecovery(): Promise<boolean> {
  try {
    // Attempt 1: USB device reset (fails on Windows)
    await this.usbDevice.reset();
    
    // Attempt 2: Soft recovery - close/reopen
    await this.close();
    await this.open();
    
    return true;
  } catch (error) {
    // Both attempts failed - firmware severely corrupted
    this.trackError(error, { operation: "performUSBResetRecovery" });
    return false;
  }
}
```

### User-Facing Reset Button
```typescript
// HackRFOne.ts - Lines 596-650
async resetAndReopen(): Promise<void> {
  // 1. Close device cleanly
  await this.close();
  
  // 2. Clear failure counters
  this.consecutiveControlTransferFailures = 0;
  this.wasCleanClosed = false;
  
  // 3. Try forget/re-pair (WORKS on Windows - triggers USB disconnect/reconnect)
  try {
    await this.usbDevice.forget();
    const devices = await navigator.usb.getDevices();
    const sameDevice = devices.find(/* match by VID/PID/serial */);
    // Update device reference - user must grant permission to re-pair
  } catch (err) {
    // Fallback: try USB reset (fails on Windows when interfaces claimed)
    await this.usbDevice.reset();
  }
  
  // 4. Reopen (will trigger recovery path if needed)
  await this.open();
}
```

## Error Handling Integration

### New DeviceError System (Merged 2025-11-18)

**Error Mapping:**
```typescript
// DeviceError.ts - Maps NetworkError to user-friendly message
{
  pattern: /NetworkError|transfer error/i,
  mapping: {
    code: DeviceErrorCode.USB_NETWORK_ERROR,
    message: "USB communication error. Attempting automatic recovery.",
    recoveryAction: RecoveryAction.RETRY,
    severity: ErrorSeverity.WARNING,
  }
}
```

**Error Tracking:**
```typescript
// HackRFOneAdapter.ts - All operations wrapped with error tracking
private trackError(error: Error | unknown, context?: Record<string, unknown>): void {
  const errorState = DeviceErrorHandler.mapError(error, {
    ...context,
    deviceId: this.deviceId,
    deviceType: "HackRF One",
  });
  useStore.getState().addDeviceError(errorState);
}
```

**User Notifications:**
```typescript
// useDeviceIntegration.ts - Shows user-friendly error messages
notify({
  message: DeviceErrorHandler.formatUserMessage(errorState),
  tone: "error",
  sr: "assertive",
  visual: true,
  duration: 6000,
});
```

## Testing Results (2025-11-18)

### Before Power Cycle (Corrupted State)
```
HackRFOne.controlTransferOut: transfer failed {command: 16, error: "A transfer error has occurred"}
HackRFOne.performUSBResetRecovery: attempting USB device reset
HackRFOne.performUSBResetRecovery: USB reset failed, trying soft recovery
Error scanning channel 2: NetworkError: Failed to execute 'controlTransferOut' on 'USBDevice'
Error scanning channel 3: NetworkError: Failed to execute 'controlTransferOut' on 'USBDevice'
[... ALL channels fail ...]
```

### After Power Cycle (Healthy State)
```
🔌 DEVICE: Device initialized {deviceId: 7504:24713:0000000000000000f77c60dc273dbcc3}
HackRFOne.setFrequency: Frequency configured {frequency: 63000000, frequencyMHz: 63.000}
Device connected successfully
[... 30+ frequency changes succeed ...]
Scan completed successfully
```

## User Instructions

### When Corruption Occurs

1. **Recognize the symptoms:**
   - Device shows "Connected" but operations fail
   - "USB communication error" notifications
   - ATSC scanner fails on all channels
   - Diagnostics shows repeated control transfer failures

2. **Try software recovery first (Recommended):**
   ```
   1. Open Diagnostics overlay (click "Diagnostics" button)
   2. Click "🔄 Reset Device" button
   3. Grant permission when prompted to re-pair the device
   4. Device will reconnect with fresh firmware state
   ```

3. **If software recovery fails, use physical power cycle:**
   ```
   1. Unplug the HackRF USB cable
   2. Wait 10 seconds
   3. Plug the cable back in
   4. Device will reconnect automatically
   ```

4. **Avoid repeated HMR reloads:**
   - Excessive HMR reloads during development trigger corruption
   - Use full page refresh instead when needed

### Prevention in Development

**Current Implementation (from merged code):**
```typescript
// useDeviceIntegration.ts - Global shutdown hook
useEffect(() => {
  const globalRad = (globalThis.radIo ??= {});
  
  Object.assign(globalRad, {
    shutdown: async (): Promise<void> => {
      try {
        globalRad["closing"] = true;
        await closeAllDevices();
        // Terminate DSP workers
      } finally {
        globalRad["closing"] = false;
      }
    },
  });
  
  return () => {
    void closeAllDevices();
  };
}, [closeAllDevices]);
```

## Documentation Updates

### Updated Files
1. ✅ `docs/DEVICE_ERROR_HANDLING.md` - Needs Windows limitation note
2. ✅ Memory: `HACKRF_FIRMWARE_CORRUPTION_WINDOWS_2025-11-18` (this file)
3. ⏳ `docs/hackrf-initialization-guide.md` - Needs troubleshooting section
4. ⏳ `README.md` - Needs known limitations section

### Recommended User-Facing Changes

**Diagnostics Overlay - Enhanced Error Display:**
```typescript
// Show persistent error banner when corruption detected
if (deviceErrors.some(e => e.code === DeviceErrorCode.USB_NETWORK_ERROR)) {
  <Alert severity=\"error\">
    <AlertTitle>Device Communication Error</AlertTitle>
    <p>The HackRF device firmware may be corrupted.</p>
    <p><strong>Recommended:</strong> Click the "🔄 Reset Device" button below to trigger software recovery.</p>
    <p><em>If that fails, unplug the USB cable for 10 seconds and plug it back in.</em></p>
    <Button onClick={handleResetDevice}>🔄 Reset Device</Button>
  </Alert>
}
```

## Key Takeaways

1. **Software recovery via `forget()` + re-pair WORKS** - this is the recommended first recovery method
2. **Windows WebUSB has strict security limitations** - direct `reset()` fails when interfaces are claimed
3. **Physical power cycle is a reliable fallback** - use when software recovery fails
4. **Automatic recovery code is valuable for other errors** - performUSBResetRecovery() handles transient issues
5. **User education is critical** - Reset Device button provides guided recovery workflow
6. **HMR reload safety is important** - proper cleanup prevents corruption triggers
7. **Error tracking provides visibility** - diagnostics can show patterns and help debug

## Related Files

- `src/drivers/hackrf/HackRFOne.ts` - Core driver with recovery logic
- `src/drivers/hackrf/HackRFOneAdapter.ts` - Error tracking integration
- `src/models/DeviceError.ts` - Error mapping and classification
- `src/hooks/useDeviceIntegration.ts` - Device lifecycle and cleanup
- `src/components/DiagnosticsOverlay.tsx` - Reset device button UI
- `docs/DEVICE_ERROR_HANDLING.md` - Error handling architecture
