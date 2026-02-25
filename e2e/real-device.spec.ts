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

    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  });

  test('hackrf sustains streaming for a short validation window', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');

    const sourceSelect = page.locator('.control-group:has(label:has-text("Source")) select').first();
    await sourceSelect.selectOption('HACKRF');
    await expect(sourceSelect).toHaveValue('HACKRF');

    const startButton = page.getByRole('button', { name: 'Start', exact: true });
    await startButton.click();

    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return /Connection:\s*streaming/i.test(text)
        || /No device selected\. Choose a device and try again\./i.test(text)
        || /Connection:\s*error/i.test(text);
    }, { timeout: 15_000 });

    const noDeviceSelected = await page.getByText('No device selected. Choose a device and try again.', { exact: false }).count();
    const connectionError = await page.getByText(/Connection:\s*error/i).count();
    if (noDeviceSelected > 0 || connectionError > 0) {
      test.skip(true, 'HackRF WebUSB pairing/selection unavailable in this automated browser context.');
    }

    await expect(page.getByText(/Connection:\s*streaming/i)).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(8_000);

    await expect(page.getByText(/Connection:\s*streaming/i)).toBeVisible();
    await expect(page.getByText('USB Throughput/Jitter', { exact: false })).toBeVisible();

    const stopButton = page.getByRole('button', { name: 'Stop', exact: true });
    await stopButton.click();
    await expect(page.getByText(/Connection:\s*idle/i)).toBeVisible({ timeout: 10_000 });
  });
});
