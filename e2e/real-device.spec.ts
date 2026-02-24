import { expect, test } from '@playwright/test';

const realDeviceEnabled = process.env.RAD_REAL_DEVICE === '1';

test.describe('@real-device', () => {
  test.skip(!realDeviceEnabled, 'Set RAD_REAL_DEVICE=1 to enable real-device checks.');

  test('real device source options are available before connect', async ({ page }) => {
    await page.goto('/');

    const sourceSelect = page.locator('.control-group select').first();
    await sourceSelect.selectOption('HACKRF');
    await expect(sourceSelect).toHaveValue('HACKRF');

    await sourceSelect.selectOption('RTLSDR');
    await expect(sourceSelect).toHaveValue('RTLSDR');

    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  });
});
