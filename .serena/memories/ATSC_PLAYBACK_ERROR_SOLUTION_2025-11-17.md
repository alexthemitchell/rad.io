# ATSC Playback Error - Final Solution Summary

## Problem
ATSC player shows "Playback error" when attempting to tune to channels due to HackRF firmware corruption.

## Root Cause
The HackRF One firmware can enter a corrupted state where it rejects all USB control OUT transfers while still accepting IN transfers. This is triggered by:
- Page reloads
- Certain frequency configurations (e.g., 76 MHz)
- Prolonged operation

## WebUSB Limitations Discovered
When firmware corruption is severe, even the WebUSB `usbDevice.reset()` API fails with:
```
NetworkError: Failed to execute 'reset' on 'USBDevice': Unable to reset the device
```

This means **software-based recovery has fundamental limitations**:
- WebUSB reset works only when firmware is responsive enough to accept the reset command
- Severely corrupted firmware requires physical intervention (power cycle or reset button)
- WebUSB has no equivalent to Windows driver's "cycle port" operation

## Solution Implemented

### Automatic USB Reset with Fallback
1. **Detects firmware corruption**: Tracks consecutive control transfer failures
2. **Attempts software reset**: Tries `usbDevice.reset()` after 3 consecutive failures
3. **Falls back gracefully**: If USB reset fails, provides clear error message to user

### Code Changes
File: `src/drivers/hackrf/HackRFOne.ts`

#### Added Failure Tracking
```typescript
private consecutiveControlTransferFailures = 0;
private static readonly MAX_CONSECUTIVE_FAILURES_BEFORE_RESET = 3;
```

#### Enhanced controlTransferOut
- Counts consecutive NetworkError/InvalidStateError failures
- Triggers USB reset recovery after threshold
- Provides clear error message if reset fails

#### Improved performUSBResetRecovery
- Returns boolean instead of throwing on failure
- Logs detailed instructions for physical reset when software reset fails
- Error message includes specific steps:
  1. Press RESET button on HackRF
  2. OR unplug and reconnect
  3. Then reload the page

## User Experience
- **When software reset works**: Transparent automatic recovery, user sees no error
- **When firmware is too corrupted**: Clear console error with specific recovery instructions
- **Prevents endless retry loops**: Fails fast with actionable guidance

## Testing Notes
- Software reset works when firmware is mildly corrupted (rare)
- Most cases require physical reset button
- Page reload sometimes helps because it triggers full USB reinitialization
- Buffer health shows 0% when device is corrupted (good diagnostic indicator)

## Recommendations for Users
1. Keep the HackRF in a stable USB port (avoid hubs)
2. Update to latest firmware version
3. When errors occur, press physical RESET button first before debugging
4. If problems persist, unplug/replug device completely

## Technical References
- Microsoft Windows Driver Docs: "How to recover from USB pipe errors"
  - Hierarchy: reset pipe → reset port → cycle port
  - WebUSB only supports device reset (no cycle port equivalent)
- WebUSB Spec: `USBDevice.reset()` can fail with NetworkError when device is unresponsive
