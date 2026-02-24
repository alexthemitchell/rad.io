import { expect, test } from '@playwright/test';

test('phase 1-3 smoke path renders core app controls', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'rad.io MVP Preview' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Mute|Unmute)$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export Diagnostics' })).toBeVisible();

  const sourceSelect = page.locator('.control-group select').first();
  await expect(sourceSelect).toBeVisible();

  const sourceOptions = sourceSelect.locator('option');
  await expect(sourceOptions).toHaveCount(4);
  await expect(sourceOptions.nth(0)).toHaveText('Mock Source');
  await expect(sourceOptions.nth(1)).toHaveText('File Fixture (SigMF)');
  await expect(sourceOptions.nth(2)).toHaveText('HackRF One');
  await expect(sourceOptions.nth(3)).toHaveText('RTL-SDR (Exp)');

  await expect(page.locator('.status-pill')).toContainText('Connection:');
  await expect(page.locator('.status-text[aria-live="polite"]')).toBeVisible();
});
