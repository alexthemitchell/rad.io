# ATSC Player "Playback Error" Investigation - 2025-11-17

## Issue
The ATSC Player page shows "Playback error" when attempting to tune to a channel. After page reload, it shows "Select a channel to start playback" (idle state), but attempting to tune leads to "Tuning..." state that gets stuck.

## Root Cause
The HackRF firmware is in a corrupted state, rejecting all USB control OUT transfers. This happens when:
1. The device was not cleanly closed in a previous session
2. The page was reloaded while the device was streaming
3. The firmware crashed or entered an invalid state

## Symptoms
- All control `transferOut` commands fail with "NetworkError: A transfer error has occurred"
- Control `transferIn` commands work fine (asymmetric behavior indicating firmware corruption)
- Device shows as "opened" but cannot be configured
- Failures occur for:
  - SET_TRANSCEIVER_MODE (command 1)
  - SET_FREQ (command 16)
  - SET_LNA_GAIN (command 19)
  - UI_ENABLE (command 37)
  - SET_BASEBAND_FILTER_BANDWIDTH (command 37)

## Code Investigation

### Tuning Flow
1. `ATSCPlayer.tsx` passes `primaryDevice` from Zustand store to `useATSCPlayer` hook
2. User clicks channel → `handleSelectChannel` → `player.tuneToChannel(channel)`
3. `tuneToChannel` checks `if (!device?.isOpen())` - if false, sets error state
4. Configures device: sample rate, frequency, bandwidth, gains
5. Calls `device.receive(callback)` to start streaming
6. `receive()` method in `HackRFOne.ts`:
   - Disables UI (UI_ENABLE command) - wrapped in try-catch (non-fatal)
   - Calls `setTransceiverMode(TransceiverMode.RECEIVE)` - **NOT** wrapped in try-catch
   - Switches to streaming alt interface
   - Starts bulk transfer loop

### The Fix Applied
Wrapped `setTransceiverMode()` call in try-catch in `HackRFOne.ts` line 1063-1077:

```typescript
try {
  await this.setTransceiverMode(TransceiverMode.RECEIVE);
} catch (error) {
  // If we can't enter RX mode, the device firmware is likely corrupted
  // Stop streaming and throw a descriptive error
  this.streaming = false;
  throw new Error(
    `Failed to start RX mode. The HackRF firmware may need a reset. ` +
      `Try refreshing the page or physically reconnecting the device. ` +
      `Original error: ${error instanceof Error ? error.message : String(error)}`,
  );
}
```

This provides a better error message in the console when RX mode fails to start.

### Existing Error Handling
The `tuneToChannel` function in `useATSCPlayer.ts` has a try-catch block (line 683) that catches errors and:
- Logs "Error tuning to channel:" + error
- Sets player state to "error"

This displays "Playback error" in the UI.

## The Real Problem: Device Initialization
The issue occurs BEFORE tuning - during device connection/initialization. The firmware is already corrupted when the app loads. The control transfer failures happen during:
1. Device init (setting transceiver mode to RX during paired device connection)
2. Initial frequency setting (fails after multiple retries)

## Proper Solution
The `HACKRF_PAGE_RELOAD_FIX` memory describes the proper solution:
1. Track whether device was cleanly closed (`wasCleanClosed` flag)
2. On `open()`, detect stale state: `!wasCleanClosed && usbDevice.opened`
3. Perform USB reset: `await usbDevice.reset()`
4. Wait 500ms for firmware to recover
5. Reopen device

This code exists in `HackRFOne.ts` but may not be working properly for all scenarios.

## Workaround
The user must physically reset the HackRF:
1. Unplug USB cable
2. Wait 10+ seconds
3. Press the physical RESET button on the HackRF board
4. Reconnect USB
5. Reload the page

OR simply reload the page multiple times until the USB reset logic successfully clears the firmware state.

## Observations
- Page reload sometimes fixes the issue (USB reset logic works)
- But device can re-enter bad state during tuning if:
  - Frequency change causes firmware to hang
  - Control transfers during streaming fail
  - This happened at 76.309 MHz (ATSC channel 5)
  
- After successful page reload:
  - Device initializes cleanly
  - Frequency sets to 100 MHz successfully
  - Frequency changes to 76.309 MHz successfully
  - But then SET_LNA_GAIN and UI_ENABLE start failing
  - SET_TRANSCEIVER_MODE to RX fails
  
This suggests a specific issue with certain frequencies or the act of changing frequency may corrupt the firmware.

## Recommendations
1. Add more robust error handling for all control transfers during streaming setup
2. Investigate why certain frequencies (like 76 MHz) cause firmware corruption
3. Consider adding automatic USB reset when control transfer pattern indicates firmware corruption
4. Add user-facing notification suggesting page reload when this error occurs
5. Consider adding a "Reset Device" button that performs USB reset programmatically

## Files Modified
- `src/drivers/hackrf/HackRFOne.ts` - Added try-catch around `setTransceiverMode()` in `receive()` method