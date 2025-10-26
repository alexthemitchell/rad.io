# Playwright E2E Testing with WebUSB - Limitations and Solutions

## Core Finding

**WebUSB API cannot be automated with Playwright.** This is a fundamental, insurmountable limitation.

## Why WebUSB Doesn't Work in Playwright

1. **User gesture requirement** - WebUSB device pairing requires manual user interaction with browser's native device picker dialog
2. **Sandboxed automation context** - Playwright launches browsers in a controlled environment that blocks native hardware APIs
3. **Security model** - Browser automation tools intentionally cannot access USB devices to prevent malicious automation

## What We Tried

1. ❌ **Headed mode** - Setting `headless: false` doesn't help; automation context still blocks WebUSB
2. ❌ **Pre-paired devices** - Even with `navigator.usb.getDevices()` for previously paired devices, Playwright's context prevents access
3. ❌ **Browser permissions** - Standard `context.grantPermissions()` doesn't apply to WebUSB
4. ❌ **Clicking Connect Device button** - Button click works, but native picker dialog never appears in automation

## Current Solution

**Mock SDR testing only for E2E.** Real hardware must be tested manually or with alternative tools.

### File Structure

- `e2e/monitor-mock.spec.ts` - Working CI-friendly tests with `MockSDRDevice`
- `e2e/monitor-real.spec.ts` - Permanently skipped with explanation of limitation
- `e2e/monitor-real-manual.md` - Manual testing checklist for real HackRF
- `docs/e2e-tests.md` - Updated to document WebUSB limitation

### Configuration Changes

- `playwright.config.ts`:
  - Single project: `mock-chromium` only
  - Removed conditional `real-chromium` project (was never going to work)
  - Added `open: "never"` to HTML reporter to prevent hanging
  - Kept `grepInvert: /@real/` to skip any `@real` tagged tests

## Alternative Approaches for Real Hardware Testing

### 1. Manual Testing (Current Recommendation)
Use checklist in `e2e/monitor-real-manual.md`:
- First-time pairing
- Auto-reconnect behavior  
- Start/stop reception
- Hot-reload during development
- Device replug handling
- Error scenarios

### 2. Playwright MCP Browser Tools
Semi-automated testing with real browser instance:
```typescript
// Controls actual Chrome/Edge, not Playwright's sandboxed version
await mcp_microsoft_pla_browser_navigate({ url: "https://localhost:8080/monitor" });
await mcp_microsoft_pla_browser_click({ element: "Connect Device", ref: "..." });
// User manually selects device from picker
await mcp_microsoft_pla_browser_wait_for({ time: 10 });
```
**Caveat**: Still requires user to click device in picker dialog.

### 3. Integration Tests with Mocked WebUSB
Test hooks/logic without real hardware:
- `src/hooks/__tests__/useUSBDevice.test.ts`
- Mock `navigator.usb` APIs
- Verify pairing logic, error handling, state management
- Fast, reliable, can run in CI

### 4. Chrome DevTools Protocol (CDP)
Bypass Playwright entirely, use CDP directly:
- Complex setup
- Still may not support WebUSB in automation
- Not recommended unless absolutely necessary

## Key Takeaways

1. **Accept the limitation** - WebUSB + automation don't mix
2. **Mock for CI** - Fast, reliable, comprehensive coverage
3. **Manual for hardware** - Pre-release checklist with real devices
4. **Integration tests** - Verify logic without hardware
5. **Document clearly** - Save future developers from same rabbit hole

## Related Files

- Playwright config: `playwright.config.ts`
- Mock device implementation: `src/models/MockSDRDevice.ts`
- Mock device detection: `src/utils/e2e.ts`
- Device context: `src/contexts/DeviceContext.tsx`
- WebUSB hooks: `src/hooks/useUSBDevice.ts`, `src/hooks/useHackRFDevice.ts`

## References

- [Playwright WebUSB Support Issue](https://github.com/microsoft/playwright/issues/9939) - Confirmed not supported
- [WebUSB Spec](https://wicg.github.io/webusb/) - Requires user activation
- `WEBUSB_AUTO_CONNECT` memory - Auto-pairing for manual browser use
- `PLAYWRIGHT_E2E_HARDWARE_AND_MOCK` memory - Original (incorrect) assumption about real device testing
