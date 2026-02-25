import { expect, test, type Page } from '@playwright/test';

const frequencyInputSelector = '.control-group:has(label:has-text("Display Frequency (MHz)")) input';

const readDisplayFrequencyHz = async (page: Page): Promise<number> => {
  const mhzText = await page.locator(frequencyInputSelector).inputValue();
  return Math.round(parseFloat(mhzText) * 1_000_000);
};

test('phase 4 interaction supports history A/B recall', async ({ page }) => {
  await page.goto('/');

  const initialHz = await readDisplayFrequencyHz(page);
  await page.getByRole('button', { name: 'Store A' }).click();

  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => readDisplayFrequencyHz(page)).not.toBe(initialHz);

  await page.getByRole('button', { name: 'Recall A' }).click();
  await expect.poll(async () => readDisplayFrequencyHz(page)).toBe(initialHz);
});

test('phase 4 interaction applies band raster snapping', async ({ page }) => {
  await page.goto('/');

  const bandCard = page.locator('.control-group.control-group-wide:has-text("Band Plans & Stepping")');
  await bandCard.locator('.control-group:has(label:has-text("Band")) select').selectOption('airband');
  await page.locator(frequencyInputSelector).fill('121.513');
  await page.locator(frequencyInputSelector).press('Enter');
  await bandCard.getByRole('button', { name: 'Snap Now' }).click();

  await expect.poll(async () => readDisplayFrequencyHz(page)).toBe(121_525_000);
});

test('phase 4 interaction exposes transverter mapping summary', async ({ page }) => {
  await page.goto('/');

  const mappingCard = page.locator('.control-group.control-group-wide:has-text("Frequency Mapping / Transverter")');
  await expect(mappingCard).toContainText('Transverter off');

  await mappingCard.locator('input[type="checkbox"]').first().check();
  await expect(mappingCard).toContainText('Transverter up 125,000,000 Hz');
});
