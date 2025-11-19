# Playwright MCP TLS Certificate Issue & Workaround

## Problem Summary

The Playwright MCP server (`@playwright/mcp@0.0.40`) cannot access `https://localhost:8080` due to self-signed TLS certificate errors. The MCP browser tools (`playwright-browser_navigate`, `playwright-browser_take_screenshot`, etc.) fail with `ERR_CERT_AUTHORITY_INVALID`.

## Root Cause

The Playwright MCP server is a separate tool from the Playwright test framework and does not expose browser launch options like `ignoreHTTPSErrors`. While `playwright.config.ts` has `ignoreHTTPSErrors: true` configured for tests, the MCP server cannot use this configuration.

## Workaround Solution

Use the Playwright test framework via the `bash` tool instead of MCP browser tools:

### Quick Method
```bash
npm run screenshot
```

### Direct Method
```bash
CI='' npx playwright test e2e/screenshot-helper.spec.ts --project=mock-chromium
```

### Why It Works
- Playwright test framework respects `ignoreHTTPSErrors: true` in `playwright.config.ts`
- `CI=''` enables `reuseExistingServer: true` (per config: `reuseExistingServer: !process.env["CI"]`)
- Tests can access self-signed HTTPS endpoints

## Key Files

- **`e2e/screenshot-helper.spec.ts`** - Helper test with 5 screenshot scenarios
- **`docs/PLAYWRIGHT_TLS_WORKAROUND.md`** - Comprehensive documentation
- **`docs/SCREENSHOT_QUICK_REF.md`** - Quick reference for agents
- **`.github/copilot-instructions.md`** - Updated with workaround guidance

## Screenshot Capabilities

The helper test captures:
1. Homepage screenshot
2. App loaded state (after 2s delay)
3. Monitor page with mock SDR
4. Specific element screenshot (#app element only)
5. Viewport screenshot (non-full-page)

## Important Notes

- Screenshots saved to repo root (excluded via `.gitignore` pattern `screenshot-*.png`)
- Always use `mock-chromium` project which has `ignoreHTTPSErrors: true`
- Dev server must be running (webServer config will auto-start if needed)
- For custom tests, always include `test.use({ ignoreHTTPSErrors: true })`

## Future Monitoring

Check for updates to `@playwright/mcp` that might add:
- `--ignore-https-errors` command-line flag
- Configuration file support (reading from `playwright.config.ts`)
- Browser launch options API

## Related Issues

- Playwright MCP server version: 0.0.40
- rad.io uses webpack-dev-server with self-signed certificate
- Certificate path: `node_modules/.cache/webpack-dev-server/server.pem`
