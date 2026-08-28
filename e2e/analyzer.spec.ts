import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText('DSP online')).toBeVisible()
})

test('generates, renders, and pauses complex IQ frames', async ({ page }) => {
  await page.getByRole('button', { name: 'Start generation' }).click()
  await expect(page.getByText('Analyzing')).toBeVisible()

  const frameMetric = page.locator('.metrics > div').filter({ hasText: 'Frame' }).locator('strong')
  await expect.poll(async () => Number((await frameMetric.textContent()) ?? 0)).toBeGreaterThan(3)
  await expect(page.locator('.metrics > div').filter({ hasText: 'Peak' })).toContainText('+100.1 kHz')
  await expect(page.locator('.metrics > div').filter({ hasText: 'Level' })).toContainText(/-12\.[0-9] dBFS/)

  const pixelCounts = await page.locator('canvas').evaluateAll((canvases) =>
    canvases.map((canvas) => {
      const context = canvas.getContext('2d')
      const pixels = context?.getImageData(0, 0, canvas.width, canvas.height).data
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
  for (const count of pixelCounts) expect(count).toBeGreaterThan(100)

  await page.getByRole('button', { name: 'Pause generation' }).click()
  await expect(page.getByText('DSP online')).toBeVisible()
  await page.waitForTimeout(300)
  const pausedAt = await frameMetric.textContent()
  await page.waitForTimeout(350)
  await expect(frameMetric).toHaveText(pausedAt ?? '')
})

test('moves the spectral peak when the tone offset changes', async ({ page }) => {
  await page.getByRole('spinbutton', { name: 'Tone offset' }).fill('-125')
  await page.waitForTimeout(50)
  await page.getByRole('button', { name: 'Start generation' }).click()

  await expect(page.locator('.metrics > div').filter({ hasText: 'Peak' })).toContainText('-125.0 kHz')
})

test('continues generating after reset clears a pending frame', async ({ page }) => {
  const frameMetric = page.locator('.metrics > div').filter({ hasText: 'Frame' }).locator('strong')
  await page.getByRole('button', { name: 'Start generation' }).click()
  await expect.poll(async () => Number((await frameMetric.textContent()) ?? 0)).toBeGreaterThan(3)
  const beforeReset = Number(await frameMetric.textContent())

  await page.getByRole('button', { name: 'Reset generator' }).click()
  await expect.poll(async () => Number((await frameMetric.textContent()) ?? 0)).not.toBe(beforeReset)
  const firstVisibleAfterReset = Number(await frameMetric.textContent())
  await expect.poll(async () => Number((await frameMetric.textContent()) ?? 0)).toBeGreaterThan(
    firstVisibleAfterReset,
  )
})

test('@source processes and releases transferable external IQ', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/src/workers/DspWorkerClient.ts'
    const { DspWorkerClient } = await import(modulePath)
    const client = new DspWorkerClient()
    const ready = await client.initialize()

    const sampleRateHz = 1_024_000
    const toneFrequencyHz = 64_000
    const sampleCount = 2048
    const iq = new Float32Array(sampleCount * 2)
    for (let index = 0; index < sampleCount; index += 1) {
      const phase = (Math.PI * 2 * toneFrequencyHz * index) / sampleRateHz
      iq[index * 2] = Math.cos(phase)
      iq[index * 2 + 1] = Math.sin(phase)
    }

    const frame = new Promise<{
      peakFrequencyHz: number
      centerFrequencyHz: number
      sequence: number
      sourceSequence: number
      timestampUs: bigint
      formatVersion: number
      noiseFloorDbfs: number
      detectionCount: number
    }>((resolve) => {
      const unsubscribe = client.onFrame((nextFrame) => {
        unsubscribe()
        client.frameConsumed(nextFrame.sequence)
        resolve({
          peakFrequencyHz: nextFrame.peakFrequencyHz,
          centerFrequencyHz: nextFrame.centerFrequencyHz,
          sequence: nextFrame.sequence,
          sourceSequence: nextFrame.sourceSequence,
          timestampUs: nextFrame.timestampUs,
          formatVersion: nextFrame.formatVersion,
          noiseFloorDbfs: nextFrame.noiseFloorDbfs,
          detectionCount: nextFrame.detections.length,
        })
      })
    })
    const release = client.processSamples(iq, {
      sampleRateHz,
      centerFrequencyHz: 915_000_000,
      sourceSequence: 73,
      timestampUs: 123_456n,
      formatVersion: 1,
    })
    const detachedByteLength = iq.byteLength
    const [analysis, released] = await Promise.all([frame, release])

    const invalidIq = new Float32Array(sampleCount * 2)
    invalidIq[0] = Number.NaN
    const invalidRelease = client.processSamples(invalidIq, {
      sampleRateHz,
      centerFrequencyHz: 915_000_000,
      sourceSequence: 74,
      timestampUs: 124_000n,
      formatVersion: 1,
    })
    const invalidDetachedByteLength = invalidIq.byteLength
    const invalidReleased = await invalidRelease
    client.terminate()

    return {
      ...analysis,
      protocolVersion: ready.protocolVersion,
      detachedByteLength,
      releasedByteLength: released.buffer.byteLength,
      dropped: released.dropped,
      invalidDetachedByteLength,
      invalidReleasedByteLength: invalidReleased.buffer.byteLength,
      invalidDropped: invalidReleased.dropped,
    }
  })

  expect(result.detachedByteLength).toBe(0)
  expect(result.releasedByteLength).toBe(2048 * 2 * Float32Array.BYTES_PER_ELEMENT)
  expect(result.dropped).toBe(false)
  expect(result.peakFrequencyHz).toBeCloseTo(64_000, 1)
  expect(result.centerFrequencyHz).toBe(915_000_000)
  expect(result.sequence).toBe(1)
  expect(result.sourceSequence).toBe(73)
  expect(result.timestampUs).toBe(123_456n)
  expect(result.formatVersion).toBe(1)
  expect(result.protocolVersion).toBe(4)
  expect(result.noiseFloorDbfs).toBeLessThan(-100)
  expect(result.detectionCount).toBeGreaterThanOrEqual(1)
  expect(result.invalidDetachedByteLength).toBe(0)
  expect(result.invalidReleasedByteLength).toBe(
    2048 * 2 * Float32Array.BYTES_PER_ELEMENT,
  )
  expect(result.invalidDropped).toBe(true)
})

test('@source tracks and classifies multiple external IQ signals', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/src/workers/DspWorkerClient.ts'
    const { DspWorkerClient } = await import(modulePath)
    const client = new DspWorkerClient()
    await client.initialize()

    const sampleRateHz = 1_024_000
    const sampleCount = 2048
    const centerFrequencyHz = 915_000_000
    const tones = [
      { frequencyHz: 64_000, amplitude: 0.6 },
      { frequencyHz: -128_000, amplitude: 0.3 },
    ]
    let lastFrame:
      | {
          detections: Array<{ peakFrequencyHz: number; snrDb: number }>
          tracks: Array<{
            id: string
            absoluteFrequencyHz: number | null
            category: string
            score: number
          }>
        }
      | undefined

    for (let sourceSequence = 1; sourceSequence <= 3; sourceSequence += 1) {
      const iq = new Float32Array(sampleCount * 2)
      for (let index = 0; index < sampleCount; index += 1) {
        for (const tone of tones) {
          const phase = (Math.PI * 2 * tone.frequencyHz * index) / sampleRateHz
          iq[index * 2] += Math.cos(phase) * tone.amplitude
          iq[index * 2 + 1] += Math.sin(phase) * tone.amplitude
        }
      }

      const frame = new Promise<NonNullable<typeof lastFrame>>((resolve) => {
        const unsubscribe = client.onFrame((nextFrame) => {
          unsubscribe()
          client.frameConsumed(nextFrame.sequence)
          resolve({
            detections: nextFrame.detections.map((detection) => ({
              peakFrequencyHz: detection.peakFrequencyHz,
              snrDb: detection.snrDb,
            })),
            tracks: nextFrame.trackedSignals.map((signal) => ({
              id: signal.id,
              absoluteFrequencyHz: signal.absoluteFrequencyHz,
              category: signal.classification.primary.category,
              score: signal.classification.primary.score,
            })),
          })
        })
      })
      const release = client.processSamples(iq, {
        sampleRateHz,
        centerFrequencyHz,
        sourceSequence,
        timestampUs: BigInt(sourceSequence * 10_000),
        formatVersion: 1,
      })
      const [nextFrame, released] = await Promise.all([frame, release])
      if (released.dropped) throw new Error(`Frame ${sourceSequence} was dropped.`)
      lastFrame = nextFrame
    }

    client.terminate()
    return lastFrame
  })

  expect(result).toBeDefined()
  expect(result?.detections.length).toBeGreaterThanOrEqual(2)
  expect(
    result?.detections.some(
      (detection) => Math.abs(detection.peakFrequencyHz - 64_000) < 501,
    ),
  ).toBe(true)
  expect(
    result?.detections.some(
      (detection) => Math.abs(detection.peakFrequencyHz + 128_000) < 501,
    ),
  ).toBe(true)
  expect(result?.tracks).toHaveLength(2)
  expect(result?.tracks.map((track) => track.id).sort()).toEqual([
    'signal-1',
    'signal-2',
  ])
  const trackFrequenciesHz =
    result?.tracks.map((track) => track.absoluteFrequencyHz ?? 0) ?? []
  expect(trackFrequenciesHz).toEqual(
    [...trackFrequenciesHz].sort((left, right) => left - right),
  )
  for (const track of result?.tracks ?? []) {
    expect(track.category).toBe('amateur')
    expect(track.score).toBeGreaterThan(0.5)
  }
  expect(
    result?.tracks.some(
      (track) => Math.abs((track.absoluteFrequencyHz ?? 0) - 915_064_000) < 501,
    ),
  ).toBe(true)
  expect(
    result?.tracks.some(
      (track) => Math.abs((track.absoluteFrequencyHz ?? 0) - 914_872_000) < 501,
    ),
  ).toBe(true)
})

test('classifies a generated signal with RF context and clears it on reset', async ({ page }) => {
  await page.getByRole('spinbutton', { name: 'RF center' }).fill('100')
  await page.getByRole('button', { name: 'Start generation' }).click()

  const fmSignal = page.getByRole('button', {
    name: /FM broadcast channel 261 \(100\.1 MHz\)/,
  })
  await expect(fmSignal).toBeVisible()
  const signalRow = page
    .getByRole('row')
    .filter({ hasText: /FM broadcast channel 261 \(100\.1 MHz\)/ })
    .filter({ hasText: /\+100\.[0-9] kHz/ })
    .first()
  await expect(signalRow).toContainText(/100\.10[0-9]{2} MHz/)
  await expect(signalRow).toContainText(/dBFS/)
  await expect(page.getByText(/% evidence/)).toBeVisible()

  await page.getByRole('button', { name: 'Pause generation' }).click()
  await page.getByRole('combobox', { name: 'Profile' }).selectOption('none')
  await expect(page.getByText('No confirmed signals')).toBeVisible()
  await page.getByRole('button', { name: 'Start generation' }).click()
  await expect(page.getByRole('button', { name: 'Unknown service' })).toBeVisible()

  await page.getByRole('button', { name: 'Pause generation' }).click()
  await page.getByRole('button', { name: 'Reset generator' }).click()
  await expect(page.getByText('No confirmed signals')).toBeVisible()
})

test('fits controls and plots without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.getByText('DSP online')).toBeVisible()

  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    canvasWidths: [...document.querySelectorAll('canvas')].map(
      (canvas) => canvas.getBoundingClientRect().width,
    ),
    detectionWidth: document.querySelector('.detection-panel')?.getBoundingClientRect().width,
    detectionScrollWidth: document.querySelector('.detection-table-wrap')?.scrollWidth,
    detectionClientWidth: document.querySelector('.detection-table-wrap')?.clientWidth,
  }))
  expect(geometry.scrollWidth).toBe(geometry.clientWidth)
  expect(geometry.canvasWidths).toHaveLength(3)
  expect(geometry.canvasWidths.every((width) => width > 300 && width <= 390)).toBe(true)
  expect(geometry.detectionWidth).toBeLessThanOrEqual(390)
  expect(geometry.detectionScrollWidth).toBeGreaterThan(geometry.detectionClientWidth ?? 0)
})