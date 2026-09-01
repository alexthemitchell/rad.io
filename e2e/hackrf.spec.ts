import { expect, test } from '@playwright/test'

const STRICT_UNDERRUNS = process.env.PLAYWRIGHT_STRICT_UNDERRUNS === '1'

type HackRfUsbLog = {
  controlIn: number[]
  controlOut: number[]
  centerFrequenciesHz: number[]
  gainChanges: Array<{ request: number; gainDb: number }>
  requestCount: number
  transferCount: number
  claimed: number[]
  released: number[]
  closeCount: number
}

declare global {
  interface Window {
    __hackRfUsbLog?: HackRfUsbLog
    __hackRfShake?: boolean
  }
}

test('streams HackRF IQ through the real analyzer and cleans up', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const log: HackRfUsbLog = {
      controlIn: [],
      controlOut: [],
      centerFrequenciesHz: [],
      gainChanges: [],
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
      phase: 0,
      lowerSidePhase: 0,
      upperSidePhase: 0,
      noiseState: 0x52414449,
      centerFrequencyHz: 100_000_000,
      stationFrequencyHz: 100_100_000,
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
      async controlTransferIn(setup: { request: number; index: number }) {
        log.controlIn.push(setup.request)
        if (setup.request === 0x0e) {
          return { status: 'ok', data: new DataView(Uint8Array.of(2).buffer) }
        }
        if (setup.request === 0x0f) {
          const version = new TextEncoder().encode('2024.02.1\0')
          return { status: 'ok', data: new DataView(version.buffer) }
        }
        if (setup.request === 0x13 || setup.request === 0x14) {
          log.gainChanges.push({ request: setup.request, gainDb: setup.index })
        }
        return { status: 'ok', data: new DataView(Uint8Array.of(1).buffer) }
      },
      async controlTransferOut(
        setup: { request: number },
        data?: ArrayBuffer,
      ) {
        log.controlOut.push(setup.request)
        if (setup.request === 0x10 && data) {
          const payload = new DataView(data)
          state.centerFrequencyHz =
            payload.getUint32(0, true) * 1_000_000 + payload.getUint32(4, true)
          log.centerFrequenciesHz.push(state.centerFrequencyHz)
        }
        return { status: 'ok', bytesWritten: data?.byteLength ?? 0 }
      },
      async transferIn(_endpointNumber: number, length: number) {
        const transferStartedAt = performance.now()
        const sampleCount = length / 2
        const iq = new Int8Array(length)
        const shakePatternHz = [-24_000, 0, 24_000, 0]
        const shakeHz = window.__hackRfShake
          ? shakePatternHz[Math.floor(log.transferCount / 10) % shakePatternHz.length]
          : 0
        const stationOffsetHz = state.stationFrequencyHz - state.centerFrequencyHz
        for (let index = 0; index < sampleCount; index += 1) {
          state.noiseState = (Math.imul(state.noiseState, 1_664_525) + 1_013_904_223) >>> 0
          const noiseI = ((state.noiseState >>> 24) - 127.5) / 64
          state.noiseState = (Math.imul(state.noiseState, 1_664_525) + 1_013_904_223) >>> 0
          const noiseQ = ((state.noiseState >>> 24) - 127.5) / 64
          const lowerSideI = window.__hackRfShake
            ? Math.cos(state.lowerSidePhase) * 24
            : 0
          const lowerSideQ = window.__hackRfShake
            ? Math.sin(state.lowerSidePhase) * 24
            : 0
          const upperSideI = window.__hackRfShake
            ? Math.cos(state.upperSidePhase) * 20
            : 0
          const upperSideQ = window.__hackRfShake
            ? Math.sin(state.upperSidePhase) * 20
            : 0
          iq[index * 2] = Math.round(
            Math.cos(state.phase) * 48 + lowerSideI + upperSideI + noiseI,
          )
          iq[index * 2 + 1] = Math.round(
            Math.sin(state.phase) * 48 + lowerSideQ + upperSideQ + noiseQ,
          )
          state.phase =
            (state.phase + (Math.PI * 2 * (stationOffsetHz + shakeHz)) / 2_000_000) %
            (Math.PI * 2)
          state.lowerSidePhase =
            (state.lowerSidePhase +
              (Math.PI * 2 * (stationOffsetHz - 30_000 + shakeHz)) / 2_000_000) %
            (Math.PI * 2)
          state.upperSidePhase =
            (state.upperSidePhase +
              (Math.PI * 2 * (stationOffsetHz + 30_000 + shakeHz)) / 2_000_000) %
            (Math.PI * 2)
        }
        state.sampleIndex += sampleCount
        log.transferCount += 1
        const transferDurationMs = sampleCount / 2_000
        const remainingDurationMs = transferDurationMs - (performance.now() - transferStartedAt)
        if (remainingDurationMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, remainingDurationMs))
        }
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

  await page.goto('./')
  await expect(page.getByText('DSP online')).toBeVisible()
  await page.getByRole('button', { name: 'Add device' }).click()
  await expect(page.getByRole('slider', { name: 'Minimum SNR' })).toHaveValue('25')
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

  await page.evaluate(() => {
    window.__hackRfShake = true
  })
  await page.waitForTimeout(1_000)
  await page.screenshot({
    path: testInfo.outputPath('hackrf-rf-shake.png'),
    fullPage: true,
  })
  await expect(page.locator('.detection-table tbody tr')).toHaveCount(1)

  await page.locator('.detection-table tbody button').click()
  await page.getByRole('button', { name: 'Add receiver' }).click()
  await page.getByRole('button', { name: 'Start audio playback' }).click()
  await expect(page.locator('.vfo-state-copy')).toHaveText('playing', {
    timeout: 15_000,
  })
  await page.waitForTimeout(1_000)
  if (STRICT_UNDERRUNS) {
    await expect(page.locator('.vfo-footer')).toContainText('0 underruns')
  }

  const autoOptimize = page.getByRole('checkbox', { name: 'Auto optimize' })
  const gainChangesBeforeOptimization =
    (await page.evaluate(() => window.__hackRfUsbLog?.gainChanges.length)) ?? 0
  await autoOptimize.check()
  await expect.poll(
    async () => (await page.evaluate(() => window.__hackRfUsbLog?.centerFrequenciesHz.length)) ?? 0,
    { timeout: 8_000 },
  ).toBe(2)
  const optimizedCenterHz = await page.evaluate(
    () => window.__hackRfUsbLog?.centerFrequenciesHz.at(-1),
  )
  expect(optimizedCenterHz).toBe(99_850_000)
  await expect(page.getByLabel('Analyzer configuration')).toContainText('99.850 MHz')
  await expect.poll(
    async () => (await page.evaluate(() => window.__hackRfUsbLog?.gainChanges.length)) ?? 0,
    { timeout: 8_000 },
  ).toBeGreaterThan(gainChangesBeforeOptimization)

  await autoOptimize.uncheck()
  const commandsAfterDisable = await page.evaluate(() => ({
    controlIn: window.__hackRfUsbLog?.controlIn.length ?? 0,
    controlOut: window.__hackRfUsbLog?.controlOut.length ?? 0,
  }))
  await page.waitForTimeout(1_250)
  expect(await page.evaluate(() => ({
    controlIn: window.__hackRfUsbLog?.controlIn.length ?? 0,
    controlOut: window.__hackRfUsbLog?.controlOut.length ?? 0,
  }))).toEqual(commandsAfterDisable)
  const optimizedLog = await page.evaluate(() => window.__hackRfUsbLog)
  expect(optimizedLog?.controlOut.filter((request) => request === 0x11)).toHaveLength(1)
  expect(optimizedLog?.controlOut.filter((request) => request === 0x17)).toHaveLength(1)

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
  await page.goto('./')
  await expect(page.getByText('DSP online')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add device' })).toBeDisabled()
  await expect(page.getByText('WebUSB is unavailable', { exact: false })).toBeVisible()
})