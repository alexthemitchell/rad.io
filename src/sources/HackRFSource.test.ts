import { describe, expect, it, vi } from 'vitest'
import { HackRFSource } from './HackRFSource'
import { DEFAULT_HACKRF_CONFIG } from './hackrfProtocol'
import type { HackRfWorkerEvent, HackRfWorkerRequest } from './hackrfWorkerProtocol'
import type { RdsReception } from '../workers/protocol'
import type { Usb, UsbDevice } from './webUsb'

class FakeWorker {
  readonly messages: HackRfWorkerRequest[] = []
  readonly transfers: Transferable[][] = []
  readonly #messageListeners = new Set<(event: MessageEvent<HackRfWorkerEvent>) => void>()
  readonly #errorListeners = new Set<(event: ErrorEvent) => void>()
  terminated = false

  postMessage(message: HackRfWorkerRequest, transfer: Transferable[] = []): void {
    this.messages.push(message)
    this.transfers.push(transfer)
    if (message.type === 'stop') queueMicrotask(() => this.emit({ type: 'stopped' }))
  }

  addEventListener(
    type: 'message' | 'error',
    listener: ((event: MessageEvent<HackRfWorkerEvent>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') {
      this.#messageListeners.add(listener as (event: MessageEvent<HackRfWorkerEvent>) => void)
    } else {
      this.#errorListeners.add(listener as (event: ErrorEvent) => void)
    }
  }

  removeEventListener(
    type: 'message' | 'error',
    listener: ((event: MessageEvent<HackRfWorkerEvent>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') {
      this.#messageListeners.delete(listener as (event: MessageEvent<HackRfWorkerEvent>) => void)
    } else {
      this.#errorListeners.delete(listener as (event: ErrorEvent) => void)
    }
  }

  terminate(): void {
    this.terminated = true
  }

  emit(message: HackRfWorkerEvent): void {
    const event = { data: message } as MessageEvent<HackRfWorkerEvent>
    for (const listener of this.#messageListeners) listener(event)
  }
}

function createUsb(
  worker: FakeWorker,
  paired = false,
): { usb: Usb; requestDevice: ReturnType<typeof vi.fn> } {
  const device = {
    vendorId: 0x1d50,
    productId: 0x6089,
    serialNumber: 'test-radio',
  } as UsbDevice
  const requestDevice = vi.fn(async () => device)
  const usb = new EventTarget() as Usb
  usb.getDevices = vi.fn(async () => (paired ? [device] : []))
  usb.requestDevice = requestDevice
  void worker
  return { usb, requestDevice }
}

describe('HackRFSource', () => {
  it('requests the device and returns released DSP buffers to the worker', async () => {
    const worker = new FakeWorker()
    const { usb, requestDevice } = createUsb(worker)
    const source = new HackRFSource(DEFAULT_HACKRF_CONFIG, {
      usb,
      createWorker: () => worker,
    })
    const sink = vi.fn(async (chunk) => ({
      buffer: chunk.iq.buffer as ArrayBuffer,
      dropped: false,
    }))

    const running = source.start(sink)
    await vi.waitFor(() => expect(worker.messages[0]?.type).toBe('start'))
    const iq = new Float32Array(DEFAULT_HACKRF_CONFIG.fftSize * 2)
    worker.emit({
      type: 'samples',
      iq,
      sampleRateHz: 2_000_000,
      centerFrequencyHz: 100_000_000,
      sourceSequence: 41,
      timestampUs: 12_345n,
    })
    await vi.waitFor(() => expect(sink).toHaveBeenCalledOnce())
    await vi.waitFor(() =>
      expect(worker.messages.some((message) => message.type === 'return-buffer')).toBe(true),
    )

    expect(requestDevice).toHaveBeenCalledWith({
      filters: [{ vendorId: 0x1d50, productId: 0x6089 }],
    })
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        sampleRateHz: 2_000_000,
        centerFrequencyHz: 100_000_000,
        sequence: 41,
        timestampUs: 12_345n,
        formatVersion: 1,
      }),
    )

    await source.stop()
    await running
    expect(worker.terminated).toBe(true)
  })

  it('reuses an authorized HackRF without opening the device chooser', async () => {
    const worker = new FakeWorker()
    const { usb, requestDevice } = createUsb(worker, true)
    const source = new HackRFSource(DEFAULT_HACKRF_CONFIG, {
      usb,
      createWorker: () => worker,
    })

    const running = source.start(vi.fn())
    await vi.waitFor(() => expect(worker.messages[0]?.type).toBe('start'))

    expect(usb.getDevices).toHaveBeenCalledOnce()
    expect(requestDevice).not.toHaveBeenCalled()

    await source.stop()
    await running
  })

  it('acknowledges runtime retuning before delivering samples at the new center', async () => {
    const worker = new FakeWorker()
    const { usb } = createUsb(worker, true)
    const source = new HackRFSource(DEFAULT_HACKRF_CONFIG, {
      usb,
      createWorker: () => worker,
    })
    const sink = vi.fn(async (chunk) => ({
      buffer: chunk.iq.buffer as ArrayBuffer,
      dropped: false,
    }))
    source.setRdsTargets([
      { channelCenterHz: 100_100_000, frequencyOffsetHz: 100_000 },
    ])
    const running = source.start(sink)
    await vi.waitFor(() => expect(worker.messages[0]?.type).toBe('start'))

    const appliedPromise = source.applyRuntimeCommand({
      type: 'set-center-frequency',
      centerFrequencyHz: 100_250_000,
    })
    await vi.waitFor(() =>
      expect(worker.messages.some((message) => message.type === 'apply-runtime-command')).toBe(true),
    )
    const runtimeRequest = worker.messages.find(
      (message) => message.type === 'apply-runtime-command',
    )
    expect(worker.messages).toContainEqual({ type: 'set-rds-targets', targets: [] })
    expect(runtimeRequest).toEqual({
      type: 'apply-runtime-command',
      requestId: 1,
      command: { type: 'set-center-frequency', centerFrequencyHz: 100_250_000 },
    })

    worker.emit({
      type: 'runtime-command-applied',
      requestId: 1,
      config: { ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 100_250_000 },
    })
    await expect(appliedPromise).resolves.toEqual({
      ...DEFAULT_HACKRF_CONFIG,
      centerFrequencyHz: 100_250_000,
    })

    const iq = new Float32Array(DEFAULT_HACKRF_CONFIG.fftSize * 2)
    worker.emit({
      type: 'samples',
      iq,
      sampleRateHz: 2_000_000,
      centerFrequencyHz: 100_250_000,
      sourceSequence: 42,
      timestampUs: 100_000n,
    })
    await vi.waitFor(() => expect(sink).toHaveBeenCalledOnce())
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ centerFrequencyHz: 100_250_000, sequence: 42 }),
    )

    await source.stop()
    await running
  })

  it('rejects an unacknowledged runtime command when reception stops', async () => {
    const worker = new FakeWorker()
    const { usb } = createUsb(worker, true)
    const source = new HackRFSource(DEFAULT_HACKRF_CONFIG, {
      usb,
      createWorker: () => worker,
    })
    const running = source.start(vi.fn())
    await vi.waitFor(() => expect(worker.messages[0]?.type).toBe('start'))

    const pending = source.applyRuntimeCommand({ type: 'set-vga-gain', vgaGainDb: 22 })
    const pendingRejection = expect(pending).rejects.toThrow(/stopped before applying/)
    const stopping = source.stop()
    await expect(
      source.applyRuntimeCommand({ type: 'set-vga-gain', vgaGainDb: 24 }),
    ).rejects.toThrow(/not active/)
    await stopping
    await pendingRejection
    await running
  })

  it('restores RDS targets when a runtime retune fails', async () => {
    const worker = new FakeWorker()
    const { usb } = createUsb(worker, true)
    const source = new HackRFSource(DEFAULT_HACKRF_CONFIG, {
      usb,
      createWorker: () => worker,
    })
    const targets = [{ channelCenterHz: 100_100_000, frequencyOffsetHz: 100_000 }]
    source.setRdsTargets(targets)
    const running = source.start(vi.fn())
    await vi.waitFor(() => expect(worker.messages[0]?.type).toBe('start'))

    const retune = source.applyRuntimeCommand({
      type: 'set-center-frequency',
      centerFrequencyHz: 99_850_000,
    })
    const rejected = expect(retune).rejects.toThrow('Tuning failed.')
    await vi.waitFor(() =>
      expect(worker.messages.some((message) => message.type === 'apply-runtime-command')).toBe(true),
    )
    worker.emit({ type: 'runtime-command-error', requestId: 1, message: 'Tuning failed.' })
    await rejected

    expect(worker.messages.filter((message) => message.type === 'set-rds-targets').at(-1))
      .toEqual({ type: 'set-rds-targets', targets })
    await source.stop()
    await running
  })

  it('forwards RDS targets and delivers decoded metadata separately from IQ', async () => {
    const worker = new FakeWorker()
    const { usb } = createUsb(worker, true)
    const source = new HackRFSource(DEFAULT_HACKRF_CONFIG, {
      usb,
      createWorker: () => worker,
    })
    const rdsSink = vi.fn()
    source.setRdsTargets([
      { channelCenterHz: 100_100_000, frequencyOffsetHz: 100_000 },
    ])

    const running = source.start(vi.fn(), rdsSink)
    await vi.waitFor(() =>
      expect(worker.messages).toContainEqual({
        type: 'set-rds-targets',
        targets: [{ channelCenterHz: 100_100_000, frequencyOffsetHz: 100_000 }],
      }),
    )
    const reception: RdsReception = {
      channelCenterHz: 100_100_000,
      state: 'locked',
      reason: null,
      metadata: null,
      diagnostics: {
        synchronized: true,
        validGroups: 2,
        correctedBlocks: 0,
        rejectedGroups: 0,
        lostSyncCount: 0,
        lastValidGroupAtUs: 500_000n,
      },
    }

    worker.emit({ type: 'rds-update', receptions: [reception] })

    expect(rdsSink).toHaveBeenCalledWith([reception])
    await source.stop()
    await running
  })

  it('surfaces permission cancellation without creating a worker', async () => {
    const usb = new EventTarget() as Usb
    usb.getDevices = vi.fn(async () => [])
    usb.requestDevice = vi.fn(async () => {
      throw new DOMException('No device selected.', 'NotFoundError')
    })
    const createWorker = vi.fn(() => new FakeWorker())
    const source = new HackRFSource(DEFAULT_HACKRF_CONFIG, { usb, createWorker })

    await expect(source.start(vi.fn())).rejects.toThrow('No device selected.')
    expect(createWorker).not.toHaveBeenCalled()
  })

  it('stops the acquisition worker before surfacing a sink failure', async () => {
    const worker = new FakeWorker()
    const { usb } = createUsb(worker)
    const source = new HackRFSource(DEFAULT_HACKRF_CONFIG, {
      usb,
      createWorker: () => worker,
    })
    const running = source.start(async () => {
      throw new Error('DSP rejected the input buffer.')
    })
    await vi.waitFor(() => expect(worker.messages[0]?.type).toBe('start'))

    worker.emit({
      type: 'samples',
      iq: new Float32Array(DEFAULT_HACKRF_CONFIG.fftSize * 2),
      sampleRateHz: 2_000_000,
      centerFrequencyHz: 100_000_000,
      sourceSequence: 1,
      timestampUs: 0n,
    })

    await expect(running).rejects.toThrow('DSP rejected the input buffer.')
    expect(worker.messages.at(-1)).toEqual({ type: 'stop' })
    expect(worker.terminated).toBe(true)
  })
})