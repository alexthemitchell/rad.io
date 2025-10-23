# E2E Accessibility Testing Guide

This document describes how to perform end-to-end accessibility testing for rad.io using Playwright and axe-core.

## Overview

While unit tests with jest-axe cover component-level accessibility, E2E tests verify accessibility in the complete, running application. This includes:

- Navigation flow between pages
- Keyboard-only workflows
- Screen reader announcements in context
- Focus management across page transitions
- Real-world interaction patterns

## Setup

### Prerequisites

1. **Development server running**: The app must be running at `https://localhost:8080`
2. **Playwright installed**: `@axe-core/playwright` is already in devDependencies
3. **Browser**: Chromium-based browser (Chrome, Edge, Opera)

### Installation

Dependencies are already installed:

```bash
# Already in package.json
"@axe-core/playwright": "^4.x.x"
```

## Running E2E Accessibility Tests

### Option 1: Playwright MCP Browser Tools

The project includes Playwright MCP for interactive browser testing:

```bash
# Start dev server
npm start

# In another terminal or using MCP tools:
# Navigate to app
browser_navigate({ url: "https://localhost:8080" })

# Wait for app to load
browser_wait_for({ text: "Software-Defined Radio Visualizer" })

# Take accessibility snapshot
browser_snapshot()

# Take screenshot for visual verification
browser_take_screenshot({
  filename: "accessibility-test.png",
  fullPage: true
})
```

### Option 2: Automated Playwright Tests

Create E2E test files in `e2e/` directory:

```typescript
// e2e/accessibility.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility E2E Tests", () => {
  test("home page should have no accessibility violations", async ({
    page,
  }) => {
    await page.goto("https://localhost:8080");
    await page.waitForSelector('h1:has-text("rad.io")');

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("keyboard navigation through main controls", async ({ page }) => {
    await page.goto("https://localhost:8080");

    // Press Tab to navigate
    await page.keyboard.press("Tab"); // Skip link
    await page.keyboard.press("Tab"); // Connect button

    // Verify focus is visible
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });

    expect(focusedElement).toBe("BUTTON");
  });

  test("frequency input keyboard controls", async ({ page }) => {
    await page.goto("https://localhost:8080");

    // Navigate to frequency input
    const freqInput = await page.locator(
      'input[aria-label*="Center frequency"]',
    );
    await freqInput.focus();

    // Test arrow key navigation
    await page.keyboard.press("ArrowUp");

    // Verify frequency increased
    const value = await freqInput.inputValue();
    expect(parseFloat(value)).toBeGreaterThan(100);
  });

  test("all pages should be accessible", async ({ page }) => {
    const pages = ["/", "/scanner", "/analysis"];

    for (const path of pages) {
      await page.goto(`https://localhost:8080${path}`);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });
});
```

Run with:

```bash
# Install Playwright browsers (one-time setup)
npx playwright install chromium

# Run E2E tests
npx playwright test e2e/accessibility.spec.ts

# Run with UI
npx playwright test e2e/accessibility.spec.ts --ui

# Generate HTML report
npx playwright test --reporter=html
```

## Manual Testing Workflows

### Keyboard-Only Navigation Test

1. **Start the app**: Open `https://localhost:8080`
2. **Hide your mouse**: Cover it or unplug it
3. **Navigate using keyboard only**:
   - Press Tab to move through elements
   - Verify focus is always visible
   - Press Enter/Space to activate buttons
   - Use arrow keys in frequency input
   - Test Page Up/Down for coarse tuning
   - Press Escape to close modals (if any)
4. **Document any issues**: Note any unreachable elements or unclear focus

### Screen Reader Test

**With NVDA (Windows)**:

1. Install NVDA from https://www.nvaccess.org/
2. Start NVDA (Ctrl+Alt+N)
3. Open rad.io
4. Navigate with Tab, hear each element announced
5. Verify:
   - All controls have meaningful names
   - State changes are announced
   - Data visualizations describe their content
   - Error messages are read aloud

**With VoiceOver (macOS)**:

1. Enable VoiceOver (Cmd+F5)
2. Open rad.io
3. Use VoiceOver cursor (Ctrl+Option+Arrow keys)
4. Verify same points as NVDA

### Color Contrast Test

1. **Use browser DevTools**:
   - Chrome: DevTools > Elements > Accessibility pane
   - Shows contrast ratio for each text element
   - Must be 4.5:1 for normal text, 3:1 for large text

2. **Use axe DevTools extension**:
   - Install from Chrome Web Store
   - Open DevTools > axe DevTools tab
   - Click "Scan ALL of my page"
   - Review color contrast violations

### Zoom Test

1. Open rad.io at 100% zoom
2. Zoom to 200% (Ctrl/Cmd + Plus)
3. Verify:
   - No horizontal scrolling required
   - All text readable
   - All controls accessible
   - Layout doesn't break or overlap
   - Canvas visualizations scale appropriately

## Common E2E Test Patterns

### Testing Focus Management

```typescript
test("focus moves to modal on open", async ({ page }) => {
  await page.goto("https://localhost:8080");

  // Open modal
  await page.click('button:has-text("Settings")');

  // Verify focus moved into modal
  const focusedElement = await page.evaluate(() => {
    return document.activeElement?.getAttribute("role");
  });

  expect(focusedElement).toBe("dialog");
});
```

### Testing Live Regions

```typescript
test("status changes are announced", async ({ page }) => {
  await page.goto("https://localhost:8080");

  // Get live region
  const liveRegion = await page.locator('[aria-live="polite"]');

  // Trigger action
  await page.click('button:has-text("Connect Device")');

  // Wait for announcement
  await page.waitForFunction(
    (element) => element.textContent?.includes("Connecting"),
    await liveRegion.elementHandle(),
  );

  const announcement = await liveRegion.textContent();
  expect(announcement).toContain("Connecting to SDR device");
});
```

### Testing Keyboard Shortcuts

```typescript
test("arrow keys adjust frequency", async ({ page }) => {
  await page.goto("https://localhost:8080");

  const freqInput = await page.locator('input[aria-label*="frequency"]');
  await freqInput.focus();

  const initialValue = parseFloat(await freqInput.inputValue());

  // Press arrow up
  await page.keyboard.press("ArrowUp");

  const newValue = parseFloat(await freqInput.inputValue());
  expect(newValue).toBeGreaterThan(initialValue);
});
```

## Accessibility Testing Checklist

Before releasing:

- [ ] All pages pass automated axe-core scans
- [ ] Keyboard navigation works on all pages
- [ ] All interactive elements are focusable
- [ ] Focus indicators are visible
- [ ] Skip links work correctly
- [ ] Live regions announce updates
- [ ] Color contrast meets WCAG AA
- [ ] Works at 200% browser zoom
- [ ] Screen reader testing completed
- [ ] No keyboard traps exist

## CI/CD Integration

To run E2E accessibility tests in CI:

```yaml
# .github/workflows/e2e-accessibility.yml
name: E2E Accessibility Tests

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Start dev server
        run: npm start &
        env:
          CI: true

      - name: Wait for server
        run: npx wait-on https://localhost:8080

      - name: Run E2E accessibility tests
        run: npx playwright test e2e/accessibility.spec.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Resources

- **@axe-core/playwright**: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
- **Playwright Testing**: https://playwright.dev/
- **WCAG 2.1 Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
- **Project Accessibility Docs**: [../ACCESSIBILITY.md](../ACCESSIBILITY.md)

## Troubleshooting

### Certificate Errors with HTTPS

If you get certificate errors:

```bash
# Option 1: Accept self-signed cert in Playwright
browser.newContext({ ignoreHTTPSErrors: true })

# Option 2: Use HTTP for testing (not recommended)
# Modify webpack.config.js devServer.server to "http"
```

### Flaky Tests

If tests are flaky:

```typescript
// Use waitForLoadState
await page.waitForLoadState("networkidle");

// Use explicit waits
await page.waitForSelector("selector", { state: "visible" });

// Increase timeout for slow operations
test.setTimeout(60000);
```

### Recording Test Failures

```bash
# Run with trace
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

## Next Steps

1. Create `e2e/` directory structure
2. Add Playwright configuration file
3. Write accessibility test specs
4. Integrate with CI/CD pipeline
5. Document findings and fixes
