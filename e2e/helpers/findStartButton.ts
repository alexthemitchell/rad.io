import type { Page, Locator } from "@playwright/test";

/**
 * Helper function to find the Start Reception button
 * Tries multiple selectors to handle different states
 */
export async function findStartButton(page: Page): Promise<Locator | null> {
  const selectors = [
    'button[aria-label*="Start receiving" i]',
    'button:has-text("Start Reception")',
    'button:has-text("Start receiving")',
    'button[aria-label*="Start reception" i]',
    'button[title*="Start reception" i]',
  ];
  for (const s of selectors) {
    const loc = page.locator(s).first();
    try {
      if ((await loc.count()) > 0) {
        return loc;
      }
    } catch {
      // ignore malformed selectors or unsupported features
    }
  }
  return null;
}
