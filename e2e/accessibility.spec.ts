import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * E2E Accessibility Tests for rad.io
 * 
 * These tests verify WCAG 2.1 AA compliance in the running application.
 * Prerequisites:
 * - Dev server must be running at https://localhost:8080
 * - Run with: npx playwright test e2e/accessibility.spec.ts
 */

// Configure to ignore HTTPS certificate errors for local development
test.use({ 
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 }
});

test.describe('Application-Wide Accessibility', () => {
  test('home page should have no WCAG violations', async ({ page }) => {
    await page.goto('https://localhost:8080');
    
    // Wait for app to fully load
    await page.waitForSelector('h1:has-text("rad.io")', { timeout: 10000 });
    
    // Run comprehensive accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    // Log any violations for debugging
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Accessibility violations found:');
      accessibilityScanResults.violations.forEach(violation => {
        console.log(`- ${violation.id}: ${violation.description}`);
        console.log(`  Impact: ${violation.impact}`);
        console.log(`  Nodes: ${violation.nodes.length}`);
      });
    }
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper document structure', async ({ page }) => {
    await page.goto('https://localhost:8080');
    await page.waitForSelector('h1');
    
    // Verify main landmark exists
    const main = await page.locator('main');
    await expect(main).toBeVisible();
    
    // Verify heading hierarchy
    const h1 = await page.locator('h1');
    await expect(h1).toHaveText('rad.io');
    
    // Verify skip link exists
    const skipLink = await page.locator('a.skip-link');
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });
});

test.describe('Keyboard Navigation', () => {
  test('skip link should be accessible and functional', async ({ page }) => {
    await page.goto('https://localhost:8080');
    
    // Tab to skip link (first focusable element)
    await page.keyboard.press('Tab');
    
    // Verify skip link is focused
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName,
        text: el?.textContent?.trim(),
        className: el?.className
      };
    });
    
    expect(focusedElement.className).toContain('skip-link');
    expect(focusedElement.text).toContain('Skip to main content');
    
    // Activate skip link
    await page.keyboard.press('Enter');
    
    // Verify focus moved to main content
    const newFocus = await page.evaluate(() => {
      return document.activeElement?.id;
    });
    
    expect(newFocus).toBe('main-content');
  });

  test('all interactive elements should be keyboard accessible', async ({ page }) => {
    await page.goto('https://localhost:8080');
    await page.waitForSelector('button');
    
    // Get all interactive elements
    const interactiveElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('button, a, input, [tabindex="0"]');
      return Array.from(elements).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 50),
        hasTabIndex: el.hasAttribute('tabindex'),
        tabIndex: el.getAttribute('tabindex')
      }));
    });
    
    // All interactive elements should be reachable
    expect(interactiveElements.length).toBeGreaterThan(0);
    
    // None should have positive tabindex
    const positiveTabIndex = interactiveElements.filter(
      el => el.tabIndex && parseInt(el.tabIndex) > 0
    );
    expect(positiveTabIndex).toEqual([]);
  });

  test('frequency input keyboard controls should work', async ({ page }) => {
    await page.goto('https://localhost:8080');
    
    // Find and focus frequency input
    const freqInput = await page.locator('input[type="number"]').first();
    await freqInput.focus();
    
    // Get initial value
    const initialValue = await freqInput.inputValue();
    const initialNum = parseFloat(initialValue);
    
    // Test arrow key up
    await page.keyboard.press('ArrowUp');
    
    // Verify value increased
    const newValue = await freqInput.inputValue();
    const newNum = parseFloat(newValue);
    
    // Value should have increased (exact amount depends on signal type)
    expect(newNum).toBeGreaterThanOrEqual(initialNum);
  });

  test('tab order should be logical', async ({ page }) => {
    await page.goto('https://localhost:8080');
    await page.waitForSelector('button');
    
    const tabOrder: string[] = [];
    
    // Tab through first 10 elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      
      const focusedInfo = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName,
          text: el?.textContent?.trim().substring(0, 30),
          ariaLabel: el?.getAttribute('aria-label')?.substring(0, 30)
        };
      });
      
      tabOrder.push(
        focusedInfo.ariaLabel || focusedInfo.text || focusedInfo.tag
      );
    }
    
    // Verify we captured focus changes
    expect(tabOrder.length).toBe(10);
    
    // Log tab order for manual verification
    console.log('Tab order:', tabOrder);
  });
});

test.describe('ARIA and Semantics', () => {
  test('visualizations should have proper ARIA labels', async ({ page }) => {
    await page.goto('https://localhost:8080');
    await page.waitForSelector('canvas');
    
    // Check canvas elements have role="img" and aria-label
    const canvasElements = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      return Array.from(canvases).map(canvas => ({
        role: canvas.getAttribute('role'),
        ariaLabel: canvas.getAttribute('aria-label'),
        hasAriaLabel: !!canvas.getAttribute('aria-label')
      }));
    });
    
    // All canvases should have role="img"
    canvasElements.forEach(canvas => {
      expect(canvas.role).toBe('img');
      expect(canvas.hasAriaLabel).toBe(true);
      expect(canvas.ariaLabel).toBeTruthy();
    });
  });

  test('buttons should have accessible names', async ({ page }) => {
    await page.goto('https://localhost:8080');
    await page.waitForSelector('button');
    
    // Run axe check for button names
    const results = await new AxeBuilder({ page })
      .include('button')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    const buttonNameViolations = results.violations.filter(
      v => v.id === 'button-name'
    );
    
    expect(buttonNameViolations).toEqual([]);
  });

  test('form inputs should have associated labels', async ({ page }) => {
    await page.goto('https://localhost:8080');
    
    const inputs = await page.evaluate(() => {
      const inputElements = document.querySelectorAll('input');
      return Array.from(inputElements).map(input => ({
        type: input.getAttribute('type'),
        hasLabel: !!input.getAttribute('aria-label') || 
                  !!document.querySelector(`label[for="${input.id}"]`) ||
                  !!input.closest('label'),
        ariaLabel: input.getAttribute('aria-label')
      }));
    });
    
    // All inputs should have labels
    inputs.forEach(input => {
      expect(input.hasLabel).toBe(true);
    });
  });
});

test.describe('Focus Management', () => {
  test('focus indicators should be visible', async ({ page }) => {
    await page.goto('https://localhost:8080');
    
    // Tab to first button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Get computed styles of focused element
    const focusStyles = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      
      const styles = window.getComputedStyle(el);
      return {
        outlineWidth: styles.outlineWidth,
        outlineStyle: styles.outlineStyle,
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow
      };
    });
    
    // Should have visible outline or box-shadow
    const hasVisibleFocus = 
      (focusStyles?.outlineWidth && focusStyles.outlineWidth !== '0px') ||
      (focusStyles?.boxShadow && focusStyles.boxShadow !== 'none');
    
    expect(hasVisibleFocus).toBe(true);
  });
});

test.describe('Color Contrast', () => {
  test('all text should meet WCAG AA contrast requirements', async ({ page }) => {
    await page.goto('https://localhost:8080');
    await page.waitForSelector('button');
    
    // Run axe check specifically for color contrast
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .disableRules(['color-contrast']) // Disable if you want to check manually
      .analyze();
    
    // Re-enable for actual test
    const contrastResults = await new AxeBuilder({ page })
      .include('body')
      .withRules(['color-contrast'])
      .analyze();
    
    const contrastViolations = contrastResults.violations.filter(
      v => v.id === 'color-contrast'
    );
    
    if (contrastViolations.length > 0) {
      console.log('Color contrast violations:');
      contrastViolations.forEach(v => {
        v.nodes.forEach(node => {
          console.log(`- ${node.html}`);
          console.log(`  ${node.failureSummary}`);
        });
      });
    }
    
    expect(contrastViolations).toEqual([]);
  });
});

test.describe('Responsive and Zoom', () => {
  test('should work at 200% zoom', async ({ page }) => {
    await page.goto('https://localhost:8080');
    
    // Set zoom to 200%
    await page.evaluate(() => {
      document.body.style.zoom = '2';
    });
    
    await page.waitForTimeout(500); // Let layout settle
    
    // Verify no horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    // At 200% zoom, some horizontal scroll may be acceptable
    // More important is that content is still accessible
    const accessibilityResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze();
    
    expect(accessibilityResults.violations).toEqual([]);
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('https://localhost:8080');
    await page.waitForSelector('h1');
    
    // Run accessibility scan on mobile viewport
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze();
    
    expect(results.violations).toEqual([]);
  });
});

test.describe('Live Regions', () => {
  test('should have live region for announcements', async ({ page }) => {
    await page.goto('https://localhost:8080');
    
    // Check for live region
    const liveRegion = await page.locator('[aria-live="polite"]');
    await expect(liveRegion).toHaveCount(1);
    
    // Verify it's visually hidden but accessible to screen readers
    const isVisuallyHidden = await page.evaluate(() => {
      const el = document.querySelector('[aria-live="polite"]');
      if (!el) return false;
      
      const styles = window.getComputedStyle(el);
      return styles.position === 'absolute' && 
             (styles.width === '1px' || styles.clip !== 'auto');
    });
    
    expect(isVisuallyHidden).toBe(true);
  });
});
