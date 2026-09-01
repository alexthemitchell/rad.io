import { expect, test } from '@playwright/test'

type MultiSdrLog = {
  requestedDevices: string[]
  hackrf: {
    transferCount: number
    centerFrequenciesHz: number[]
    claimed: number[]
    released: number[]
    closeCount: number
  }
  rtl: {
    transferCount: number
    claimed: number[]
    released: number[]
    closeCount: number
    biasWrites: boolean[]
  }
}

declare global {
  interface Window {
    __multiSdrLog?: MultiSdrLog
  }
}

test('@source runs HackRF and RTL-SDR sessions with source-keyed audio', async ({ page }) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    const log: MultiSdrLog = {
      requestedDevices: [],
      hackrf: {
        transferCount: 0,
        centerFrequenciesHz: [],
        claimed: [],
        released: [],
        closeCount: 0,
      },
      rtl: {
        transferCount: 0,
        claimed: [],
        released: [],
        closeCount: 0,
        biasWrites: [],
      },
    }

    const hackRfAlternate = {
      alternateSetting: 0,
      interfaceClass: 0xff,
      interfaceSubclass: 0xff,
      interfaceProtocol: 0xff,
      endpoints: [
        { endpointNumber: 1, direction: 'in', type: 'bulk', packetSize: 512 },
        { endpointNumber: 2, direction: 'out', type: 'bulk', packetSize: 512 },
      ],
    }
    const hackRfConfiguration = {
      configurationValue: 1,
      interfaces: [{
        interfaceNumber: 0,
        alternate: hackRfAlternate,
        alternates: [hackRfAlternate],
      }],
    }
    const hackRfState = {
      paired: false,
      opened: false,
      configuration: null as typeof hackRfConfiguration | null,
      centerFrequencyHz: 100_000_000,
      stationFrequencyHz: 100_100_000,
      phase: 0,
      lowerSidePhase: 0,
      upperSidePhase: 0,
      noiseState: 0x4841434b,
    }
    const hackRfDevice = {
      vendorId: 0x1d50,
      productId: 0x6089,
      productName: 'HackRF One',
      manufacturerName: 'Great Scott Gadgets',
      serialNumber: 'multi-hackrf',
      deviceVersionMajor: 1,
      deviceVersionMinor: 0,
      deviceVersionSubminor: 4,
      configurations: [hackRfConfiguration],
      get configuration() {
        return hackRfState.configuration
      },
      get opened() {
        return hackRfState.opened
      },
      async open() {
        hackRfState.opened = true
      },
      async close() {
        hackRfState.opened = false
        log.hackrf.closeCount += 1
      },
      async selectConfiguration() {
        hackRfState.configuration = hackRfConfiguration
      },
      async claimInterface(interfaceNumber: number) {
        log.hackrf.claimed.push(interfaceNumber)
      },
      async releaseInterface(interfaceNumber: number) {
        log.hackrf.released.push(interfaceNumber)
      },
      async selectAlternateInterface() {},
      async controlTransferIn(setup: { request: number }) {
        if (setup.request === 0x0e) {
          return { status: 'ok', data: new DataView(Uint8Array.of(2).buffer) }
        }
        if (setup.request === 0x0f) {
          return {
            status: 'ok',
            data: new DataView(new TextEncoder().encode('2024.02.1\0').buffer),
          }
        }
        return { status: 'ok', data: new DataView(Uint8Array.of(1).buffer) }
      },
      async controlTransferOut(setup: { request: number }, data?: ArrayBuffer) {
        if (setup.request === 0x10 && data) {
          const payload = new DataView(data)
          hackRfState.centerFrequencyHz =
            payload.getUint32(0, true) * 1_000_000 + payload.getUint32(4, true)
          log.hackrf.centerFrequenciesHz.push(hackRfState.centerFrequencyHz)
        }
        return { status: 'ok', bytesWritten: data?.byteLength ?? 0 }
      },
      async transferIn(_endpointNumber: number, length: number) {
        const startedAt = performance.now()
        const iq = new Int8Array(length)
        const sampleCount = length / 2
        const stationOffsetHz =
          hackRfState.stationFrequencyHz - hackRfState.centerFrequencyHz
        for (let index = 0; index < sampleCount; index += 1) {
          hackRfState.noiseState = (
            Math.imul(hackRfState.noiseState, 1_664_525) + 1_013_904_223
          ) >>> 0
          const noiseI = ((hackRfState.noiseState >>> 24) - 127.5) / 64
          hackRfState.noiseState = (
            Math.imul(hackRfState.noiseState, 1_664_525) + 1_013_904_223
          ) >>> 0
          const noiseQ = ((hackRfState.noiseState >>> 24) - 127.5) / 64
          iq[index * 2] = Math.round(
            Math.cos(hackRfState.phase) * 48 +
            Math.cos(hackRfState.lowerSidePhase) * 24 +
            Math.cos(hackRfState.upperSidePhase) * 20 +
            noiseI,
          )
          iq[index * 2 + 1] = Math.round(
            Math.sin(hackRfState.phase) * 48 +
            Math.sin(hackRfState.lowerSidePhase) * 24 +
            Math.sin(hackRfState.upperSidePhase) * 20 +
            noiseQ,
          )
          hackRfState.phase = (
            hackRfState.phase + Math.PI * 2 * stationOffsetHz / 2_000_000
          ) % (Math.PI * 2)
          hackRfState.lowerSidePhase = (
            hackRfState.lowerSidePhase +
            Math.PI * 2 * (stationOffsetHz - 30_000) / 2_000_000
          ) % (Math.PI * 2)
          hackRfState.upperSidePhase = (
            hackRfState.upperSidePhase +
            Math.PI * 2 * (stationOffsetHz + 30_000) / 2_000_000
          ) % (Math.PI * 2)
        }
        log.hackrf.transferCount += 1
        const remainingMs = sampleCount / 2_000 - (performance.now() - startedAt)
        if (remainingMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, remainingMs))
        }
        return { status: 'ok', data: new DataView(iq.buffer) }
      },
      async clearHalt() {},
    }

    const rtlConfiguration = { configurationValue: 1, interfaces: [] }
    const rtlI2cRegisters = new Map<number, number>([
      [0x02, 0x40],
      [0x07, 0x01],
    ])
    const rtlSystemRegisters = new Map<number, number>()
    const rtlState = {
      paired: false,
      opened: false,
      i2cPointer: 0,
      phase: 0,
      lowerSidePhase: 0,
      upperSidePhase: 0,
      noiseState: 0x52544c53,
      nextTransferAt: 0,
    }
    const rtlDevice = {
      vendorId: 0x0bda,
      productId: 0x2838,
      productName: 'RTL2838UHIDIR',
      manufacturerName: 'Realtek',
      serialNumber: 'multi-rtl',
      configurations: [rtlConfiguration],
      get configuration() {
        return rtlConfiguration
      },
      get opened() {
        return rtlState.opened
      },
      async open() {
        rtlState.opened = true
      },
      async close() {
        rtlState.opened = false
        log.rtl.closeCount += 1
      },
      async selectConfiguration() {},
      async claimInterface(interfaceNumber: number) {
        log.rtl.claimed.push(interfaceNumber)
      },
      async releaseInterface(interfaceNumber: number) {
        log.rtl.released.push(interfaceNumber)
      },
      async selectAlternateInterface() {},
      async controlTransferOut(
        setup: { value: number; index: number },
        data?: ArrayBuffer,
      ) {
        const bytes = new Uint8Array(data ?? new ArrayBuffer(0))
        if (setup.index === 0x610 && setup.value === 0xc8 && bytes.length > 0) {
          rtlState.i2cPointer = bytes[0]
          if (bytes.length > 1) rtlI2cRegisters.set(rtlState.i2cPointer, bytes[1])
        } else if (setup.index === 0x210 && bytes.length > 0) {
          rtlSystemRegisters.set(setup.value, bytes[0])
          if (setup.value === 0x3001) log.rtl.biasWrites.push((bytes[0] & 1) !== 0)
        }
        return { status: 'ok', bytesWritten: bytes.length }
      },
      async controlTransferIn(
        setup: { value: number; index: number },
        length: number,
      ) {
        const bytes = new Uint8Array(length)
        if (setup.index === 0x600 && setup.value === 0xc8) {
          bytes[0] = rtlI2cRegisters.get(rtlState.i2cPointer) ?? 0
        } else if (setup.index === 0x200) {
          bytes[0] = rtlSystemRegisters.get(setup.value) ?? 0
        }
        return { status: 'ok', data: new DataView(bytes.buffer) }
      },
      async transferIn(_endpointNumber: number, length: number) {
        const startedAt = performance.now()
        const iq = new Uint8Array(length)
        const sampleCount = length / 2
        for (let index = 0; index < sampleCount; index += 1) {
          rtlState.noiseState = (
            Math.imul(rtlState.noiseState, 1_664_525) + 1_013_904_223
          ) >>> 0
          const noiseI = ((rtlState.noiseState >>> 24) - 127.5) / 64
          rtlState.noiseState = (
            Math.imul(rtlState.noiseState, 1_664_525) + 1_013_904_223
          ) >>> 0
          const noiseQ = ((rtlState.noiseState >>> 24) - 127.5) / 64
          iq[index * 2] = Math.max(0, Math.min(255, Math.round(
            127.5 +
            Math.cos(rtlState.phase) * 48 +
            Math.cos(rtlState.lowerSidePhase) * 24 +
            Math.cos(rtlState.upperSidePhase) * 20 +
            noiseI,
          )))
          iq[index * 2 + 1] = Math.max(0, Math.min(255, Math.round(
            127.5 +
            Math.sin(rtlState.phase) * 48 +
            Math.sin(rtlState.lowerSidePhase) * 24 +
            Math.sin(rtlState.upperSidePhase) * 20 +
            noiseQ,
          )))
          rtlState.phase = (
            rtlState.phase + Math.PI * 2 * 250_000 / 2_400_000
          ) % (Math.PI * 2)
          rtlState.lowerSidePhase = (
            rtlState.lowerSidePhase + Math.PI * 2 * 220_000 / 2_400_000
          ) % (Math.PI * 2)
          rtlState.upperSidePhase = (
            rtlState.upperSidePhase + Math.PI * 2 * 280_000 / 2_400_000
          ) % (Math.PI * 2)
        }
        log.rtl.transferCount += 1
        const scheduledStart = Math.max(startedAt, rtlState.nextTransferAt)
        rtlState.nextTransferAt = scheduledStart + sampleCount / 2_400
        const remainingMs = rtlState.nextTransferAt - performance.now()
        if (remainingMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, remainingMs))
        }
        return { status: 'ok', data: new DataView(iq.buffer) }
      },
      async clearHalt() {},
    }

    const selectionOrder = [hackRfDevice, rtlDevice]
    let nextSelection = 0
    const usb = Object.assign(new EventTarget(), {
      async getDevices() {
        return [
          hackRfState.paired ? hackRfDevice : null,
          rtlState.paired ? rtlDevice : null,
        ].filter((device) => device !== null)
      },
      async requestDevice() {
        const selected = selectionOrder[nextSelection++]
        if (!selected) throw new DOMException('No device selected.', 'NotFoundError')
        if (selected === hackRfDevice) {
          hackRfState.paired = true
          log.requestedDevices.push('hackrf')
        } else {
          rtlState.paired = true
          log.requestedDevices.push('rtl-sdr')
        }
        return selected
      },
    })

    window.__multiSdrLog = log
    Object.defineProperty(navigator, 'usb', {
      configurable: true,
      value: usb,
    })
  })

  await page.goto('./')
  await expect(page.getByText('DSP online')).toBeVisible()

  await page.getByRole('button', { name: 'Add device' }).click()
  const hackRfTab = page.getByRole('tab', { name: /HackRF One/ })
  await expect(hackRfTab).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Connect HackRF One' }).click()
  await expect(page.getByText('Analyzing')).toBeVisible()
  await expect.poll(
    async () => (await page.evaluate(() => window.__multiSdrLog?.hackrf.transferCount)) ?? 0,
  ).toBeGreaterThan(3)

  await page.getByRole('button', { name: 'Add VFO' }).click()
  await page.getByRole('spinbutton', { name: 'Frequency' }).fill('100.1')
  await expect(page.locator('.vfo-source-badge')).toHaveText(['HackRF One'])

  await page.getByRole('button', { name: 'Add device' }).click()
  const rtlTab = page.getByRole('tab', { name: /RTL2838UHIDIR/ })
  await expect(rtlTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Add device' })).toBeDisabled()
  await page.getByRole('spinbutton', { name: 'RF center' }).fill('99.85')
  await page.getByRole('spinbutton', { name: 'RF center' }).press('Tab')
  await page.getByRole('button', { name: 'Connect RTL-SDR' }).click()
  await expect(page.getByText('Analyzing')).toBeVisible()
  await expect.poll(
    async () => (await page.evaluate(() => window.__multiSdrLog?.rtl.transferCount)) ?? 0,
  ).toBeGreaterThan(3)

  const concurrentBaseline = await page.evaluate(() => ({
    hackrf: window.__multiSdrLog?.hackrf.transferCount ?? 0,
    rtl: window.__multiSdrLog?.rtl.transferCount ?? 0,
  }))
  await expect.poll(
    async () => (await page.evaluate(() => window.__multiSdrLog?.hackrf.transferCount)) ?? 0,
  ).toBeGreaterThan(concurrentBaseline.hackrf)
  await expect.poll(
    async () => (await page.evaluate(() => window.__multiSdrLog?.rtl.transferCount)) ?? 0,
  ).toBeGreaterThan(concurrentBaseline.rtl)

  await page.getByRole('button', { name: 'Add VFO' }).click()
  await page.getByRole('spinbutton', { name: 'Frequency' }).nth(1).fill('100.1')
  await expect(page.locator('.vfo-source-badge')).toHaveText([
    'HackRF One',
    'RTL2838UHIDIR',
  ])

  await page.getByRole('button', { name: 'Start audio playback' }).click()
  await expect(page.locator('.vfo-state-copy')).toHaveText(['playing', 'playing'], {
    timeout: 15_000,
  })
  const audioStatus = page.locator('.vfo-panel > [role="status"]')
  await expect(audioStatus).toContainText('0 underruns · 0 overruns')

  await page.getByRole('checkbox', { name: 'Auto optimize' }).check()
  await expect(page.getByRole('combobox', { name: 'Tuner gain' })).toHaveValue('24', {
    timeout: 12_000,
  })

  await hackRfTab.click()
  const rtlTransfersBeforeOptimization =
    (await page.evaluate(() => window.__multiSdrLog?.rtl.transferCount)) ?? 0
  await page.getByRole('checkbox', { name: 'Auto optimize' }).check()
  await expect.poll(
    async () => (
      await page.evaluate(() => window.__multiSdrLog?.hackrf.centerFrequenciesHz.length)
    ) ?? 0,
    { timeout: 12_000 },
  ).toBeGreaterThan(1)
  await expect.poll(
    async () => (await page.evaluate(() => window.__multiSdrLog?.rtl.transferCount)) ?? 0,
  ).toBeGreaterThan(rtlTransfersBeforeOptimization)
  await expect(audioStatus).toContainText('0 underruns · 0 overruns')

  await page.getByRole('button', { name: 'Stop HackRF reception' }).click()
  await expect(page.locator('.vfo-state-copy').first()).toHaveText('ready')
  const rtlTransfersBeforeRemoval =
    (await page.evaluate(() => window.__multiSdrLog?.rtl.transferCount)) ?? 0
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Remove HackRF One' }).click()
  await expect(hackRfTab).toHaveCount(0)
  await expect(page.locator('.vfo-row')).toHaveCount(1)
  await expect(rtlTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Analyzing')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Auto optimize' })).toBeChecked()
  await expect.poll(
    async () => (await page.evaluate(() => window.__multiSdrLog?.rtl.transferCount)) ?? 0,
  ).toBeGreaterThan(rtlTransfersBeforeRemoval)
  await expect(page.locator('.vfo-state-copy')).toHaveText('playing')

  await page.getByRole('button', { name: 'Stop RTL-SDR reception' }).click()
  await expect(page.getByText('DSP online')).toBeVisible()
  const stopped = await page.evaluate(() => window.__multiSdrLog)
  expect(stopped?.requestedDevices).toEqual(['hackrf', 'rtl-sdr'])
  expect(stopped?.hackrf.claimed).toContain(0)
  expect(stopped?.hackrf.released).toContain(0)
  expect(stopped?.hackrf.closeCount).toBeGreaterThan(0)
  expect(stopped?.rtl.claimed).toContain(0)
  expect(stopped?.rtl.released).toContain(0)
  expect(stopped?.rtl.closeCount).toBeGreaterThan(0)
  expect(stopped?.rtl.biasWrites.at(-1)).toBe(false)
})