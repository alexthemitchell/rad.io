# HackRF Firmware Reset Solution

## Problem
HackRF One firmware can become corrupted, causing USB control OUT transfers to fail with NetworkError. This prevents:
- Tuning to new frequencies
- Changing sample rates
- Setting transceiver mode
- ATSC player operations

## Root Cause
- Certain operations can corrupt HackRF firmware state
- Symptoms: Control IN transfers work, Control OUT transfers fail with NetworkError
- Triggered by: Page reloads, problematic frequencies (e.g., 76 MHz), prolonged operation

## Solution Implemented

### 1. Automatic Detection (Lines 171-172, 613-672 of HackRFOne.ts)
```typescript
private consecutiveControlTransferFailures = 0;
private static readonly MAX_CONSECUTIVE_FAILURES_BEFORE_RESET = 3;
```

- Tracks consecutive NetworkError failures in `controlTransferOut()`
- After 3 consecutive failures, triggers automatic firmware reset
- Resets counter on successful transfer

### 2. Firmware Reset Recovery (Lines 772-824 of HackRFOne.ts)

**CRITICAL: Avoid Recursion**
- Must call `this.usbDevice.controlTransferOut()` DIRECTLY
- DO NOT call `this.controlTransferOut()` - creates infinite recursion
- The wrapped method has retry logic that calls recovery, creating a loop

**Correct Implementation:**
```typescript
private async performUSBResetRecovery(): Promise<boolean> {
  try {
    console.warn('HackRFOne: Attempting HackRF firmware reset to recover from corruption...');
    
    // Call USB device DIRECTLY to avoid recursion
    const result = await this.usbDevice.controlTransferOut({
      requestType: "vendor",
      recipient: "device",
      request: RequestCommand.RESET,  // Command 30
      value: 0,
      index: 0,
    });
    
    if (result.status !== "ok") {
      throw new Error(`Firmware reset failed with status: ${result.status}`);
    }
    
    // Wait for firmware to reset
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Reopen and reclaim
    await this.open();
    await this.usbDevice.claimInterface(0);
    
    // Reset failure counter
    this.consecutiveControlTransferFailures = 0;
    
    return true;
  } catch (error) {
    console.error('HackRFOne: Firmware reset recovery failed', error);
    console.error(
      'HackRFOne: Firmware corruption may be severe. Driver-level reset might be required.
' +
      '  1. Prefer using the HackRF driver reset method (vendor RESET command 30 via driver) rather than a physical button press.
' +
      '  2. If driver reset fails repeatedly, unplug and replug the USB cable and try again.
' +
      '  3. Reload this page after recovery attempts.'
    );
    return false;
  }
}
```

### 3. User Notification (useATSCPlayer.ts)
```typescript
import { notify } from "../lib/notifications";

// In error handler:
notify({
  message:
    "HackRF firmware may be corrupted. Use the HackRF driver reset (not the WebUSB reset) from rad.io, then retry tuning.",
  tone: "error",
  duration: 10000,
  sr: "assertive",
});
```

## Key Technical Details

### HackRF RESET Command
- Vendor request command: `RequestCommand.RESET = 30`
- Parameters: `value: 0, index: 0`
- Different from USB device reset (`USBDevice.reset()`)
- Firmware-level reset, more reliable than USB-level reset

### Why Direct USB Call?
The recursion problem occurred because:
1. `controlTransferOut()` fails with NetworkError
2. After 3 failures, calls `performUSBResetRecovery()`
3. Recovery sends RESET command via `controlTransferOut()`
4. RESET command fails (firmware corrupted)
5. `controlTransferOut()` calls `performUSBResetRecovery()` again
6. **Infinite loop**

Solution: Call `usbDevice.controlTransferOut()` directly to bypass the retry wrapper.

### Limitations
- If firmware is severely corrupted, even the RESET command fails
- Physical RESET button press required in extreme cases
- User receives toast notification with instructions

## Testing Strategy
1. After physical reset, test automatic recovery on next corruption event
2. Monitor console for "Attempting HackRF firmware reset..." messages
3. Verify no recursion in logs
4. Test problematic frequencies (76 MHz) and page reloads
5. Confirm "Playback error" is prevented

## Reference Implementation
Based on: cho45/hackrf-sweep-webusb/hackrf.js
- Uses direct USB device call for reset
- Standard pattern across HackRF implementations
- Command 30 is documented in libhackrf

## Files Modified
1. `src/drivers/hackrf/HackRFOne.ts` - Main implementation
2. `src/hooks/useATSCPlayer.ts` - User notification
3. `src/drivers/hackrf/constants.ts` - RESET command (already existed)

## Next Steps
1. Physical reset required: Device currently too corrupted to test
2. After reset: Test automatic recovery with channel tuning
3. Validate firmware reset prevents future "Playback error" states
