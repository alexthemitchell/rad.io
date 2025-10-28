# WebUSB Automatic Device Connection

## Overview

This document describes the implementation of automatic WebUSB device reconnection without requiring user approval for previously paired devices.

## Implementation

Based on the [StackOverflow answer](https://stackoverflow.com/a/56387128), we've updated the WebUSB hooks to automatically check for and connect to previously paired devices.

### Key Changes

#### 1. Updated `useUSBDevice` Hook

**File:** `src/hooks/useUSBDevice.ts`

The hook now:

- Automatically checks for paired devices on mount using `navigator.usb.getDevices()`
- Listens for USB `connect` and `disconnect` events
- Filters devices based on provided USB filters (vendor ID, product ID, class code)
- Provides `isCheckingPaired` state to indicate when checking for devices

**Benefits:**

- No user approval required for previously paired devices
- Automatic reconnection when device is plugged back in
- Seamless hot-reload experience - device stays connected after code changes

#### 2. Updated `useHackRFDevice` Hook

**File:** `src/hooks/useHackRFDevice.ts`

- Exposes `isCheckingPaired` state from the underlying `useUSBDevice` hook
- Updated JSDoc to reflect automatic pairing behavior

#### 3. Updated Visualizer UI

**File:** `src/pages/Visualizer.tsx`

- Shows "Checking for Device..." status while checking for paired devices
- Button is disabled during the check to prevent premature user interaction
- Updated tooltips to reflect the automatic pairing behavior

## How It Works

### First-Time Device Pairing

1. User clicks "Connect Device" button
2. Browser shows WebUSB device picker
3. User selects their HackRF device
4. Device is paired and permission is stored by the browser

### Subsequent Sessions

1. Page loads and `useUSBDevice` automatically calls `navigator.usb.getDevices()`
2. Browser returns list of previously paired devices (no user prompt!)
3. Hook filters devices matching HackRF vendor ID (0x1d50)
4. Device is automatically connected without user interaction
5. UI updates to show "Connected" status

### Hot Reload During Development

1. Developer makes code changes
2. Webpack hot-reloads the page
3. `useUSBDevice` checks for paired devices again
4. Device automatically reconnects (as long as vendor ID, product ID, and serial number are the same)
5. No need to click "Connect Device" again!

### Device Reconnection

The hook also listens for `connect` events:

1. User unplugs HackRF device
2. `disconnect` event fires, device state is cleared
3. User plugs device back in
4. `connect` event fires
5. Hook checks if device matches filters
6. Device automatically reconnects without user approval

## Important Notes

### Device Identity Requirements

According to the StackOverflow answer, for automatic reconnection to work:

> "As long as the device keeps the same vendor ID, product ID and serial number then the previously granted permission will still apply when the device resets."

The HackRF One maintains consistent:

- Vendor ID: 0x1d50 (Great Scott Gadgets)
- Product ID: 0x6089 (HackRF One)
- Serial number (unique per device)

### Security Context

WebUSB requires HTTPS. The development server uses:

- HTTPS with self-signed certificate
- URL: `https://localhost:8080/`

### Browser Support

This feature works in browsers that support:

- WebUSB API
- `navigator.usb.getDevices()` method
- USB connection events

Tested in Chromium-based browsers (Chrome, Edge, Opera).

## Testing the Implementation

### Manual Testing Steps

1. **First Connection:**

   ```
   - Open https://localhost:8080/
   - Click "Connect Device"
   - Select HackRF device from picker
   - Verify device connects successfully
   ```

2. **Hot Reload Test:**

   ```
   - Make a small code change (e.g., add a comment)
   - Save the file
   - Webpack will hot-reload
   - Device should automatically reconnect
   - No device picker should appear
   ```

3. **Replug Test:**

   ```
   - With device connected, unplug it
   - UI should show "Not Connected"
   - Plug device back in
   - Device should automatically reconnect
   - UI should show "Connected"
   ```

4. **Browser Restart Test:**

   ```
   - Close browser completely
   - Reopen https://localhost:8080/
   - Device should automatically connect on page load
   ```

### Automated Testing with Playwright

You can use the Playwright MCP tools to automate browser testing:

```typescript
// Navigate to the app
await browser_navigate({ url: "https://localhost:8080/" });

// Take a snapshot to see initial state
await browser_snapshot();

// Wait for device to auto-connect (should happen within 1-2 seconds)
await browser_wait_for({ text: "Connected", time: 5 });

// Verify the "Connect Device" button is replaced with "Start Reception"
await browser_snapshot();
```

## API Reference

### `useUSBDevice`

```typescript
const { device, requestDevice, isCheckingPaired } = useUSBDevice(filters);
```

**Parameters:**

- `filters: USBDeviceFilter[]` - Array of USB device filters

**Returns:**

- `device: USBDevice | undefined` - Connected USB device or undefined
- `requestDevice: () => Promise<void>` - Function to manually request device (shows picker)
- `isCheckingPaired: boolean` - True while checking for paired devices

### `useHackRFDevice`

```typescript
const { device, initialize, cleanup, isCheckingPaired } = useHackRFDevice();
```

**Returns:**

- `device: ISDRDevice | undefined` - Connected HackRF device adapter or undefined
- `initialize: () => Promise<void>` - Function to manually request device (shows picker)
- `cleanup: () => void` - Function to close and cleanup device
- `isCheckingPaired: boolean` - True while checking for paired devices

## Troubleshooting

### Device Not Auto-Connecting

**Problem:** Device doesn't automatically connect on page load

**Solutions:**

1. Ensure device was previously paired (use "Connect Device" button first)
2. Check that device is plugged in before page loads
3. Verify device USB cable and connection
4. Check browser console for WebUSB errors
5. Try unplugging and replugging the device

### Permission Lost After Browser Restart

**Problem:** Device requires re-pairing after closing browser

**Possible Causes:**

1. Device serial number changed (unlikely with HackRF)
2. Browser permissions were cleared
3. Browsing in Incognito/Private mode (permissions not persisted)

**Solutions:**

1. Re-pair device using "Connect Device" button
2. Don't clear browser site data/permissions
3. Use normal browsing mode (not Incognito)

### Hot Reload Shows "Connect Device" Again

**Problem:** After hot reload, button shows "Connect Device" instead of automatically connecting

**Possible Causes:**

1. Device was unplugged during hot reload
2. WebUSB permission was lost (rare)
3. Device is in an error state

**Solutions:**

1. Check device is plugged in
2. Look for error messages in console
3. Click "Connect Device" to re-establish connection
4. Try unplugging and replugging device

## References

- [StackOverflow: Re-connect to USB device without user gesture](https://stackoverflow.com/a/56387128)
- [MDN: WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/USB)
- [WebUSB Specification](https://wicg.github.io/webusb/)
- [Chrome Developers: WebUSB](https://developer.chrome.com/articles/usb/)

## Future Enhancements

Potential improvements to the auto-connection feature:

1. **Connection Status Notifications:**
   - Toast/banner when device auto-connects
   - Visual indicator showing "Auto-connected to previous device"

2. **Multiple Device Support:**
   - Remember and auto-connect to multiple SDR devices
   - Allow user to select which device to use

3. **Connection Retry Logic:**
   - Automatic retry if initial connection fails
   - Exponential backoff for connection attempts

4. **Device Health Monitoring:**
   - Detect when device becomes unresponsive
   - Automatic reconnection on device recovery

5. **Persistent Settings:**
   - Remember frequency, bandwidth, and other settings per device
   - Auto-apply settings on device connection
