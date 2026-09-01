import { expect, test } from '@playwright/test'

type RtlSdrUsbLog = {
  requestCount: number
  transferCount: number
  claimed: number[]
  released: number[]
  closeCount: number
  i2cReads: number[]
  i2cWrites: Array<{ register: number; value: number }>
  biasWrites: boolean[]
}

declare global {
  interface Window {
    __rtlSdrUsbLog?: RtlSdrUsbLog
  }
}

test('@source streams RTL-SDR E4000 IQ through the real analyzer and cleans up', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const log: RtlSdrUsbLog = {
      requestCount: 0,
      transferCount: 0,
      claimed: [],
      released: [],
      closeCount: 0,
      i2cReads: [],
      i2cWrites: [],
      biasWrites: [],
    }
    const i2cRegisters = new Map<number, number>([
      [0x02, 0x40],
      [0x07, 0x01],
    ])
    const systemRegisters = new Map<number, number>()
    const state = {
      opened: false,
      paired: false,
      i2cPointer: 0,
      phase: 0,
      noiseState: 0x52544c53,
    }
    const configuration = {
      configurationValue: 1,
      interfaces: [],
    }
    const device = {
      vendorId: 0x0bda,
      productId: 0x2838,
      productName: 'RTL2838UHIDIR',
      manufacturerName: 'Realtek',
      serialNumber: '00000001',
      configurations: [configuration],
      get configuration() {
        return configuration
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
      async selectConfiguration() {},
      async claimInterface(interfaceNumber: number) {
        log.claimed.push(interfaceNumber)
      },
      async releaseInterface(interfaceNumber: number) {
        log.released.push(interfaceNumber)
      },
      async selectAlternateInterface() {},
      async controlTransferOut(
        setup: { value: number; index: number },
        data?: ArrayBuffer,
      ) {
        const bytes = new Uint8Array(data ?? new ArrayBuffer(0))
        if (setup.index === 0x610 && setup.value === 0xc8 && bytes.length > 0) {
          state.i2cPointer = bytes[0]
          if (bytes.length > 1) {
            i2cRegisters.set(state.i2cPointer, bytes[1])
            log.i2cWrites.push({ register: state.i2cPointer, value: bytes[1] })
          }
        } else if (setup.index === 0x210 && bytes.length > 0) {
          systemRegisters.set(setup.value, bytes[0])
          if (setup.value === 0x3001) log.biasWrites.push((bytes[0] & 1) !== 0)
        }
        return { status: 'ok', bytesWritten: bytes.length }
      },
      async controlTransferIn(
        setup: { value: number; index: number },
        length: number,
      ) {
        const bytes = new Uint8Array(length)
        if (setup.index === 0x600 && setup.value === 0xc8) {
          log.i2cReads.push(state.i2cPointer)
          bytes[0] = i2cRegisters.get(state.i2cPointer) ?? 0
        } else if (setup.index === 0x200) {
          bytes[0] = systemRegisters.get(setup.value) ?? 0
        }
        return { status: 'ok', data: new DataView(bytes.buffer) }
      },
      async transferIn(_endpointNumber: number, length: number) {
        const startedAt = performance.now()
        const sampleCount = length / 2
        const iq = new Uint8Array(length)
        for (let index = 0; index < sampleCount; index += 1) {
          state.noiseState = (Math.imul(state.noiseState, 1_664_525) + 1_013_904_223) >>> 0
          const noiseI = ((state.noiseState >>> 24) - 127.5) / 64
          state.noiseState = (Math.imul(state.noiseState, 1_664_525) + 1_013_904_223) >>> 0
          const noiseQ = ((state.noiseState >>> 24) - 127.5) / 64
          iq[index * 2] = Math.max(0, Math.min(255, Math.round(
            127.5 + Math.cos(state.phase) * 48 + noiseI,
          )))
          iq[index * 2 + 1] = Math.max(0, Math.min(255, Math.round(
            127.5 + Math.sin(state.phase) * 48 + noiseQ,
          )))
          state.phase = (state.phase + Math.PI * 2 * 100_000 / 2_400_000) % (Math.PI * 2)
        }
        log.transferCount += 1
        const remainingMs = sampleCount / 2_400 - (performance.now() - startedAt)
        if (remainingMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, remainingMs))
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

    window.__rtlSdrUsbLog = log
    Object.defineProperty(navigator, 'usb', {
      configurable: true,
      value: usb,
    })
  })

  await page.goto('./')
  await expect(page.getByText('DSP online')).toBeVisible()
  await page.getByRole('button', { name: 'Add device' }).click()
  await expect(page.getByRole('combobox', { name: 'Sample rate' })).toHaveValue('2400000')
  await expect(page.getByRole('checkbox', { name: 'Bias tee power' })).not.toBeChecked()
  await page.getByRole('button', { name: 'Connect RTL-SDR' }).click()

  await expect(page.getByText('Analyzing')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.engine-status [role="status"]')).toContainText('RTL2838UHIDIR')
  const frameMetric = page.locator('.metrics > div').filter({ hasText: 'Frame' }).locator('strong')
  await expect.poll(async () => Number(await frameMetric.textContent())).toBeGreaterThan(3)
  await expect(page.locator('.metrics > div').filter({ hasText: 'Peak' })).toContainText('+99')

  await page.screenshot({
    path: testInfo.outputPath('rtl-sdr-e4000.png'),
    fullPage: true,
  })

  const runningLog = await page.evaluate(() => window.__rtlSdrUsbLog)
  expect(runningLog?.requestCount).toBe(1)
  expect(runningLog?.claimed).toEqual([0])
  expect(runningLog?.transferCount).toBeGreaterThan(1)
  expect(runningLog?.i2cReads).toContain(0x02)
  expect(runningLog?.i2cWrites).toContainEqual({ register: 0x7a, value: 0x96 })
  expect(runningLog?.biasWrites[0]).toBe(false)

  await page.getByRole('button', { name: 'Stop RTL-SDR reception' }).click()
  await expect(page.getByText('DSP online')).toBeVisible()
  await expect.poll(
    async () => (await page.evaluate(() => window.__rtlSdrUsbLog?.closeCount)) ?? 0,
  ).toBeGreaterThan(0)
  const stoppedLog = await page.evaluate(() => window.__rtlSdrUsbLog)
  expect(stoppedLog?.released).toContain(0)
  expect(stoppedLog?.biasWrites.at(-1)).toBe(false)
})