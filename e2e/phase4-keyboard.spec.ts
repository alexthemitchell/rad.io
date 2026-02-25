import { expect, test, type Page } from '@playwright/test';

const frequencyInputSelector = '.control-group:has(label:has-text("Display Frequency (MHz)")) input';
const tuneStepSelectSelector = '.control-group:has(label:has-text("Tune Step")) select';
const fineStepSelectSelector = '.control-group:has(label:has-text("Fine Step")) select';
const fineTuneLabelSelector = '.control-group:has(label:has-text("Fine Tune (")) .control-label';
const diagnosticsLogSelector = 'details.diagnostics-log';

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

test('phase 4 keyboard frequency entry supports focus, commit, and cancel', async ({ page }) => {
  await page.goto('/');

  const initialHz = await readFrequencyHz(page);
  const initialMhz = (initialHz / 1_000_000).toFixed(3);
  const nextMhz = ((initialHz + 200_000) / 1_000_000).toFixed(3);

  await page.keyboard.press('Control+L');
  await expect(page.locator(frequencyInputSelector)).toBeFocused();

  await page.locator(frequencyInputSelector).fill(nextMhz);
  await page.locator(frequencyInputSelector).press('Escape');
  await expect(page.locator(frequencyInputSelector)).toHaveValue(initialMhz);
  await expect.poll(async () => readFrequencyHz(page)).toBe(initialHz);

  await page.keyboard.press('Control+L');
  await page.locator(frequencyInputSelector).fill(nextMhz);
  await page.locator(frequencyInputSelector).press('Enter');
  await expect.poll(async () => readFrequencyHz(page)).toBe(initialHz + 200_000);
});

test('phase 4 keyboard help and diagnostics entrypoints remain accessible', async ({ page }) => {
  await page.goto('/');

  const diagnosticsLog = page.locator(diagnosticsLogSelector);
  await expect(diagnosticsLog).not.toHaveAttribute('open', '');

  await page.keyboard.press('Control+/');
  await expect(diagnosticsLog).toHaveAttribute('open', '');

  await page.keyboard.press('F1');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts help' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts help' })).toBeHidden();

  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts help' })).toBeVisible();
});
