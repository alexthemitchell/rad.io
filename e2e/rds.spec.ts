import { expect, test } from '@playwright/test'

test('decodes the synthetic FM+RDS station and renders its metadata', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText('DSP online')).toBeVisible()

  await page.getByRole('button', { name: 'FM + RDS' }).click()
  await expect(page.getByText('3CE7 / Information')).toBeVisible()
  await page.getByRole('button', { name: 'Start generation' }).click()

  await expect(page.locator('.signal-rds-name')).toHaveText('RAD.IO', {
    timeout: 15_000,
  })
  const station = page.getByRole('region', { name: 'RBDS station data' })
  await expect(station).toContainText('Synchronized')
  await expect(station).toContainText('0x3CE7')
  await expect(station).toContainText('KRAD')
  await expect(station).toContainText('PUBLIC')
  await expect(station).toContainText('RAD.IO synthetic RBDS test station')

  await page.getByRole('button', { name: 'Pause generation' }).click()
  await page.getByRole('button', { name: 'Start generation' }).click()
  await page.waitForTimeout(750)
  const decoderStatus = station.getByRole('status')
  await expect(decoderStatus).not.toHaveText('Unavailable')
  await expect(decoderStatus).toHaveText('Synchronized', { timeout: 15_000 })

  await page.getByRole('button', { name: 'Reset generator' }).click()
  await expect(page.locator('.signal-rds-name')).toHaveCount(0)
})