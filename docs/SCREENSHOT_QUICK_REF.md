# Quick Reference: Screenshot Capture for GitHub Copilot Agents

## TL;DR

The Playwright MCP browser tools don't work with `https://localhost:8080` due to TLS certificate errors. Use this instead:

```bash
npm run screenshot
```

This will capture 5 screenshots showing different aspects of the app.

## Why?

- Playwright MCP server (`@playwright/mcp@0.0.40`) doesn't support `ignoreHTTPSErrors`
- Our dev server uses a self-signed certificate for HTTPS
- The Playwright test framework (via `playwright.config.ts`) has `ignoreHTTPSErrors: true`

## Solution

Use the `bash` tool with Playwright tests instead of MCP browser tools:

### Option 1: Use the npm script (easiest)

```bash
npm run screenshot
```

### Option 2: Run the helper test directly

```bash
CI='' npx playwright test e2e/screenshot-helper.spec.ts --project=mock-chromium
```

### Option 3: Create a custom test

Create a new file in `e2e/` directory with your custom screenshot logic:

```typescript
import { test } from "@playwright/test";

test.use({ ignoreHTTPSErrors: true });

test("my custom screenshot", async ({ page }) => {
  await page.goto("https://localhost:8080/monitor?mockSdr=1");
  await page.waitForSelector("#app");
  
  // Your interactions here...
  
  await page.screenshot({ 
    path: "my-screenshot.png",
    fullPage: true 
  });
});
```

Then run:

```bash
CI='' npx playwright test e2e/your-test.spec.ts --project=mock-chromium
```

## Available Screenshots

The `screenshot-helper.spec.ts` test captures:

1. **screenshot-homepage.png** - Initial homepage load
2. **screenshot-app-loaded.png** - App after 2s of loading
3. **screenshot-monitor-mock.png** - Monitor page with mock SDR
4. **screenshot-app-element.png** - Just the #app element
5. **screenshot-viewport.png** - Viewport only (not full page)

## Important Notes

- Screenshots are saved to the repository root (excluded via `.gitignore`)
- `CI=''` ensures `reuseExistingServer: true` is enabled
- The dev server must be running (test will start it if not)
- All screenshots use the `mock-chromium` project which has `ignoreHTTPSErrors: true`

## For More Details

See `docs/PLAYWRIGHT_TLS_WORKAROUND.md` for comprehensive documentation.
