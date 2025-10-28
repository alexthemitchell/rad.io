import { test } from "@playwright/test";

// Real HackRF E2E tests are NOT SUPPORTED in Playwright.
//
// WebUSB API requires:
// - User gestures for device pairing (cannot be automated)
// - Native browser permissions (blocked in Playwright's sandbox)
// - Real hardware access (not available in automation context)
//
// For real hardware testing:
// 1. Use manual testing checklist in e2e/monitor-real-manual.md
// 2. Or use Playwright MCP browser tools (semi-automated with user interaction)
// 3. Integration tests with mocked WebUSB hooks (src/hooks/__tests__/useUSBDevice.test.ts)
//
// This test is permanently skipped to document the limitation.
// DO NOT attempt to enable it - it will always fail due to WebUSB restrictions.

test.skip("@real monitor should start/stop with real HackRF - NOT SUPPORTED", async () => {
  // This test is skipped because WebUSB cannot be automated with Playwright.
  // See e2e/monitor-real-manual.md for manual testing procedure.
  throw new Error(
    "WebUSB testing is not supported in Playwright automation. Use manual testing.",
  );
});
