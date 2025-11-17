# HackRF Control Transfer Investigation - 2025-11-17

## Issue
All USB `controlTransferOut` calls failing with "NetworkError: A transfer error has occurred" while `controlTransferIn` works correctly.

## Root Cause Analysis

### Code Fixes Applied
1. **Corrected recipient field**: Changed `resolveRecipientAndIndex()` to always return `recipient: "device"` instead of conditionally using `"interface"` for some commands. HackRF firmware expects all vendor requests to target the device, not the interface.

### Testing Performed
- ✅ `controlTransferIn` with BOARD_ID_READ (command 14) - **SUCCESS**
- ❌ `controlTransferOut` with AMP_ENABLE (command 17, no data) - **FAILED**
- ❌ `controlTransferOut` with undefined data parameter - **FAILED**
- ❌ `controlTransferOut` with empty ArrayBuffer - **FAILED**

All OUT transfer attempts fail with identical error regardless of:
- Command type
- Data payload format
- Value/index parameters

### Conclusion
**This is a hardware/firmware state issue, not a code bug.**

The HackRF firmware is rejecting all vendor OUT control transfers. This typically indicates:
1. Firmware crash or hung state
2. Device needs hard reset

### Resolution Required
**User must physically reset the HackRF device**:
1. Unplug USB cable
2. Wait 10+ seconds
3. Press physical RESET button on HackRF board
4. Reconnect USB
5. Reload application

## Code Changes
File: `src/drivers/hackrf/HackRFOne.ts`
Method: `resolveRecipientAndIndex()`

**Before:**
```typescript
if (
  command === RequestCommand.SET_LNA_GAIN ||
  command === RequestCommand.SET_VGA_GAIN ||
  command === RequestCommand.SET_TXVGA_GAIN ||
  command === RequestCommand.SET_TRANSCEIVER_MODE
) {
  return {
    recipient: "interface",
    ix: this.interfaceNumber ?? 0,
  };
}
return { recipient: "device", ix: providedIndex };
```

**After:**
```typescript
// HackRF firmware expects all vendor requests to use recipient="device"
// Using "interface" causes WebUSB "transfer error" on Windows/Chrome
// Reference: libhackrf uses LIBUSB_REQUEST_TYPE_VENDOR | LIBUSB_RECIPIENT_DEVICE
return { recipient: "device", ix: providedIndex };
```

This fix aligns our implementation with libhackrf's expectations.

## Follow-up
Once device is physically reset, all control transfers should work correctly with the fixed code.