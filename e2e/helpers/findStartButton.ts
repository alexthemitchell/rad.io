import type { Page, Locator } from "@playwright/test";

/**
 * Helper function to find the Start Reception button
 * Tries multiple selectors to handle different states
 */
export async function findStartButton(page: Page): Promise<Locator> {
  // Try primary selector first
  let startBtn = page.getByRole("button", { name: "Start Reception" });
  if ((await startBtn.count()) > 0) {
    return startBtn;
  }

  // Fallback selectors
  startBtn = page.getByText("Start Reception");
  if ((await startBtn.count()) > 0) {
    return startBtn;
  }

  startBtn = page.locator('button:has-text("Start")');
  return startBtn;
}
