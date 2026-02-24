import { expect, test, type Page } from '@playwright/test';

const frequencyInputSelector = '.control-group:has(label:has-text("Frequency (MHz)")) input[type="number"]';
const tuneStepSelectSelector = '.control-group:has(label:has-text("Tune Step")) select';
const fineStepSelectSelector = '.control-group:has(label:has-text("Fine Step")) select';
const fineTuneLabelSelector = '.control-group:has(label:has-text("Fine Tune (")) .control-label';

const readFrequencyHz = async (page: Page): Promise<number> => {
  const mhzText = await page.locator(frequencyInputSelector).inputValue();
  return Math.round(parseFloat(mhzText) * 1_000_000);
};

test('phase 4 keyboard tuning honors base, large, and fine step sizes', async ({ page }) => {
  await page.goto('/');

  await page.locator(tuneStepSelectSelector).selectOption('1000');
  await page.locator(fineStepSelectSelector).selectOption('1000');

  const initialHz = await readFrequencyHz(page);

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.status-text[aria-live="polite"]')).toContainText('Tune step +1,000 Hz.');
  await expect.poll(async () => readFrequencyHz(page)).toBe(initialHz + 1_000);

  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('.status-text[aria-live="polite"]')).toContainText('Large tune step +10,000 Hz.');
  await expect.poll(async () => readFrequencyHz(page)).toBe(initialHz + 11_000);

  await page.keyboard.press('Alt+ArrowLeft');
  await expect(page.locator('.status-text[aria-live="polite"]')).toContainText('Fine tune step -100 Hz.');
  await expect(page.locator(fineTuneLabelSelector)).toContainText('Fine Tune (-100 Hz)');
});

test('phase 4 keyboard tuning is guarded while typing in inputs', async ({ page }) => {
  await page.goto('/');

  await page.locator(tuneStepSelectSelector).selectOption('1000');
  const initialHz = await readFrequencyHz(page);

  const frequencyInput = page.locator(frequencyInputSelector);
  await frequencyInput.click();
  await page.keyboard.press('ArrowRight');

  await expect.poll(async () => readFrequencyHz(page)).toBe(initialHz);
});
