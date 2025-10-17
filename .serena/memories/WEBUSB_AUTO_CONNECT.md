# WebUSB Automatic Device Connection

## Overview

Implemented automatic WebUSB device reconnection without requiring user approval for previously paired devices, based on StackOverflow answer: https://stackoverflow.com/a/56387128

## Key Functionality

### Auto-Detection on Page Load

- Uses `navigator.usb.getDevices()` to check for previously paired devices
- Automatically connects to HackRF devices (vendorId: 0x1d50) without user prompt
- Shows "Checking for Device..." status during check

### Hot Reload Support

**Critical Feature**: Device stays connected after Webpack hot module replacement

- No need to click "Connect Device" after code changes
- Device automatically reconnects using stored permissions
- Significantly improves development workflow

### Device Event Listeners

- Listens for USB `connect` events (auto-reconnects when device is plugged back in)
- Listens for USB `disconnect` events (clears device state when unplugged)
- Filters events to only process matching devices (by vendor/product ID)

## Implementation Files

### `src/hooks/useUSBDevice.ts`

- Added `isCheckingPaired` state
- Added `checkPairedDevices()` function using `navigator.usb.getDevices()`
- Added USB event listeners in useEffect
- Enhanced device filtering logic

### `src/hooks/useHackRFDevice.ts`

- Exports `isCheckingPaired` state
- Updated JSDoc to reflect auto-pairing behavior

### `src/pages/Visualizer.tsx`

- Uses `isCheckingPaired` to show "Checking for Device..." status
- Button disabled during device check
- Updated tooltips for auto-connection flow

## Requirements for Auto-Connection

Device must maintain same identifiers across resets:

1. Vendor ID (HackRF: 0x1d50)
2. Product ID (HackRF: 0x6089)
3. Serial number (unique per device)

HackRF One meets all requirements ✓

## Testing Results

### Test 1: Page Load

✅ Device automatically detected and connected on page load
✅ No user prompt required
✅ Status shows "Connected" immediately

### Test 2: Hot Reload

✅ Made code change (updated subtitle text)
✅ Webpack hot-reloaded the page
✅ Device stayed connected without user interaction
✅ Status remained "Connected" throughout reload

### Test 3: Visual Verification

Screenshots captured in `.playwright-mcp/`:

- `webusb-auto-connect-success.png` - Initial auto-connect
- `webusb-hot-reload-success.png` - After hot reload with text change

## Developer Experience Impact

**Before**: After every hot reload, developer had to:

1. Click "Connect Device" button
2. Select device from WebUSB picker
3. Wait for device to initialize
4. Resume testing

**After**: Hot reload completes and device is automatically reconnected

- Saves ~5-10 seconds per hot reload
- Eliminates manual device selection step
- Seamless development workflow

## Documentation

Complete documentation added in `WEBUSB_AUTO_CONNECT.md`:

- Implementation details
- How it works
- Testing procedures
- Troubleshooting guide
- API reference
- Future enhancements

## Browser Compatibility

Requires:

- WebUSB API support
- `navigator.usb.getDevices()` method
- USB connection event support

Works in: Chrome, Edge, Opera (Chromium-based browsers)
