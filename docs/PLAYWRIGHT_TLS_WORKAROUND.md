# Playwright Screenshot Workaround for TLS/HTTPS

## Problem

The Playwright MCP server tools (`playwright-browser_navigate`, `playwright-browser_take_screenshot`, etc.) cannot access `https://localhost:8080` because they don't support the `ignoreHTTPSErrors` option needed for self-signed certificates.

## Root Cause

The Playwright MCP server (`@playwright/mcp@0.0.40`) is a separate tool from the Playwright test framework and doesn't expose browser launch options like `ignoreHTTPSErrors`. Our `playwright.config.ts` has this configured for tests, but the MCP server cannot use it.

## Workaround Solution

Instead of using the Playwright MCP browser tools directly, GitHub Copilot Coding Agents can capture screenshots and interact with the application using the Playwright test framework via the `bash` tool.

### Method 1: Using the Screenshot Helper Test

We've created `e2e/screenshot-helper.spec.ts` which can be run to capture screenshots:

```bash
# Start the dev server (if not already running)
npm start &

# Capture screenshots using the helper test
CI='' npx playwright test e2e/screenshot-helper.spec.ts --project=mock-chromium

# View the screenshots
ls -lh screenshot-*.png
```

### Method 2: Using Playwright Codegen

For interactive debugging and screenshot capture:

```bash
# Start the dev server
npm start &

# Launch Playwright in headed mode with codegen
CI='' npx playwright codegen https://localhost:8080

# Or run existing tests in headed mode to see the UI
CI='' npx playwright test --headed --project=mock-chromium
```

### Method 3: Creating Custom Screenshot Tests

You can create custom test files in the `e2e/` directory following this pattern:

```typescript
import { test } from "@playwright/test";

test("capture specific state", async ({ page }) => {
  await page.goto("https://localhost:8080");
  
  // Interact with the page
  await page.waitForSelector("#app");
  
  // Take a screenshot
  await page.screenshot({
    path: "screenshot-custom.png",
    fullPage: true,
  });
});
```

Then run it with:
```bash
CI='' npx playwright test e2e/your-test.spec.ts --project=mock-chromium
```

## Why This Works

1. The Playwright test framework (used by `npx playwright test`) respects the `ignoreHTTPSErrors: true` setting in `playwright.config.ts`
2. The `CI=''` environment variable ensures `reuseExistingServer: true` is enabled (since `reuseExistingServer: !process.env["CI"]` in the config)
3. Tests can access `https://localhost:8080` without certificate errors

## Limitations

- Cannot use MCP browser tools (`playwright-browser_navigate`, `playwright-browser_snapshot`, etc.) directly
- Must use the `bash` tool to run Playwright tests
- Requires starting the dev server separately or relying on the webServer config
- Interactive browser debugging requires headed mode

## Future Improvements

If the Playwright MCP server adds support for `ignoreHTTPSErrors` or browser launch options, this workaround won't be necessary. You can track this by:

1. Checking the `@playwright/mcp` package for new versions with configuration options
2. Looking for command-line flags like `--ignore-https-errors` in the MCP server
3. Checking if the MCP server can read configuration from `playwright.config.ts`

## Examples

### Capture homepage screenshot
```bash
cd /home/runner/work/rad.io/rad.io
npm start > /tmp/server.log 2>&1 &
sleep 10
CI='' npx playwright test e2e/screenshot-helper.spec.ts::capture\ homepage\ screenshot --project=mock-chromium
```

### Capture after interaction
```bash
# Create a test that interacts with the UI then screenshots
# See e2e/screenshot-helper.spec.ts for examples
CI='' npx playwright test e2e/screenshot-helper.spec.ts --project=mock-chromium
```
