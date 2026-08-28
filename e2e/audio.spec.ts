import { expect, test } from '@playwright/test'

const GENERATED_AUDIO_MODES = [
  { button: 'FM + RDS', mode: 'WBFM' },
  { button: 'AM', mode: 'AM' },
  { button: 'NBFM', mode: 'NBFM' },
] as const

for (const preset of GENERATED_AUDIO_MODES) {
  test(`plays ${preset.mode} through the VFO AudioWorklet`, async ({ page }, testInfo) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto('./')
    await expect(page.getByText('DSP online')).toBeVisible()

    await page.getByRole('button', { name: preset.button, exact: true }).click()
    await page.getByRole('button', { name: 'Add VFO' }).click()
    await expect(page.getByRole('combobox', { name: 'Mode' })).toHaveValue(
      preset.mode.toLowerCase(),
    )
    await page.getByRole('button', { name: 'Start audio playback' }).click()
    await expect(page.locator('.vfo-footer')).toContainText(/Hz audio output/)
    await page.getByRole('button', { name: 'Start generation' }).click()

    await expect(page.locator('.vfo-state-copy')).toHaveText('playing', {
      timeout: 15_000,
    })
    await page.waitForTimeout(1_500)
    await expect(page.locator('.vfo-footer')).toContainText('0 underruns')
    await page.getByRole('button', { name: `Mute VFO 1` }).click()
    await expect(page.getByRole('button', { name: 'Unmute VFO 1' })).toBeVisible()
    await page.getByRole('button', { name: 'Pause audio playback' }).click()
    await expect(page.locator('.vfo-footer')).toContainText('Audio paused')
    if (preset.mode === 'WBFM') {
      const screenshotPath = testInfo.outputPath('multi-vfo-desktop.png')
      await page.screenshot({ path: screenshotPath, fullPage: true })
      await testInfo.attach('multi-vfo-desktop', {
        path: screenshotPath,
        contentType: 'image/png',
      })
    }
    expect(pageErrors).toEqual([])
  })
}

test('attaches audio to an already-running generated source', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('./')
  await expect(page.getByText('DSP online')).toBeVisible()

  await page.getByRole('button', { name: 'NBFM', exact: true }).click()
  await page.getByRole('button', { name: 'Add VFO' }).click()
  await page.getByRole('button', { name: 'Start generation' }).click()
  await expect(page.getByText('Analyzing')).toBeVisible()
  await page.getByRole('button', { name: 'Start audio playback' }).click()

  await expect(page.locator('.vfo-state-copy')).toHaveText('playing', {
    timeout: 15_000,
  })
  await page.waitForTimeout(1_500)
  await expect(page.locator('.vfo-footer')).toContainText('0 underruns')
  expect(pageErrors).toEqual([])
})

test('reactivates an out-of-band VFO when source coverage moves', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText('DSP online')).toBeVisible()
  await page.getByRole('button', { name: 'Add VFO' }).click()

  await page.getByRole('spinbutton', { name: 'Frequency' }).fill('0.495')
  await expect(page.locator('.vfo-state-copy')).toHaveText('out of band')
  await page.getByRole('spinbutton', { name: 'RF center' }).fill('0.1')
  await expect(page.locator('.vfo-state-copy')).toHaveText('ready')
})

test('enforces four VFOs and keeps the mixer within a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')
  await expect(page.getByText('DSP online')).toBeVisible()

  const add = page.getByRole('button', { name: 'Add VFO' })
  for (let index = 0; index < 4; index += 1) await add.click()
  await expect(page.getByText('4 / 4 receivers')).toBeVisible()
  await expect(add).toBeDisabled()
  await expect(page.locator('.vfo-row')).toHaveCount(4)

  const geometry = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    rowWidths: [...document.querySelectorAll<HTMLElement>('.vfo-row')]
      .map((row) => row.getBoundingClientRect().width),
    panelWidth: document.querySelector<HTMLElement>('.vfo-panel')?.getBoundingClientRect().width ?? 0,
  }))
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth)
  expect(geometry.rowWidths.every((width) => width <= geometry.panelWidth + 1)).toBe(true)

  const screenshotPath = testInfo.outputPath('multi-vfo-mobile.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  await testInfo.attach('multi-vfo-mobile', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})