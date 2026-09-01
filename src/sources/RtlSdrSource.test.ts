import { describe, expect, it, vi } from 'vitest'
import type { RtlDevice } from '@jtarrio/webrtlsdr/rtlsdr.js'
import { RtlSdrSource } from './RtlSdrSource'
import { DEFAULT_RTL_SDR_CONFIG } from './rtlSdrProtocol'
import type { RtlSdrWorkerEvent, RtlSdrWorkerRequest } from './rtlSdrWorkerProtocol'
import type { Usb, UsbDevice } from './webUsb'
import type { UsbDeviceSelection } from './UsbDeviceRegistry'

class FakeWorker {
  readonly messages: RtlSdrWorkerRequest[] = []
  readonly transfers: Transferable[][] = []
  readonly #messageListeners = new Set<(event: MessageEvent<RtlSdrWorkerEvent>) => void>()
  terminated = false

  postMessage(message: RtlSdrWorkerRequest, transfer: Transferable[] = []): void {
    this.messages.push(message)
    this.transfers.push(transfer)
    if (message.type === 'stop') queueMicrotask(() => this.emit({ type: 'stopped' }))
  }

  addEventListener(
    type: 'message' | 'error',
    listener: ((event: MessageEvent<RtlSdrWorkerEvent>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') {
      this.#messageListeners.add(listener as (event: MessageEvent<RtlSdrWorkerEvent>) => void)
    }
  }

  removeEventListener(
    type: 'message' | 'error',
    listener: ((event: MessageEvent<RtlSdrWorkerEvent>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') {
      this.#messageListeners.delete(listener as (event: MessageEvent<RtlSdrWorkerEvent>) => void)
    }
  }

  terminate(): void {
    this.terminated = true
  }

  emit(message: RtlSdrWorkerEvent): void {
    const event = { data: message } as MessageEvent<RtlSdrWorkerEvent>
    for (const listener of this.#messageListeners) listener(event)
  }
}

function createUsb(paired = false): {
  usb: Usb
  device: UsbDevice
  requestDevice: ReturnType<typeof vi.fn>
} {
  const device = {
    vendorId: 0x0bda,
    productId: 0x2838,
    productName: 'RTL2838UHIDIR',
    serialNumber: '00000001',
  } as UsbDevice
  const requestDevice = vi.fn(async () => device)
  const usb = new EventTarget() as Usb
  usb.getDevices = vi.fn(async () => paired ? [device] : [])
  usb.requestDevice = requestDevice
  return { usb, device, requestDevice }
}

function configuredEvent(): RtlSdrWorkerEvent {
  return {
    type: 'configured',
    info: {
      productName: 'RTL2838UHIDIR',
      serialNumber: '00000001',
      tunerType: 'E4000',
      actualSampleRateHz: 2_400_000,
      actualCenterFrequencyHz: 100_000_000,
    },
  }
}

describe('RtlSdrSource', () => {
  it('uses a pinned registry selection without reopening the chooser', async () => {
    const worker = new FakeWorker()
    const { usb, device, requestDevice } = createUsb(false)
    const selection: UsbDeviceSelection = {
      id: 'rtl-sdr-8',
      kind: 'rtl-sdr',
      label: 'Bench RTL',
      device,
      vendorId: device.vendorId,
      productId: device.productId,
      serialNumber: device.serialNumber ?? null,
      acquisitionOwner: 'worker',
      connected: true,
    }
    const source = new RtlSdrSource(DEFAULT_RTL_SDR_CONFIG, {
      usb,
      createWorker: () => worker,
      selection,
    })

    const running = source.start(vi.fn())
    await vi.waitFor(() => expect(worker.messages[0]?.type).toBe('start'))
    expect(source.id).toBe('rtl-sdr-8')
    expect(source.label).toBe('Bench RTL')
    expect(requestDevice).not.toHaveBeenCalled()
    expect(worker.messages[0]).toMatchObject({
      identity: { serialNumber: '00000001' },
    })

    await source.stop()
    await running
  })

  it('authorizes the attached RTL2832U and returns DSP buffers', async () => {
    const worker = new FakeWorker()
    const { usb, requestDevice } = createUsb()
    const source = new RtlSdrSource(DEFAULT_RTL_SDR_CONFIG, {
      usb,
      createWorker: () => worker,
    })
    const sink = vi.fn(async (chunk) => ({
      buffer: chunk.iq.buffer as ArrayBuffer,
      dropped: false,
    }))

    const running = source.start(sink)
    await vi.waitFor(() => expect(worker.messages[0]?.type).toBe('start'))
    expect(requestDevice).toHaveBeenCalledWith({
      filters: [
        { vendorId: 0x0bda, productId: 0x2832 },
        { vendorId: 0x0bda, productId: 0x2838 },
      ],
    })
    expect(worker.messages[0]).toEqual({
      type: 'start',
      identity: {
        vendorId: 0x0bda,
        productId: 0x2838,
        serialNumber: '00000001',
        productName: 'RTL2838UHIDIR',
      },
      config: DEFAULT_RTL_SDR_CONFIG,
    })

    worker.emit(configuredEvent())
    const iq = new Float32Array(DEFAULT_RTL_SDR_CONFIG.fftSize * 2)
    worker.emit({
      type: 'samples',
      iq,
      sampleRateHz: 2_400_000,
      centerFrequencyHz: 100_000_000,
      sourceSequence: 7,
      timestampUs: 5_000n,
    })
    await vi.waitFor(() => expect(sink).toHaveBeenCalledOnce())
    expect(worker.messages).toContainEqual({ type: 'return-buffer', buffer: iq.buffer })

    await source.stop()
    await running
    expect(worker.terminated).toBe(true)
  })

  it('reuses one authorized receiver without reopening the chooser', async () => {
    const worker = new FakeWorker()
    const { usb, requestDevice } = createUsb(true)
    const source = new RtlSdrSource(DEFAULT_RTL_SDR_CONFIG, {
      usb,
      createWorker: () => worker,
    })

    const running = source.start(vi.fn())
    await vi.waitFor(() => expect(worker.messages[0]?.type).toBe('start'))
    expect(requestDevice).not.toHaveBeenCalled()

    await source.stop()
    await running
  })

  it('closes a page-owned device that finishes opening after stop', async () => {
    const worker = new FakeWorker()
    const { usb, device } = createUsb(true)
    const selection: UsbDeviceSelection = {
      id: 'rtl-sdr-page',
      kind: 'rtl-sdr',
      label: 'Page RTL',
      device,
      vendorId: device.vendorId,
      productId: device.productId,
      serialNumber: device.serialNumber ?? null,
      acquisitionOwner: 'page',
      connected: true,
    }
    let resolveOpen: ((device: RtlDevice) => void) | undefined
    const openDevice = vi.fn(() => new Promise<RtlDevice>((resolve) => {
      resolveOpen = resolve
    }))
    const enableBiasTee = vi.fn(async () => undefined)
    const close = vi.fn(async () => undefined)
    const source = new RtlSdrSource(DEFAULT_RTL_SDR_CONFIG, {
      usb,
      createWorker: () => worker,
      openDevice,
      selection,
    })

    const running = source.start(vi.fn())
    await vi.waitFor(() => expect(worker.messages[0]?.type).toBe('start-processing'))
    worker.emit({ type: 'processing-ready' })
    await vi.waitFor(() => expect(openDevice).toHaveBeenCalledOnce())

    await source.stop()
    await running
    resolveOpen?.({ enableBiasTee, close } as unknown as RtlDevice)
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce())

    expect(enableBiasTee).toHaveBeenCalledOnce()
    expect(enableBiasTee).toHaveBeenCalledWith(false)
  })

  it('clears continuous routes until a runtime retune is acknowledged', async () => {
    const worker = new FakeWorker()
    const { usb } = createUsb(true)
    const source = new RtlSdrSource(DEFAULT_RTL_SDR_CONFIG, {
      usb,
      createWorker: () => worker,
    })
    const rdsTargets = [{ channelCenterHz: 100_100_000, frequencyOffsetHz: 100_000 }]
    const vfos = [{
      id: 'vfo-1',
      frequencyHz: 100_100_000,
      mode: 'wbfm' as const,
      bandwidthHz: 200_000,
      squelchDbfs: -85,
      revision: 1,
    }]
    source.setRdsTargets(rdsTargets)
    source.setVfos(48_000, vfos)
    const running = source.start(vi.fn())
    await vi.waitFor(() => expect(worker.messages[0]?.type).toBe('start'))

    const retune = source.applyRuntimeCommand({
      type: 'set-center-frequency',
      centerFrequencyHz: 99_750_000,
    })
    await vi.waitFor(() => expect(worker.messages.some(
      (message) => message.type === 'apply-runtime-command',
    )).toBe(true))
    expect(worker.messages).toContainEqual({ type: 'set-rds-targets', targets: [] })
    expect(worker.messages).toContainEqual({
      type: 'set-vfos',
      outputSampleRateHz: 48_000,
      vfos: [],
    })
    const messageCountBeforeAck = worker.messages.length
    worker.emit({
      type: 'runtime-command-applied',
      requestId: 1,
      config: { ...DEFAULT_RTL_SDR_CONFIG, centerFrequencyHz: 99_750_000 },
    })
    await expect(retune).resolves.toMatchObject({ centerFrequencyHz: 99_750_000 })
    expect(worker.messages.slice(messageCountBeforeAck)).toEqual([
      { type: 'set-vfos', outputSampleRateHz: 48_000, vfos },
    ])

    await source.stop()
    await running
  })

  it('restores RDS targets and VFOs when a runtime retune fails', async () => {
    const worker = new FakeWorker()
    const { usb } = createUsb(true)
    const source = new RtlSdrSource(DEFAULT_RTL_SDR_CONFIG, {
      usb,
      createWorker: () => worker,
    })
    const rdsTargets = [{ channelCenterHz: 100_100_000, frequencyOffsetHz: 100_000 }]
    const vfos = [{
      id: 'vfo-1',
      frequencyHz: 100_100_000,
      mode: 'wbfm' as const,
      bandwidthHz: 200_000,
      squelchDbfs: -85,
      revision: 1,
    }]
    source.setRdsTargets(rdsTargets)
    source.setVfos(48_000, vfos)
    const running = source.start(vi.fn())
    await vi.waitFor(() => expect(worker.messages[0]?.type).toBe('start'))

    const retune = source.applyRuntimeCommand({
      type: 'set-center-frequency',
      centerFrequencyHz: 99_750_000,
    })
    const rejected = expect(retune).rejects.toThrow('Tuning failed.')
    await vi.waitFor(() => expect(worker.messages.some(
      (message) => message.type === 'apply-runtime-command',
    )).toBe(true))
    worker.emit({ type: 'runtime-command-error', requestId: 1, message: 'Tuning failed.' })
    await rejected

    expect(worker.messages.filter((message) => message.type === 'set-rds-targets').at(-1))
      .toEqual({ type: 'set-rds-targets', targets: rdsTargets })
    expect(worker.messages.filter((message) => message.type === 'set-vfos').at(-1))
      .toEqual({ type: 'set-vfos', outputSampleRateHz: 48_000, vfos })
    await source.stop()
    await running
  })

  it('rejects a chooser cancellation without creating a worker', async () => {
    const usb = new EventTarget() as Usb
    usb.getDevices = vi.fn(async () => [])
    usb.requestDevice = vi.fn(async () => {
      throw new DOMException('No device selected.', 'NotFoundError')
    })
    const createWorker = vi.fn(() => new FakeWorker())
    const source = new RtlSdrSource(DEFAULT_RTL_SDR_CONFIG, { usb, createWorker })

    await expect(source.start(vi.fn())).rejects.toThrow('No device selected.')
    expect(createWorker).not.toHaveBeenCalled()
  })
})