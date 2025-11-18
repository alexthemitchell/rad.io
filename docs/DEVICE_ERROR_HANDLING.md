# Device Error Handling Consolidation

## Overview

This document describes the consolidated error handling system for SDR device drivers in rad.io. The system provides consistent user feedback, improved resilience, and centralized error tracking.

## Architecture

### Components

1. **DeviceErrorState** (`src/models/DeviceError.ts`)
   - Standardized error state type
   - Includes error code, message, recovery action, severity, and context
   - Tracks original error and timestamp

2. **DeviceErrorHandler** (Utility Class)
   - Maps low-level errors to standardized error states
   - Provides user-friendly error messages
   - Suggests recovery actions
   - Formats errors for logging and diagnostics

3. **Diagnostics Slice** (`src/store/slices/diagnosticsSlice.ts`)
   - Stores device error history (max 50 entries)
   - Integrated with existing diagnostics system
   - Accessible via `useStore().deviceErrors`

### Error Codes

The system defines 15 standard error codes:

**Connection Errors:**

- `DEVICE_NOT_FOUND` - Device not available
- `DEVICE_DISCONNECTED` - Device unplugged or lost connection
- `DEVICE_BUSY` - Device claimed by another application
- `DEVICE_ACCESS_DENIED` - Permission denied

**Configuration Errors:**

- `INVALID_CONFIGURATION` - Invalid device settings
- `SAMPLE_RATE_NOT_SET` - Sample rate not configured (critical for HackRF)
- `FREQUENCY_OUT_OF_RANGE` - Frequency outside device range
- `SAMPLE_RATE_OUT_OF_RANGE` - Sample rate outside device range

**USB Communication Errors:**

- `USB_TRANSFER_TIMEOUT` - USB transfer timed out
- `USB_TRANSFER_FAILED` - USB transfer failed
- `USB_INVALID_STATE` - Invalid USB device state
- `USB_NETWORK_ERROR` - Network/transfer error

**Device State Errors:**

- `DEVICE_NOT_OPEN` - Device not opened
- `DEVICE_CLOSING` - Device is being closed
- `RECOVERY_FAILED` - Automatic recovery failed
- `MAX_RETRIES_EXCEEDED` - Too many retry attempts

### Recovery Actions

The system suggests appropriate recovery actions:

- `RETRY` - Automatic retry (transient errors)
- `RESET_DEVICE` - Automatic device reset
- `REPLUG_USB` - User must unplug/replug USB
- `RECONNECT` - Reconnect the device
- `CHECK_USB_PORT` - Try different USB port
- `CLOSE_OTHER_APPS` - Close conflicting applications
- `RECONFIGURE` - Adjust device configuration
- `NONE` - No recovery action needed

### Error Severity Levels

- `INFO` - Informational (not an error)
- `WARNING` - Warning (recoverable)
- `ERROR` - Error (may be recoverable)
- `CRITICAL` - Critical error (not recoverable)

## Usage

### Tracking Errors

Errors are automatically tracked at each layer:

```typescript
// In HackRFOne.ts
private trackError(error: Error | unknown, context?: Record<string, unknown>): void {
  const errorState = DeviceErrorHandler.mapError(error, context);
  useStore.getState().addDeviceError(errorState);
}

// Usage
try {
  await this.fastRecovery();
} catch (recoveryError) {
  this.trackError(recoveryError, {
    operation: "fastRecovery",
    sampleRate: this.lastSampleRate,
  });
  throw recoveryError;
}
```

### User Notifications

Errors are automatically converted to user-friendly messages:

```typescript
// In useDeviceIntegration.ts
const errorState = DeviceErrorHandler.mapError(err, {
  operation: "initializeDevice",
  deviceId,
});

notify({
  message: DeviceErrorHandler.formatUserMessage(errorState),
  tone: "error",
  sr: "assertive",
  visual: true,
  duration: 6000,
});
```

### Accessing Error History

```typescript
const { deviceErrors } = useStore.getState();

// Get recent errors
const recentErrors = deviceErrors.slice(-10);

// Filter by error code
const timeoutErrors = deviceErrors.filter(
  (e) => e.code === DeviceErrorCode.USB_TRANSFER_TIMEOUT,
);

// Clear error history
useStore.getState().clearDeviceErrors();
```

### Determining Recovery Strategy

```typescript
const errorState = DeviceErrorHandler.mapError(error);

if (DeviceErrorHandler.shouldAttemptAutoRecovery(errorState)) {
  // Attempt automatic recovery
  await device.fastRecovery();
} else if (DeviceErrorHandler.isRecoverable(errorState)) {
  // Show recovery instructions to user
  const instructions = DeviceErrorHandler.getRecoveryInstructions(errorState);
  notify({ message: instructions });
} else {
  // Non-recoverable error - user intervention required
  const userMessage = DeviceErrorHandler.formatUserMessage(errorState);
  notify({ message: userMessage, tone: "error" });
}
```

## Error Flow

### 1. Error Occurs

Low-level error occurs in driver (e.g., USB transfer timeout)

### 2. Error Mapped

`DeviceErrorHandler.mapError()` converts to standardized `DeviceErrorState`

### 3. Error Tracked

Error added to diagnostics store via `addDeviceError()`

### 4. User Notified

User-friendly message displayed via notification system

### 5. Recovery Attempted

If appropriate, automatic recovery is attempted (`fastRecovery()`)

### 6. Error Logged

Technical details logged to console for debugging

## Integration Points

### HackRFOne.ts

- Tracks errors in `receive()` streaming loop
- Tracks recovery failures in `fastRecovery()`
- Tracks unexpected USB errors

### HackRFOneAdapter.ts

- Tracks errors in public API methods (`open`, `close`, `receive`, etc.)
- Adds device context to all tracked errors

### useDeviceIntegration.ts

- Tracks device initialization errors
- Displays user notifications for all errors
- Provides user-friendly error messages

### Devices.tsx

- Uses standardized error messages in UI error handlers
- No more hardcoded error strings

## Testing

### Unit Tests

- `DeviceError.test.ts` - 29 tests covering error mapping, recovery detection, and message formatting

### Integration Tests

- `DeviceErrorIntegration.test.ts` - 19 tests covering:
  - Error tracking across layers
  - Error history management
  - Recovery flow integration
  - Cross-layer error propagation

## Best Practices

1. **Always track errors** - Use `trackError()` for all caught errors in driver code
2. **Include context** - Provide operation name, device ID, and relevant state
3. **Use specific error codes** - Map to the most specific error code possible
4. **Test error paths** - Add tests for error scenarios
5. **Log for debugging** - Keep technical details in logs while showing friendly messages to users

## Example Error Messages

### Before (Inconsistent)

```
"Failed to initialize device"
"Error: Device not responding"
"USB error"
```

### After (Standardized)

```
"Device has been disconnected. Please reconnect the device.

Please unplug the USB cable, wait 5 seconds, then plug it back in."

"Device not responding. The device may need to be reset or reconnected.

The device will be automatically reset. If the problem persists, unplug and replug the USB cable."

"Device is busy or claimed by another application. Close other SDR applications and try again.

Close other applications that may be using the device (SDR#, GQRX, etc.) and try again."
```

## Platform-Specific Limitations

### HackRF One on Windows

**Firmware Corruption Recovery:**

When HackRF firmware becomes corrupted (all USB control OUT transfers fail with `NetworkError`), there are two recovery methods:

**1. Software Recovery (Recommended First):**

Use the "Reset Device" button in the Diagnostics overlay, which performs:

1. Close device cleanly
2. Call `usbDevice.forget()` to unpair the device
3. Wait for OS to detect the device has disconnected
4. Request device permission again (may prompt user)
5. Reopen with fresh firmware state

This triggers a USB disconnect/reconnect cycle that resets the firmware without physical intervention.

**2. Physical Power Cycle (If software recovery fails):**

1. Unplug the USB cable
2. Wait 10 seconds
3. Plug the cable back in

**Why other software methods fail on Windows:**

- Direct `usbDevice.reset()` returns `NetworkError: Unable to reset the device` when interfaces are claimed
- Chrome security policy blocks forceful USB resets on Windows
- HackRF vendor RESET command (30) is itself a control OUT transfer, so it also fails when firmware is corrupted
- `forget()` DOES work because it causes the OS to re-enumerate the device, which resets firmware state

**Symptoms of firmware corruption:**

- Device shows as "Connected" but all operations fail
- Control IN (read) transfers work, but control OUT (write) transfers fail
- Scanner fails on all channels
- Frequency/sample rate changes fail
- Diagnostics shows repeated "USB communication error" messages

**Prevention:**

- Avoid excessive HMR (Hot Module Replacement) reloads during development
- Use full page refresh instead when needed
- Ensure proper device cleanup before page navigation

## Future Enhancements

- [ ] Add device health metrics (error rate, recovery success rate)
- [ ] Implement error rate limiting to avoid notification spam
- [ ] Add diagnostic panel UI to view error history (partially implemented)
- [ ] Collect anonymous error telemetry for debugging
- [ ] Add device-specific error handlers for RTL-SDR, Airspy, etc.
- [ ] Implement smart retry strategies based on error type
- [ ] Add error trend analysis (e.g., "USB errors increasing")
- [ ] Add persistent error banner in diagnostics overlay for critical errors
