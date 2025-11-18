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

### Automatic Driver Reset with Fallback
1. **Detects firmware corruption**: Tracks consecutive control transfer failures.
2. **Attempts firmware-level reset via HackRF driver**: Uses the vendor RESET command (30) directly through the driver, not WebUSB `reset()`.
3. **Falls back gracefully**: If driver reset fails repeatedly, instruct the user to unplug/replug the device and try again instead of pressing the physical reset button.

### Code Changes
- `src/drivers/hackrf/HackRFOne.ts`: implements automatic detection and internal driver-level reset using the vendor RESET command.
- `src/hooks/useATSCPlayer.ts`: shows a toast instructing the user to use the HackRF driver reset (not WebUSB, not physical button) when firmware corruption is detected.

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
