# Real HackRF Device Testing Guide

## Why Not Playwright?

**WebUSB is not supported in Playwright's automated browser context.** This is a security limitation - WebUSB requires:

- User gestures for device pairing
- Native browser permissions that Playwright's sandboxed environment cannot access
- Real hardware APIs that automation tools cannot reach

## Manual Testing Procedure

Since E2E automation cannot test WebUSB, use this manual testing checklist:

### Setup

1. Ensure HackRF device is connected via USB
2. Start dev server: `npm start`
3. Open Chrome/Edge: `https://localhost:8080/monitor`

### Test Case 1: First-Time Pairing

- [ ] Click "Connect Device" button
- [ ] WebUSB picker dialog appears
- [ ] HackRF One appears in device list
- [ ] Select device and click "Connect"
- [ ] Device status shows "HackRF One"
- [ ] "Start reception" button becomes enabled

### Test Case 2: Auto-Reconnect

- [ ] Close browser (device should stay paired)
- [ ] Reopen `https://localhost:8080/monitor`
- [ ] Device auto-connects (no picker dialog)
- [ ] "Start reception" button appears automatically
- [ ] Device status shows "HackRF One"

### Test Case 3: Start/Stop Reception

- [ ] Click "Start reception" button
- [ ] Spectrum/waterfall visualization starts updating
- [ ] Audio output begins (if AM/FM demod enabled)
- [ ] Sample rate displays in status bar
- [ ] Click "Stop reception" button
- [ ] Visualization freezes on last frame
- [ ] Audio stops

### Test Case 4: Hot-Reload During Development

- [ ] With device connected and receiving
- [ ] Make a code change (e.g., add comment)
- [ ] Save file to trigger hot-reload
- [ ] Device should auto-reconnect after reload
- [ ] Reception should resume automatically
- [ ] No need to click "Connect Device" again

### Test Case 5: Device Replug

- [ ] With device connected
- [ ] Unplug HackRF USB cable
- [ ] UI shows "No Device"
- [ ] "Start reception" button disappears
- [ ] Plug device back in
- [ ] Device auto-reconnects (if previously paired)
- [ ] "Start reception" button reappears

### Test Case 6: Error Handling

- [ ] Start reception with device connected
- [ ] While receiving, unplug device
- [ ] UI shows error message
- [ ] Reception stops gracefully
- [ ] No browser crash or freeze
- [ ] Error logged to console

## Alternative: Playwright MCP Browser Testing

For semi-automated testing, use the Playwright MCP browser tools which control a real browser:

```typescript
// Example MCP browser test (run from VS Code)
await mcp_microsoft_pla_browser_navigate({
  url: "https://localhost:8080/monitor",
});

await mcp_microsoft_pla_browser_snapshot(); // Check initial state

// User manually selects device when picker appears
await mcp_microsoft_pla_browser_click({
  element: "Connect Device button",
  ref: "e61", // from snapshot
});

// Wait 10 seconds for user to select device
await mcp_microsoft_pla_browser_wait_for({ time: 10 });

await mcp_microsoft_pla_browser_snapshot(); // Verify device connected

await mcp_microsoft_pla_browser_click({
  element: "Start reception button",
  ref: "...", // from snapshot
});
```

## Recommendations

1. **Keep Playwright E2E for mock device only** - Fast, reliable, CI-friendly
2. **Manual test real hardware** - Use this checklist before releases
3. **Consider integration tests** - Test WebUSB hooks with Jest mocks
4. **Document WebUSB limitations** - Update README with automation constraints

## Related Documentation

- `WEBUSB_AUTO_CONNECT` memory - Auto-pairing implementation
- `PLAYWRIGHT_E2E_HARDWARE_AND_MOCK` memory - Mock vs real testing
- `docs/e2e-tests.md` - E2E test documentation
