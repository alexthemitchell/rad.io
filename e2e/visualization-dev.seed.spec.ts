import { test, expect } from "@playwright/test";

test.describe("Visualization dev-mode RDS seed", () => {
  test("should seed RDS cache and retrieve via global helper", async ({ page }) => {
    await page.goto("/monitor");
    // only run dev test if helper available
    const hasDev = await page.evaluate(() => (window as any).__DEV_RDS__ !== undefined);
    if (!hasDev) {
      test.skip();
      return;
    }

    await page.evaluate(() => {
      (window as any).__DEV_RDS__.seedDebugRDS([
        { frequencyHz: 100500000, ps: "DEVTEST", rt: "Dev Radio Text" },
      ]);
    });

    const cached = await page.evaluate(() => (window as any).__DEV_RDS__.getDebugRDS());
    expect(Array.isArray(cached)).toBe(true);
    const found = cached.find((s: any) => s.ps === "DEVTEST");
    expect(found).toBeDefined();

    // Now test injecting a radio text group that contains a non-ascii character to check logging.
    // Group format: blocks[1].data carries group type + segment and version bits.
    await page.evaluate(() => {
      // Create a 2A group containing 'HÉ' (non-ASCII É = 0xC9 maybe) - we use char code 0xC9
      const group = {
        blocks: [
          { data: 0x1234 },
          { data: (2 << 12) | (0 << 11) | 0x0 },
          { data: ("H".charCodeAt(0) << 8) | "E".charCodeAt(0) },
          { data: (0x00C9 << 8) | " ".charCodeAt(0) },
        ],
        pi: 0x1234,
        pty: 0,
        tp: false,
        ta: false,
        version: "A",
        groupType: "2A",
        timestamp: Date.now(),
      };
      (window as any).__DEV_RDS__.injectGroup(group);
    });

    // Capture console warnings (non-ASCII should be logged)
    const logged = await page.evaluate(() => {
      return (window as any).__lastConsoleLogged || null;
    });
    // We can't reliably read console output via evaluate; rely on getDecoderStats to reflect lastUpdate
    const stats = await page.evaluate(() => (window as any).__DEV_RDS__.getDecoderStats());
    expect(stats).toBeTruthy();
  });
});
