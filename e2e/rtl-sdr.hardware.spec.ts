import { expect, test } from '@playwright/test'

const HARDWARE_ENABLED = process.env.RAD_RTL_SDR_HARDWARE === '1'

type DevicePrompt = {
  id: string
  devices: Array<{
    id: string
    name: string
  }>
}

test.describe('RTL-SDR hardware', () => {
  test.skip(!HARDWARE_ENABLED, 'Set RAD_RTL_SDR_HARDWARE=1 with an RTL-SDR attached.')

  test('receives live E4000 IQ through WebUSB and releases the device', async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(45_000)
    const cdp = await context.newCDPSession(page)
    await cdp.send('DeviceAccess.enable')
    let selectedDeviceName = ''
    cdp.on('DeviceAccess.deviceRequestPrompted', (event) => {
      const prompt = event as DevicePrompt
      const selected = prompt.devices.find((device) =>
        /RTL|Realtek|2838/i.test(device.name),
      ) ?? prompt.devices[0]
      if (!selected) return
      selectedDeviceName = selected.name
      void cdp.send('DeviceAccess.selectPrompt', {
        id: prompt.id,
        deviceId: selected.id,
      })
    })

    await page.goto('./')
    await expect(page.getByText('DSP online')).toBeVisible()
    await page.getByRole('button', { name: 'Add device' }).click()
    await expect(page.getByRole('checkbox', { name: 'Bias tee power' })).not.toBeChecked()
    await page.getByRole('button', { name: 'Connect RTL-SDR' }).click()

    try {
      await expect(page.getByText('Analyzing')).toBeVisible({ timeout: 20_000 })
      await expect(page.locator('.engine-status [role="status"]')).toContainText('RTL-SDR')
      const frameMetric = page.locator('.metrics > div').filter({ hasText: 'Frame' }).locator('strong')
      await expect.poll(async () => Number(await frameMetric.textContent()), {
        timeout: 15_000,
      }).toBeGreaterThan(10)
      if (selectedDeviceName) expect(selectedDeviceName).toMatch(/RTL|Realtek|2838/i)
      await page.screenshot({
        path: testInfo.outputPath('rtl-sdr-e4000-live.png'),
        fullPage: true,
      })
      await page.getByRole('button', { name: 'Stop RTL-SDR reception' }).click()
      await expect(page.getByText('DSP online')).toBeVisible({ timeout: 10_000 })
    } finally {
      const stop = page.getByRole('button', { name: 'Stop RTL-SDR reception' })
      if (await stop.isVisible()) await stop.click()
      await cdp.send('DeviceAccess.disable').catch(() => undefined)
      await cdp.detach()
    }
  })
})