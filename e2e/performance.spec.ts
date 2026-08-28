import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

type TimingSummary = {
  meanMs: number
  p95Ms: number
  maximumMs: number
}

type WorkerMeasurement = {
  sampleRateHz: number
  fftSize: number
  processing: TimingSummary
  inputRelease: TimingSummary
  frameRoundTrip: TimingSummary
}

type RendererMeasurement = {
  renderer: string
  meanMs: number
}

type RdsMeasurement = {
  sampleRateHz: number
  targetCount: number
  throughputMsps: number
  realTimeHeadroom: number
}

type VfoMeasurement = {
  sampleRateHz: number
  workload: string
  throughputMsps: number
  realTimeHeadroom: number
  emittedSamples: number
}

test('records browser DSP worker and Canvas2D baselines', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'performance', 'Run with npm run benchmark:browser.')
  await page.goto('/')

  const report = await page.evaluate(async () => {
    const clientModulePath = '/src/workers/DspWorkerClient.ts'
    const protocolModulePath = '/src/workers/protocol.ts'
    const spectrumModulePath = '/src/renderers/SpectrumRenderer.ts'
    const waterfallModulePath = '/src/renderers/WaterfallRenderer.ts'
    const waveformModulePath = '/src/renderers/WaveformRenderer.ts'
    const rdsModulePath = '/src/rds/RdsWasmDecoder.ts'
    const vfoModulePath = '/src/vfo/VfoWasmProcessor.ts'
    const { DspWorkerClient } = await import(clientModulePath)
    const { DEFAULT_GENERATOR_CONFIG } = await import(protocolModulePath)
    const { SpectrumRenderer } = await import(spectrumModulePath)
    const { WaterfallRenderer } = await import(waterfallModulePath)
    const { WaveformRenderer } = await import(waveformModulePath)
    const { RdsWasmDecoder } = await import(rdsModulePath)
    const { VfoWasmProcessor } = await import(vfoModulePath)

    const summarize = (values: number[]) => {
      const sorted = [...values].sort((left, right) => left - right)
      return {
        meanMs: values.reduce((sum, value) => sum + value, 0) / values.length,
        p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
        maximumMs: sorted[sorted.length - 1],
      }
    }

    const client = new DspWorkerClient()
    await client.initialize()
    const measurements: WorkerMeasurement[] = []
    let sourceSequence = 0
    let rendererFrame: Parameters<InstanceType<typeof SpectrumRenderer>['draw']>[0]

    for (const sampleRateHz of [2_400_000, 10_000_000, 20_000_000]) {
      for (const fftSize of [1024, 2048, 4096] as const) {
        client.configure({
          ...DEFAULT_GENERATOR_CONFIG,
          sampleRateHz,
          fftSize,
          toneFrequencyHz: sampleRateHz / 16,
        })

        let iq = new Float32Array(fftSize * 2)
        for (let index = 0; index < fftSize; index += 1) {
          const phase = (Math.PI * 2 * index) / 16
          iq[index * 2] = Math.cos(phase) * 0.25
          iq[index * 2 + 1] = Math.sin(phase) * 0.25
        }

        const processingTimes: number[] = []
        const releaseTimes: number[] = []
        const roundTripTimes: number[] = []
        for (let iteration = 0; iteration < 35; iteration += 1) {
          sourceSequence += 1
          let releaseTime = Number.NaN
          const startedAt = performance.now()
          const framePromise = new Promise<Parameters<InstanceType<typeof SpectrumRenderer>['draw']>[0]>(
            (resolve) => {
              const unsubscribe = client.onFrame((frame) => {
                unsubscribe()
                client.frameConsumed(frame.sequence)
                resolve(frame)
              })
            },
          )
          const releasePromise = client
            .processSamples(iq, {
              sampleRateHz,
              centerFrequencyHz: 100_000_000,
              sourceSequence,
              timestampUs: BigInt(sourceSequence * 1_000),
              formatVersion: 1,
            })
            .then((release) => {
              releaseTime = performance.now() - startedAt
              return release
            })
          const [frame, release] = await Promise.all([framePromise, releasePromise])
          if (release.dropped) throw new Error('Benchmark input was dropped.')
          iq = new Float32Array(release.buffer)

          if (iteration >= 5) {
            processingTimes.push(frame.processingTimeMs)
            releaseTimes.push(releaseTime)
            roundTripTimes.push(performance.now() - startedAt)
          }
          rendererFrame = frame
        }

        measurements.push({
          sampleRateHz,
          fftSize,
          processing: summarize(processingTimes),
          inputRelease: summarize(releaseTimes),
          frameRoundTrip: summarize(roundTripTimes),
        })
      }
    }

    const rdsIq = new Int8Array(16 * 1_024)
    for (let index = 0; index < rdsIq.length; index += 2) {
      const phase = (Math.PI * 2 * 97_000 * (index / 2)) / 20_000_000
      rdsIq[index] = Math.round(Math.cos(phase) * 80)
      rdsIq[index + 1] = Math.round(Math.sin(phase) * 80)
    }
    const rdsBlockSamples = rdsIq.length / 2
    const vfo: VfoMeasurement[] = []
    const vfoWorkloads = [
      { name: '1 WBFM', modes: ['wbfm'] },
      { name: '4 WBFM', modes: ['wbfm', 'wbfm', 'wbfm', 'wbfm'] },
      { name: '4 mixed', modes: ['wbfm', 'am', 'nbfm', 'nbfm'] },
    ] as const
    for (const sampleRateHz of [2_400_000, 10_000_000, 20_000_000]) {
      for (const workload of vfoWorkloads) {
        const processor = await VfoWasmProcessor.create()
        const offsetsHz = [-300_000, -100_000, 100_000, 300_000]
        processor.configure(
          sampleRateHz,
          100_000_000,
          48_000,
          workload.modes.map((mode, index) => ({
            id: `vfo-${index + 1}`,
            frequencyHz: 100_000_000 + offsetsHz[index],
            mode,
            bandwidthHz: mode === 'wbfm' ? 200_000 : mode === 'am' ? 10_000 : 12_500,
            squelchDbfs: -120,
            revision: 1,
          })),
        )
        let timestampUs = 0n
        let emittedSamples = 0
        const blockDurationUs = BigInt(
          Math.floor((rdsBlockSamples * 1_000_000) / sampleRateHz),
        )
        for (let iteration = 0; iteration < 10; iteration += 1) {
          emittedSamples += processor
            .processI8(rdsIq, timestampUs)
            .reduce((sum, block) => sum + block.samples.length, 0)
          timestampUs += blockDurationUs
        }
        const startedAt = performance.now()
        let iterations = 0
        while (performance.now() - startedAt < 200) {
          emittedSamples += processor
            .processI8(rdsIq, timestampUs)
            .reduce((sum, block) => sum + block.samples.length, 0)
          timestampUs += blockDurationUs
          iterations += 1
        }
        const elapsedSeconds = (performance.now() - startedAt) / 1_000
        const throughputMsps =
          (rdsBlockSamples * iterations) / elapsedSeconds / 1_000_000
        vfo.push({
          sampleRateHz,
          workload: workload.name,
          throughputMsps,
          realTimeHeadroom: (throughputMsps * 1_000_000) / sampleRateHz,
          emittedSamples,
        })
        processor.dispose()
      }
    }
    client.terminate()

    const rds: RdsMeasurement[] = []
    for (const sampleRateHz of [2_400_000, 10_000_000, 20_000_000]) {
      for (const targetCount of [1, 2, 4]) {
        const decoder = await RdsWasmDecoder.create(sampleRateHz)
        decoder.setTargets(
          [-300_000, -100_000, 100_000, 300_000]
            .slice(0, targetCount)
            .map((frequencyOffsetHz, index) => ({
              channelCenterHz: 99_900_000 + index * 200_000,
              frequencyOffsetHz,
            })),
        )
        let timestampUs = 0n
        const blockDurationUs = BigInt(
          Math.floor((rdsBlockSamples * 1_000_000) / sampleRateHz),
        )
        for (let iteration = 0; iteration < 10; iteration += 1) {
          decoder.process(rdsIq, timestampUs)
          timestampUs += blockDurationUs
        }
        const startedAt = performance.now()
        let iterations = 0
        while (performance.now() - startedAt < 200) {
          decoder.process(rdsIq, timestampUs)
          timestampUs += blockDurationUs
          iterations += 1
        }
        const elapsedSeconds = (performance.now() - startedAt) / 1_000
        const throughputMsps =
          (rdsBlockSamples * iterations) / elapsedSeconds / 1_000_000
        rds.push({
          sampleRateHz,
          targetCount,
          throughputMsps,
          realTimeHeadroom: (throughputMsps * 1_000_000) / sampleRateHz,
        })
        decoder.dispose()
      }
    }

    if (!rendererFrame) throw new Error('The DSP worker did not produce a renderer frame.')

    const measureRenderer = (
      renderer: { draw: (frame: typeof rendererFrame) => void },
      canvas: HTMLCanvasElement,
      frame = rendererFrame,
    ) => {
      for (let iteration = 0; iteration < 5; iteration += 1) renderer.draw(frame)
      const startedAt = performance.now()
      for (let iteration = 0; iteration < 60; iteration += 1) renderer.draw(frame)
      canvas.getContext('2d')?.getImageData(0, 0, 1, 1)
      return (performance.now() - startedAt) / 60
    }

    const waveformFrame = (pointCount: number) => {
      const waveform = new Float32Array(pointCount * 2)
      const sourcePointCount = rendererFrame.waveform.length / 2
      for (let point = 0; point < pointCount; point += 1) {
        const sourcePoint = Math.round((point / (pointCount - 1)) * (sourcePointCount - 1))
        waveform[point * 2] = rendererFrame.waveform[sourcePoint * 2]
        waveform[point * 2 + 1] = rendererFrame.waveform[sourcePoint * 2 + 1]
      }
      return { ...rendererFrame, waveform }
    }

    const spectrumCanvas = document.createElement('canvas')
    const spectrumRenderer = new SpectrumRenderer(spectrumCanvas)
    spectrumRenderer.resize(1_200, 320, 2)
    const waterfallCanvas = document.createElement('canvas')
    const waterfallRenderer = new WaterfallRenderer(waterfallCanvas)
    waterfallRenderer.resize(1_200, 360, 2)
    const waveformCanvas = document.createElement('canvas')
    const waveformRenderer = new WaveformRenderer(waveformCanvas)
    waveformRenderer.resize(1_200, 240, 2)

    const renderers: RendererMeasurement[] = [
      {
        renderer: 'spectrum',
        meanMs: measureRenderer(spectrumRenderer, spectrumCanvas),
      },
      {
        renderer: 'waterfall',
        meanMs: measureRenderer(waterfallRenderer, waterfallCanvas),
      },
      {
        renderer: 'waveform-256',
        meanMs: measureRenderer(waveformRenderer, waveformCanvas, waveformFrame(256)),
      },
      {
        renderer: 'waveform-512',
        meanMs: measureRenderer(waveformRenderer, waveformCanvas, waveformFrame(512)),
      },
      {
        renderer: 'waveform-1024',
        meanMs: measureRenderer(waveformRenderer, waveformCanvas, waveformFrame(1_024)),
      },
    ]

    return {
      environment: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        crossOriginIsolated: globalThis.crossOriginIsolated,
        sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
        webGpu: 'gpu' in navigator,
      },
      worker: measurements,
      rds,
      vfo,
      renderers,
    }
  })

  const serializedReport = `${JSON.stringify(report, null, 2)}\n`
  const reportPath = testInfo.outputPath('browser-performance.json')
  await writeFile(reportPath, serializedReport, 'utf8')
  await testInfo.attach('browser-performance.json', {
    path: reportPath,
    contentType: 'application/json',
  })
  console.log(`Browser performance baseline:\n${serializedReport}`)

  expect(report.worker).toHaveLength(9)
  for (const measurement of report.worker) {
    expect(measurement.processing.meanMs).toBeGreaterThan(0)
    expect(measurement.inputRelease.meanMs).toBeGreaterThan(0)
    expect(measurement.frameRoundTrip.meanMs).toBeGreaterThanOrEqual(
      measurement.inputRelease.meanMs,
    )
  }
  for (const renderer of report.renderers) {
    expect(renderer.meanMs).toBeGreaterThan(0)
  }
  for (const measurement of report.rds) {
    expect(measurement.throughputMsps).toBeGreaterThan(0)
    expect(measurement.realTimeHeadroom).toBeGreaterThan(0)
  }
  for (const measurement of report.vfo) {
    expect(measurement.throughputMsps).toBeGreaterThan(0)
    expect(measurement.realTimeHeadroom).toBeGreaterThan(1)
    expect(measurement.emittedSamples).toBeGreaterThan(0)
  }
})
