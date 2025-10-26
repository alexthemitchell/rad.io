# Prompt: Test Real HackRF Hardware (Manual E2E)

## Context

You are testing the rad.io SDR visualizer application with a **real HackRF One device** connected via USB. WebUSB APIs cannot be automated with Playwright, so this requires manual interaction with browser dialogs and verification of device behavior.

## Prerequisites

Before starting, verify:

- [ ] HackRF One device is connected via USB
- [ ] Dev server is running (`npm start`) on https://localhost:8080
- [ ] Chrome or Edge browser (WebUSB support required)
- [ ] You have the manual testing checklist: `e2e/monitor-real-manual.md`

## Your Task

Perform comprehensive manual testing of WebUSB device integration following the checklist in `e2e/monitor-real-manual.md`. Use the Playwright MCP browser tools to assist where possible, but understand that device pairing **requires manual user interaction**.

## Testing Workflow

### Step 1: Start the Application

```bash
# Start dev server (if not already running)
npm start
```

Wait for server to be ready at https://localhost:8080

### Step 2: Open Browser with MCP Tools

Use Playwright MCP to navigate and capture state:

```typescript
// Navigate to monitor page
await mcp_microsoft_pla_browser_navigate({
  url: "https://localhost:8080/monitor",
});

// Wait for page to load
await mcp_microsoft_pla_browser_wait_for({
  text: "Monitor - Live Signal Reception",
  time: 5,
});

// Capture initial state
await mcp_microsoft_pla_browser_snapshot();
await mcp_microsoft_pla_browser_take_screenshot({
  filename: "hackrf-test-initial.png",
  fullPage: true,
});
```

### Step 3: Device Pairing (Manual Required)

**If device is not already paired:**

1. Find the "Connect Device" button in the snapshot
2. Click it using MCP:

```typescript
await mcp_microsoft_pla_browser_click({
  element: "Connect SDR device button",
  ref: "...", // Get ref from snapshot
});
```

3. **MANUAL ACTION REQUIRED**: A WebUSB device picker will appear
   - User must manually select "HackRF One" from the list
   - Click "Connect" in the dialog
   - This cannot be automated

4. After pairing, verify device connected:

```typescript
// Wait for device to initialize
await mcp_microsoft_pla_browser_wait_for({ time: 3 });

// Capture connected state
await mcp_microsoft_pla_browser_snapshot();
await mcp_microsoft_pla_browser_take_screenshot({
  filename: "hackrf-test-connected.png",
});
```

5. Verify in snapshot:
   - Device status shows "HackRF One"
   - "Start reception" button is visible and enabled
   - Sample rate displays in status bar

**If device is already paired:**

The device should auto-connect within 2-3 seconds. Verify:

- No "Connect Device" button visible
- "Start reception" button appears automatically
- Device status shows "HackRF One"

### Step 4: Test Reception Start/Stop

```typescript
// Find and click Start reception
const startBtn = await mcp_microsoft_pla_browser_click({
  element: "Start reception button",
  ref: "...", // Get from snapshot
});

// Wait for streaming to begin
await mcp_microsoft_pla_browser_wait_for({ time: 2 });

// Capture visualization rendering
await mcp_microsoft_pla_browser_take_screenshot({
  filename: "hackrf-test-receiving.png",
});

// Verify in browser console
const receiving = await mcp_microsoft_pla_browser_evaluate({
  function: "() => window.dbgReceiving",
});
// Should return true

// Let it run for a few seconds
await mcp_microsoft_pla_browser_wait_for({ time: 3 });

// Stop reception
await mcp_microsoft_pla_browser_click({
  element: "Stop reception button",
  ref: "...", // Get from snapshot
});

await mcp_microsoft_pla_browser_wait_for({ time: 1 });

// Verify stopped
const stopped = await mcp_microsoft_pla_browser_evaluate({
  function: "() => window.dbgReceiving",
});
// Should return false
```

### Step 5: Test Auto-Reconnect

```typescript
// Navigate away
await mcp_microsoft_pla_browser_navigate({
  url: "https://localhost:8080/",
});

// Navigate back to monitor
await mcp_microsoft_pla_browser_navigate({
  url: "https://localhost:8080/monitor",
});

// Wait for auto-reconnect
await mcp_microsoft_pla_browser_wait_for({ time: 3 });

// Verify device reconnected automatically
await mcp_microsoft_pla_browser_snapshot();
```

Device should auto-connect without showing the picker dialog.

### Step 6: Test Device Replug (Manual)

**MANUAL ACTIONS REQUIRED:**

1. With device connected and visible in UI:
   - Physically unplug USB cable
   - Verify UI updates to show "No Device"
   - "Connect Device" button should reappear

2. Plug device back in:
   - Device should auto-reconnect (if previously paired)
   - "Start reception" button should reappear
   - No picker dialog should appear

3. Capture final state:

```typescript
await mcp_microsoft_pla_browser_snapshot();
await mcp_microsoft_pla_browser_take_screenshot({
  filename: "hackrf-test-replug-success.png",
});
```

### Step 7: Check for Errors

```typescript
// Get console errors
const errors = await mcp_microsoft_pla_browser_console_messages({
  onlyErrors: true,
});

// Review and report any unexpected errors
// Note: Some harmless warnings are expected
```

### Step 8: Close Browser

```typescript
await mcp_microsoft_pla_browser_close();
```

## Verification Checklist

Go through `e2e/monitor-real-manual.md` and verify:

- [ ] **Test Case 1**: First-time pairing works
- [ ] **Test Case 2**: Auto-reconnect works after browser restart
- [ ] **Test Case 3**: Start/Stop reception works correctly
- [ ] **Test Case 4**: Hot-reload preserves connection (requires code change)
- [ ] **Test Case 5**: Device replug handling works
- [ ] **Test Case 6**: Error handling is graceful

## Expected Results

**Success criteria:**

- Device pairs successfully via WebUSB picker
- Auto-reconnect works without re-pairing
- Start/Stop reception controls work
- Visualizations render and update during reception
- No crashes or freezes when device is unplugged
- Console shows minimal/no errors

**Known issues to ignore:**

- Self-signed certificate warnings (expected in dev)
- WebGL context warnings (may occur on some hardware)
- Hot-reload warnings from Webpack (harmless)

## Troubleshooting

### Device Not Appearing in Picker

1. Check USB connection
2. Try different USB port
3. Verify device is not in use by another application
4. Check browser console for WebUSB errors
5. Ensure using Chrome/Edge (Firefox doesn't support WebUSB)

### Device Connects But Start Button Disabled

1. Wait 2-3 seconds for device initialization
2. Check console for initialization errors
3. Try unplugging and replugging device
4. Refresh page and reconnect

### Auto-Reconnect Not Working

1. Device may not have been properly paired initially
2. Clear browser site data and re-pair
3. Verify device serial number hasn't changed
4. Check that you're not in Incognito/Private mode

### Visualizations Not Updating

1. Verify reception is actually started (check console: `window.dbgReceiving`)
2. Check sample rate is being reported
3. Ensure HackRF firmware is up to date
4. Try adjusting frequency or FFT size

## Reporting Results

After completing all tests, provide:

1. **Summary**: Pass/Fail for each test case
2. **Screenshots**: Attach all captured screenshots
3. **Console output**: Note any errors or warnings
4. **Issues found**: Describe any unexpected behavior
5. **Performance notes**: Any lag, freezing, or slowness observed

## Important Limitations

**Remember:**

- WebUSB device pairing **CANNOT** be fully automated
- User must manually click device in picker dialog
- This is a browser security feature, not a bug
- MCP tools can help with before/after verification
- Core device selection requires human interaction

## Related Files

- Manual test checklist: `e2e/monitor-real-manual.md`
- WebUSB integration docs: Memory `WEBUSB_AUTO_CONNECT`
- WebUSB hooks: `src/hooks/useUSBDevice.ts`, `src/hooks/useHackRFDevice.ts`
- Device context: `src/contexts/DeviceContext.tsx`
- Mock device (for comparison): `src/models/MockSDRDevice.ts`

## Success Indicators

You've completed this task successfully when:

- ✅ All test cases in checklist have been executed
- ✅ Device pairing and auto-reconnect verified working
- ✅ Start/Stop reception tested successfully
- ✅ Screenshots captured for documentation
- ✅ Any issues documented with reproduction steps
- ✅ Results reported clearly with pass/fail status
