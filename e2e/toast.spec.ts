import { test, expect } from "@playwright/test";

test.describe("Toasts", () => {
  test("visual toast renders and is hidden from SR when sr provided", async ({
    page,
  }) => {
    await page.goto("/");

    await page.evaluate(() => {
      // @ts-expect-error - test hook populated in non-production builds
      window.radNotify?.({
        message: "Saved",
        tone: "success",
        sr: "polite",
        visual: true,
        duration: 5000,
      });
    });

    const toast = page.locator(".toast").first();
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute("aria-hidden", "true");
  });

  test("toast is exposed to SR when sr=false (role=status)", async ({
    page,
  }) => {
    await page.goto("/");

    await page.evaluate(() => {
      // @ts-expect-error - test hook populated in non-production builds
      window.radNotify?.({
        message: "Connected",
        tone: "info",
        sr: false,
        visual: true,
        duration: 3000,
      });
    });

    const toast = page.locator(".toast").first();
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute("role", "status");
  });

  test("toast can be dismissed", async ({ page }) => {
    await page.goto("/");

    await page.evaluate(() => {
      // @ts-expect-error - test hook populated in non-production builds
      window.radNotify?.({
        message: "Dismiss me",
        tone: "info",
        sr: false,
        visual: true,
        duration: 10000,
      });
    });

    const toast = page.locator(".toast").first();
    const dismiss = toast.getByRole("button", { name: /dismiss/i });
    await expect(toast).toBeVisible();
    await dismiss.click();
    await expect(toast).toHaveCount(0);
  });
});
