import { describe, expect, it, vi } from 'vitest'
import { DirectSampling, type RtlDevice, type SampleBlock } from '@jtarrio/webrtlsdr/rtlsdr.js'
import { RtlSdrDeviceSession } from './RtlSdrDeviceSession'
import { DEFAULT_RTL_SDR_CONFIG } from './rtlSdrProtocol'

function sampleBlock(value = 128): SampleBlock {
  return {
    frequency: DEFAULT_RTL_SDR_CONFIG.centerFrequencyHz,
    directSampling: false,
    data: new Uint8Array(65_536 * 2).fill(value).buffer,
  }
}

function createDevice(readSamples?: () => Promise<SampleBlock>): RtlDevice & {
  calls: string[]
  readSamples: ReturnType<typeof vi.fn>
  enableBiasTee: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
} {
  const calls: string[] = []
  return {
    calls,
    setSampleRate: vi.fn(async (rate: number) => {
      calls.push(`rate:${rate}`)
      return rate
    }),
    setFrequencyCorrection: vi.fn(async (ppm: number) => {
      calls.push(`ppm:${ppm}`)
    }),
    getFrequencyCorrection: vi.fn(() => 0),
    setGain: vi.fn(async (gain: number | null) => {
      calls.push(`gain:${gain ?? 'auto'}`)
    }),
    getGain: vi.fn(() => null),
    setCenterFrequency: vi.fn(async (frequencyHz: number) => {
      calls.push(`center:${frequencyHz}`)
      return frequencyHz
    }),
    setDirectSamplingMethod: vi.fn(async (mode: DirectSampling) => {
      calls.push(`direct:${mode}`)
    }),
    getDirectSamplingMethod: vi.fn(() => DirectSampling.Off),
    enableBiasTee: vi.fn(async (enabled: boolean) => {
      calls.push(`bias:${enabled}`)
    }),
    isBiasTeeEnabled: vi.fn(() => false),
    resetBuffer: vi.fn(async () => {
      calls.push('reset')
    }),
    readSamples: vi.fn(readSamples ?? (async () => sampleBlock())),
    close: vi.fn(async () => {
      calls.push('close')
    }),
  }
}

describe('RtlSdrDeviceSession', () => {
  it('configures safely, converts unsigned IQ, and shuts bias off', async () => {
    const device = createDevice(async () => sampleBlock(0))
    const rawSamples: number[] = []
    const displaySamples: number[] = []
    const session = new RtlSdrDeviceSession(device, DEFAULT_RTL_SDR_CONFIG, {
      onRawSamples: ({ iq }) => rawSamples.push(iq[0]),
      onSamples: ({ iq }) => {
        displaySamples.push(iq[0])
        void session.stop()
      },
    })

    await session.start()

    expect(device.calls.slice(0, 7)).toEqual([
      'bias:false',
      'rate:2400000',
      'ppm:0',
      `direct:${DirectSampling.Off}`,
      'gain:auto',
      'center:100000000',
      'reset',
    ])
    expect(rawSamples).toEqual([-128])
    expect(displaySamples).toEqual([0])
    expect(device.calls.slice(-2)).toEqual(['bias:false', 'close'])
  })

  it('queues the next read before processing the current block', async () => {
    const device = createDevice(async () => sampleBlock())
    let readsDuringCallback = 0
    const session = new RtlSdrDeviceSession(device, DEFAULT_RTL_SDR_CONFIG, {
      onRawSamples: () => {
        readsDuringCallback = device.readSamples.mock.calls.length
        void session.stop()
      },
      onSamples: vi.fn(),
    })

    await session.start()

    expect(readsDuringCallback).toBe(3)
    for (const call of device.readSamples.mock.calls) expect(call).toEqual([65_536])
  })

  it('reuses one returned display buffer and rejects a duplicate return', async () => {
    const device = createDevice(async () => sampleBlock())
    const buffers: ArrayBuffer[] = []
    let duplicateReturnError: Error | undefined
    const session = new RtlSdrDeviceSession(
      device,
      { ...DEFAULT_RTL_SDR_CONFIG, frameRate: 60 },
      {
        onSamples: ({ iq }) => {
          const buffer = iq.buffer as ArrayBuffer
          buffers.push(buffer)
          if (buffers.length === 1) {
            session.returnBuffer(buffer)
            try {
              session.returnBuffer(buffer)
            } catch (error) {
              duplicateReturnError = error as Error
            }
          } else {
            void session.stop()
          }
        },
      },
    )

    await session.start()

    expect(buffers).toHaveLength(2)
    expect(buffers[1]).toBe(buffers[0])
    expect(duplicateReturnError?.message).toMatch(/more than once/)
  })

  it('enables an armed bias tee only after RF configuration and disables it on stop', async () => {
    const device = createDevice(async () => sampleBlock())
    const session = new RtlSdrDeviceSession(
      device,
      { ...DEFAULT_RTL_SDR_CONFIG, biasTeeEnabled: true },
      {
        onSamples: () => void session.stop(),
      },
    )

    await session.start()

    expect(device.calls.filter((call) => call.startsWith('bias:'))).toEqual([
      'bias:false',
      'bias:true',
      'bias:false',
    ])
    expect(device.calls.indexOf('bias:true')).toBeGreaterThan(device.calls.indexOf('center:100000000'))
  })

  it('applies retunes serially and marks a discontinuity', async () => {
    const releaseReads: Array<(block: SampleBlock) => void> = []
    const device = createDevice(() => new Promise<SampleBlock>((resolve) => {
      releaseReads.push(resolve)
    }))
    let resolveConfigured: (() => void) | undefined
    const configured = new Promise<void>((resolve) => {
      resolveConfigured = resolve
    })
    const onDiscontinuity = vi.fn()
    const session = new RtlSdrDeviceSession(device, DEFAULT_RTL_SDR_CONFIG, {
      onConfigured: () => resolveConfigured?.(),
      onDiscontinuity,
      onSamples: vi.fn(),
    })
    const running = session.start()
    await configured

    const retune = session.applyRuntimeCommand({
      type: 'set-center-frequency',
      centerFrequencyHz: 99_750_000,
    })
    await vi.waitFor(() => expect(device.readSamples).toHaveBeenCalledTimes(2))
    expect(device.calls).not.toContain('center:99750000')
    for (const releaseRead of [...releaseReads]) releaseRead(sampleBlock())
    await expect(retune).resolves.toMatchObject({ centerFrequencyHz: 99_750_000 })
    expect(onDiscontinuity).toHaveBeenCalledOnce()
    expect(device.calls.filter((call) => call === 'reset')).toHaveLength(2)

    const stopping = session.stop()
    for (const releaseRead of releaseReads.slice(2)) releaseRead(sampleBlock())
    await stopping
    await running
  })

  it('recovers from one bulk read failure after a retune', async () => {
    const initialReads: Array<(block: SampleBlock) => void> = []
    let readCount = 0
    const device = createDevice(() => {
      readCount += 1
      if (readCount <= 2) {
        return new Promise<SampleBlock>((resolve) => initialReads.push(resolve))
      }
      if (readCount === 3) return Promise.reject(new Error('transient transfer failure'))
      return Promise.resolve(sampleBlock(192))
    })
    let resolveConfigured: (() => void) | undefined
    const configured = new Promise<void>((resolve) => {
      resolveConfigured = resolve
    })
    const onDiscontinuity = vi.fn()
    const onRawSamples = vi.fn(() => void session.stop())
    const session = new RtlSdrDeviceSession(device, DEFAULT_RTL_SDR_CONFIG, {
      onConfigured: () => resolveConfigured?.(),
      onRawSamples,
      onDiscontinuity,
      onSamples: vi.fn(),
    })
    const running = session.start()
    await configured

    const retune = session.applyRuntimeCommand({
      type: 'set-center-frequency',
      centerFrequencyHz: 99_750_000,
    })
    await vi.waitFor(() => expect(initialReads).toHaveLength(2))
    for (const releaseRead of initialReads) releaseRead(sampleBlock())
    await retune
    await running

    expect(onRawSamples).toHaveBeenCalled()
    expect(onDiscontinuity).toHaveBeenCalledTimes(2)
    expect(device.readSamples.mock.calls.length).toBeGreaterThanOrEqual(4)
  })

  it('serializes rapid runtime commands while reads remain queued', async () => {
    const releaseReads: Array<(block: SampleBlock) => void> = []
    const device = createDevice(() => new Promise<SampleBlock>((resolve) => {
      releaseReads.push(resolve)
    }))
    let resolveConfigured: (() => void) | undefined
    const configured = new Promise<void>((resolve) => {
      resolveConfigured = resolve
    })
    const session = new RtlSdrDeviceSession(device, DEFAULT_RTL_SDR_CONFIG, {
      onConfigured: () => resolveConfigured?.(),
      onSamples: vi.fn(),
    })
    const running = session.start()
    await configured

    const gain = session.applyRuntimeCommand({
      type: 'set-tuner-gain',
      tunerGainDb: 24,
    })
    const bias = session.applyRuntimeCommand({
      type: 'set-bias-tee',
      biasTeeEnabled: true,
    })
    await expect(gain).resolves.toMatchObject({ tunerGainDb: 24 })
    await expect(bias).resolves.toMatchObject({ tunerGainDb: 24, biasTeeEnabled: true })
    expect(device.calls.indexOf('gain:24')).toBeLessThan(device.calls.indexOf('bias:true'))

    const firstStop = session.stop()
    const secondStop = session.stop()
    for (const releaseRead of releaseReads) releaseRead(sampleBlock())
    await Promise.all([firstStop, secondStop, running])
    expect(device.close).toHaveBeenCalledOnce()
  })
})