import { expect, test } from '@playwright/test'

type HackRfUsbLog = {
  controlIn: number[]
  controlOut: number[]
  requestCount: number
  transferCount: number
  claimed: number[]
  released: number[]
  closeCount: number
}

declare global {
  interface Window {
    __hackRfUsbLog?: HackRfUsbLog
  }
}

test('streams HackRF IQ through the real analyzer and cleans up', async ({ page }) => {
  await page.addInitScript(() => {
    const log: HackRfUsbLog = {
      controlIn: [],
      controlOut: [],
      requestCount: 0,
      transferCount: 0,
      claimed: [],
      released: [],
      closeCount: 0,
    }
    const alternate = {
      alternateSetting: 0,
      interfaceClass: 0xff,
      interfaceSubclass: 0xff,
      interfaceProtocol: 0xff,
      endpoints: [
        { endpointNumber: 1, direction: 'in', type: 'bulk', packetSize: 512 },
        { endpointNumber: 2, direction: 'out', type: 'bulk', packetSize: 512 },
      ],
    }
    const configuration = {
      configurationValue: 1,
      interfaces: [{ interfaceNumber: 0, alternate, alternates: [alternate] }],
    }
    const state = {
      opened: false,
      configuration: null as typeof configuration | null,
      paired: false,
      sampleIndex: 0,
    }
    const device = {
      vendorId: 0x1d50,
      productId: 0x6089,
      productName: 'HackRF One',
      manufacturerName: 'Great Scott Gadgets',
      serialNumber: 'playwright-hackrf',
      deviceVersionMajor: 1,
      deviceVersionMinor: 0,
      deviceVersionSubminor: 4,
      configurations: [configuration],
      get configuration() {
        return state.configuration
      },
      get opened() {
        return state.opened
      },
      async open() {
        state.opened = true
      },
      async close() {
        state.opened = false
        log.closeCount += 1
      },
      async selectConfiguration() {
        state.configuration = configuration
      },
      async claimInterface(interfaceNumber: number) {
        log.claimed.push(interfaceNumber)
      },
      async releaseInterface(interfaceNumber: number) {
        log.released.push(interfaceNumber)
      },
      async selectAlternateInterface() {},
      async controlTransferIn(setup: { request: number }) {
        log.controlIn.push(setup.request)
        if (setup.request === 0x0e) {
          return { status: 'ok', data: new DataView(Uint8Array.of(2).buffer) }
        }
        if (setup.request === 0x0f) {
          const version = new TextEncoder().encode('2024.02.1\0')
          return { status: 'ok', data: new DataView(version.buffer) }
        }
        return { status: 'ok', data: new DataView(Uint8Array.of(1).buffer) }
      },
      async controlTransferOut(
        setup: { request: number },
        data?: ArrayBuffer,
      ) {
        log.controlOut.push(setup.request)
        return { status: 'ok', bytesWritten: data?.byteLength ?? 0 }
      },
      async transferIn(_endpointNumber: number, length: number) {
        await new Promise<void>((resolve) => setTimeout(resolve, 4))
        const iq = new Int8Array(length)
        const sampleCount = length / 2
        for (let index = 0; index < sampleCount; index += 1) {
          const phase =
            (Math.PI * 2 * 100_000 * (state.sampleIndex + index)) / 2_000_000
          iq[index * 2] = Math.round(Math.cos(phase) * 64)
          iq[index * 2 + 1] = Math.round(Math.sin(phase) * 64)
        }
        state.sampleIndex += sampleCount
        log.transferCount += 1
        return { status: 'ok', data: new DataView(iq.buffer) }
      },
      async clearHalt() {},
    }
    const usb = Object.assign(new EventTarget(), {
      async getDevices() {
        return state.paired ? [device] : []
      },
      async requestDevice() {
        state.paired = true
        log.requestCount += 1
        return device
      },
    })

    window.__hackRfUsbLog = log
    Object.defineProperty(navigator, 'usb', {
      configurable: true,
      value: usb,
    })
  })

  await page.goto('/')
  await expect(page.getByText('DSP online')).toBeVisible()
  await page.getByRole('button', { name: 'HackRF' }).click()
  await page.getByRole('button', { name: 'Connect HackRF One' }).click()

  await expect(page.getByText('Analyzing')).toBeVisible()
  await expect(page.locator('.engine-status [role="status"]')).toContainText('HackRF One')
  const frameMetric = page
    .locator('.metrics > div')
    .filter({ hasText: 'Frame' })
    .locator('strong')
  await expect.poll(async () => Number(await frameMetric.textContent())).toBeGreaterThan(3)
  await expect(
    page.locator('.metrics > div').filter({ hasText: 'Peak' }),
  ).toContainText('+99.6 kHz')

  const pixelCounts = await page.locator('canvas').evaluateAll((canvases) =>
    canvases.map((canvas) => {
      const pixels = canvas.getContext('2d')?.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data
      if (!pixels) return 0
      let visible = 0
      const stride = Math.max(4, Math.floor(pixels.length / 10_000 / 4) * 4)
      for (let index = 0; index < pixels.length; index += stride) {
        if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 100) visible += 1
      }
      return visible
    }),
  )
  expect(pixelCounts).toHaveLength(3)
  for (const count of pixelCounts) expect(count).toBeGreaterThan(50)

  const runningLog = await page.evaluate(() => window.__hackRfUsbLog)
  expect(runningLog?.controlOut.slice(0, 7)).toEqual([
    0x01,
    0x17,
    0x11,
    0x06,
    0x07,
    0x10,
    0x01,
  ])
  expect(runningLog?.controlIn).toEqual(expect.arrayContaining([0x0e, 0x0f, 0x13, 0x14]))
  expect(runningLog?.transferCount).toBeGreaterThan(1)
  expect(runningLog?.claimed).toEqual([0])
  expect(runningLog?.requestCount).toBe(1)

  await page.getByRole('button', { name: 'Stop HackRF reception' }).click()
  await expect(page.getByText('DSP online')).toBeVisible()
  await expect.poll(
    async () => (await page.evaluate(() => window.__hackRfUsbLog?.closeCount)) ?? 0,
  ).toBe(1)
  const stoppedLog = await page.evaluate(() => window.__hackRfUsbLog)
  expect(stoppedLog?.controlOut.at(-1)).toBe(0x01)
  expect(stoppedLog?.released).toEqual([0])

  const firstSessionTransfers = stoppedLog?.transferCount ?? 0
  await page.getByRole('button', { name: 'Connect HackRF One' }).click()
  await expect(page.getByText('Analyzing')).toBeVisible()
  await expect.poll(
    async () => (await page.evaluate(() => window.__hackRfUsbLog?.transferCount)) ?? 0,
  ).toBeGreaterThan(firstSessionTransfers)
  expect(await page.evaluate(() => window.__hackRfUsbLog?.requestCount)).toBe(1)

  await page.getByRole('button', { name: 'Stop HackRF reception' }).click()
  await expect.poll(
    async () => (await page.evaluate(() => window.__hackRfUsbLog?.closeCount)) ?? 0,
  ).toBe(2)
})

test('reports unavailable WebUSB without remaining in connecting state', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'usb', {
      configurable: true,
      value: undefined,
    })
  })
  await page.goto('/')
  await expect(page.getByText('DSP online')).toBeVisible()
  await page.getByRole('button', { name: 'HackRF' }).click()
  await page.getByRole('button', { name: 'Connect HackRF One' }).click()

  await expect(page.getByText('DSP error')).toBeVisible()
  await expect(page.locator('.engine-status [role="status"]')).toContainText(
    'WebUSB is unavailable',
  )
  await expect(page.getByRole('button', { name: 'Connect HackRF One' })).toBeEnabled()
})