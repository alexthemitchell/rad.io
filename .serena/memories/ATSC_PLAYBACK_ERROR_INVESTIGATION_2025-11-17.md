# HackRF Firmware Corruption Recovery

## Problem

HackRF firmware can enter a corrupted state where USB control OUT transfers fail with `NetworkError` while control IN transfers succeed. This asymmetric failure indicates firmware-level corruption requiring device reset.

## Triggers

- Unclean device closure (page reload during streaming)
- Firmware crash or invalid state transition
- Certain frequency changes during active streaming

## Detection

Check `src/drivers/hackrf/core/recovery.ts`:
- `wasCleanClosed` flag tracks clean shutdown
- Control OUT failures during `setTransceiverMode()` or frequency changes indicate corruption

## Recovery Strategy

**Automatic (Primary):**
1. `usbDevice.reset()` on open if `!wasCleanClosed && usbDevice.opened` (see `src/drivers/hackrf/core/transport.ts`)
2. 500ms wait for firmware recovery
3. Reopen device

**Manual (Fallback):**
1. Unplug USB cable
2. Wait 10+ seconds  
3. Reconnect USB
4. Reload page

## Implementation

See `src/drivers/hackrf/core/recovery.ts` for `Recovery` class with `reset()` and `fastRecovery()` methods. Error handling in `src/hooks/useATSCPlayer.ts` catches tuning failures and displays "Playback error" UI state.

## Related

- See `HACKRF_PAGE_RELOAD_FIX` memory for USB reset implementation details
- See `HACKRF_FIRMWARE_CORRUPTION_WINDOWS` memory for platform-specific recovery methods
