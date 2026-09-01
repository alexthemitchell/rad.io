import type { RtlDevice } from '@jtarrio/webrtlsdr/rtlsdr.js'
import type { AnalyzerSource, RdsSink, SampleSink } from './types'
import { RtlSdrDeviceSession, type RtlSdrSampleBlock } from './RtlSdrDeviceSession'
import { openRtlSdrDevice } from './rtlSdrDevice'
import {
  RTL_SDR_USB_PRODUCT_IDS,
  RTL_SDR_USB_VENDOR_ID,
  validateRtlSdrConfig,
  type RtlSdrConfig,
  type RtlSdrRuntimeCommand,
} from './rtlSdrProtocol'
import type { RtlSdrWorkerEvent, RtlSdrWorkerRequest } from './rtlSdrWorkerProtocol'
import type { RdsDecodeTarget } from '../workers/protocol'
import type { VfoDspConfig } from '../vfo/types'
import { webUsbFromNavigator, type Usb, type UsbDevice } from './webUsb'
import type { UsbDeviceSelection } from './UsbDeviceRegistry'

type RtlSdrWorker = {
  postMessage(message: RtlSdrWorkerRequest, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (event: MessageEvent<RtlSdrWorkerEvent>) => void): void
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent<RtlSdrWorkerEvent>) => void): void
  removeEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
  terminate(): void
}

type RtlSdrSourceDependencies = {
  usb?: Usb
  createWorker?: () => RtlSdrWorker
  openDevice?: (device: UsbDevice) => Promise<RtlDevice>
  selection?: UsbDeviceSelection
}

export class RtlSdrSource implements AnalyzerSource {
  readonly id: string
  readonly label: string
  #config: RtlSdrConfig
  readonly #dependencies: RtlSdrSourceDependencies
  #sink: SampleSink | undefined
  #rdsSink: RdsSink | undefined
  #selectedDevice: UsbDevice | undefined
  #worker: RtlSdrWorker | undefined
  #fallbackSession: RtlSdrDeviceSession | undefined
  #rdsTargets: RdsDecodeTarget[] = []
  #vfos: VfoDspConfig[] = []
  #vfoOutputSampleRateHz = 48_000
  #vfoAudioPort: MessagePort | undefined
  #workerConfigured = false
  #resolveProcessingReady: (() => void) | undefined
  #rejectProcessingReady: ((error: Error) => void) | undefined
  #completion: Promise<void> | undefined
  #resolveCompletion: (() => void) | undefined
  #rejectCompletion: ((error: Error) => void) | undefined
  #intentionalStop = false
  #settled = false
  #fallbackStarted = false
  #terminalError: Error | undefined
  #runtimeRequestId = 0
  readonly #pendingRuntimeCommands = new Map<
    number,
    { resolve: (config: RtlSdrConfig) => void; reject: (error: Error) => void }
  >()

  constructor(config: RtlSdrConfig, dependencies: RtlSdrSourceDependencies = {}) {
    validateRtlSdrConfig(config)
    if (dependencies.selection && dependencies.selection.kind !== 'rtl-sdr') {
      throw new Error('RTL-SDR source requires an RTL-SDR device selection.')
    }
    this.id = dependencies.selection?.id ?? 'rtl-sdr-e4000'
    this.label = dependencies.selection?.label ?? 'RTL-SDR · E4000'
    this.#config = { ...config }
    this.#dependencies = dependencies
  }

  start(sink: SampleSink, rdsSink?: RdsSink): Promise<void> {
    if (this.#completion) throw new Error('RTL-SDR source is already active.')
    const usb = this.#dependencies.usb ?? webUsbFromNavigator(navigator)
    if (!usb && !this.#dependencies.selection) {
      throw new Error('WebUSB is unavailable. Use a secure-context desktop Chromium browser.')
    }
    this.#sink = sink
    this.#rdsSink = rdsSink
    this.#intentionalStop = false
    this.#settled = false
    this.#terminalError = undefined
    this.#completion = new Promise<void>((resolve, reject) => {
      this.#resolveCompletion = resolve
      this.#rejectCompletion = reject
    })
    void this.#requestAndStart(usb)
    return this.#completion
  }

  setRdsTargets(targets: readonly RdsDecodeTarget[]): void {
    this.#rdsTargets = [...targets]
    this.#worker?.postMessage({ type: 'set-rds-targets', targets: this.#rdsTargets })
  }

  setVfos(outputSampleRateHz: number, vfos: readonly VfoDspConfig[]): void {
    this.#vfoOutputSampleRateHz = outputSampleRateHz
    this.#vfos = [...vfos]
    this.#worker?.postMessage({
      type: 'set-vfos',
      outputSampleRateHz,
      vfos: this.#vfos,
    })
  }

  attachVfoAudioPort(port: MessagePort): void {
    this.#vfoAudioPort?.close()
    this.#vfoAudioPort = port
    this.#attachVfoAudioPortToWorker()
  }

  async applyRuntimeCommand(command: RtlSdrRuntimeCommand): Promise<RtlSdrConfig> {
    if (this.#intentionalStop || this.#settled || !this.#completion) {
      throw new Error('RTL-SDR source is not active.')
    }
    const resetsDsp = command.type === 'set-center-frequency' ||
      command.type === 'set-frequency-correction' ||
      command.type === 'set-direct-sampling'
    const previousRdsTargets = resetsDsp ? [...this.#rdsTargets] : null
    if (resetsDsp) {
      this.setRdsTargets([])
      this.#clearVfoProcessing()
    }

    try {
      if (this.#fallbackSession) {
        const config = await this.#fallbackSession.applyRuntimeCommand(command)
        this.#config = { ...config }
        if (resetsDsp) this.#worker?.postMessage({ type: 'configure-processing', config })
        return { ...config }
      }
      if (!this.#worker) throw new Error('RTL-SDR receiver is not running.')

      const requestId = ++this.#runtimeRequestId
      const result = new Promise<RtlSdrConfig>((resolve, reject) => {
        this.#pendingRuntimeCommands.set(requestId, { resolve, reject })
      })
      try {
        this.#worker.postMessage({ type: 'apply-runtime-command', requestId, command })
      } catch (error) {
        this.#pendingRuntimeCommands.delete(requestId)
        throw error
      }
      return await result
    } catch (error) {
      if (previousRdsTargets && !this.#intentionalStop && !this.#settled) {
        this.setRdsTargets(previousRdsTargets)
      }
      throw error
    } finally {
      if (resetsDsp && !this.#intentionalStop && !this.#settled) {
        this.setVfos(this.#vfoOutputSampleRateHz, this.#vfos)
      }
    }
  }

  async stop(): Promise<void> {
    this.#intentionalStop = true
    this.#terminalError = undefined
    if (this.#fallbackSession) await this.#fallbackSession.stop()
    else if (this.#worker) this.#worker.postMessage({ type: 'stop' })
    else this.#settle()
    await this.#completion
  }

  async #requestAndStart(usb: Usb | undefined): Promise<void> {
    try {
      const selection = this.#dependencies.selection
      let selectedDevice = selection?.device
      let authorizedDevices: UsbDevice[] = []
      if (!selectedDevice) {
        if (!usb) {
          throw new Error('WebUSB is unavailable. Use a secure-context desktop Chromium browser.')
        }
        authorizedDevices = (await usb.getDevices()).filter(isSupportedRtlSdr)
        selectedDevice = authorizedDevices.length === 1 ? authorizedDevices[0] : undefined
      }
      if (!selectedDevice) {
        if (!usb) {
          throw new Error('WebUSB is unavailable. Use a secure-context desktop Chromium browser.')
        }
        if (!usb.requestDevice) {
          const reason = authorizedDevices.length > 1
            ? 'Multiple authorized RTL-SDR devices are available, but device selection is unavailable.'
            : 'WebUSB device selection is unavailable. Use a secure-context desktop Chromium browser.'
          throw new Error(reason)
        }
        selectedDevice = await usb.requestDevice({
          filters: RTL_SDR_USB_PRODUCT_IDS.map((productId) => ({
            vendorId: RTL_SDR_USB_VENDOR_ID,
            productId,
          })),
        })
      }
      if (!isSupportedRtlSdr(selectedDevice)) {
        throw new Error('The selected USB device is not a supported RTL2832U receiver.')
      }
      if (this.#intentionalStop) {
        this.#settle()
        return
      }
      this.#selectedDevice = selectedDevice
      if (selection?.acquisitionOwner === 'page') {
        await this.#startPageFallback()
        return
      }
      const worker = this.#dependencies.createWorker?.() ?? this.#createWorker()
      this.#worker = worker
      this.#workerConfigured = false
      worker.addEventListener('message', this.#handleWorkerMessage)
      worker.addEventListener('error', this.#handleWorkerError)
      worker.postMessage({
        type: 'start',
        identity: {
          vendorId: selectedDevice.vendorId,
          productId: selectedDevice.productId,
          serialNumber: selectedDevice.serialNumber ?? null,
          productName: selectedDevice.productName ?? null,
        },
        config: this.#config,
      })
      worker.postMessage({ type: 'set-rds-targets', targets: this.#rdsTargets })
      worker.postMessage({
        type: 'set-vfos',
        outputSampleRateHz: this.#vfoOutputSampleRateHz,
        vfos: this.#vfos,
      })
    } catch (error) {
      this.#fail(error)
    }
  }

  #createWorker(): RtlSdrWorker {
    return new Worker(new URL('./rtl-sdr.worker.ts', import.meta.url), {
      type: 'module',
      name: `${this.id}-acquisition`,
    }) as RtlSdrWorker
  }

  readonly #handleWorkerMessage = (event: MessageEvent<RtlSdrWorkerEvent>): void => {
    const message = event.data
    if (message.type === 'configured') {
      this.#workerConfigured = true
      this.#attachVfoAudioPortToWorker()
    } else if (message.type === 'processing-ready') {
      this.#workerConfigured = true
      this.#attachVfoAudioPortToWorker()
      this.#resolveProcessingReady?.()
      this.#resolveProcessingReady = undefined
      this.#rejectProcessingReady = undefined
    } else if (message.type === 'samples') {
      void this.#deliver({
        iq: message.iq,
        sampleRateHz: message.sampleRateHz,
        centerFrequencyHz: message.centerFrequencyHz,
        sourceSequence: message.sourceSequence,
        timestampUs: message.timestampUs,
      })
    } else if (message.type === 'runtime-command-applied') {
      const pending = this.#pendingRuntimeCommands.get(message.requestId)
      if (!pending) return
      this.#pendingRuntimeCommands.delete(message.requestId)
      this.#config = { ...message.config }
      pending.resolve({ ...message.config })
    } else if (message.type === 'runtime-command-error') {
      const pending = this.#pendingRuntimeCommands.get(message.requestId)
      if (!pending) return
      this.#pendingRuntimeCommands.delete(message.requestId)
      pending.reject(new Error(message.message))
    } else if (message.type === 'rds-update') {
      this.#rdsSink?.(message.receptions)
    } else if (message.type === 'error') {
      if (
        (message.code === 'DEVICE_NOT_FOUND' || message.code === 'WEBUSB_UNAVAILABLE') &&
        !this.#fallbackStarted
      ) {
        void this.#startPageFallback()
      } else {
        const error = new Error(message.message)
        this.#rejectProcessingReady?.(error)
        this.#resolveProcessingReady = undefined
        this.#rejectProcessingReady = undefined
        this.#fail(error)
      }
    } else if (message.type === 'stopped') {
      if (this.#fallbackStarted && this.#fallbackSession) {
        if (!this.#intentionalStop) {
          this.#fail(new Error('RTL-SDR processing worker stopped unexpectedly.'))
        }
      } else if (this.#intentionalStop) {
        this.#settle()
      } else {
        this.#settle(this.#terminalError ?? new Error('RTL-SDR acquisition stopped unexpectedly.'))
      }
    }
  }

  readonly #handleWorkerError = (event: ErrorEvent): void => {
    const error = new Error(event.message || 'RTL-SDR acquisition worker failed.')
    if (this.#intentionalStop) this.#settle()
    else this.#settle(error)
  }

  async #startPageFallback(): Promise<void> {
    const usbDevice = this.#selectedDevice
    if (!usbDevice) {
      this.#fail(new Error('The selected RTL-SDR is unavailable.'))
      return
    }
    this.#fallbackStarted = true
    this.#disposeWorker()
    const worker = this.#dependencies.createWorker?.() ?? this.#createWorker()
    this.#worker = worker
    this.#workerConfigured = false
    worker.addEventListener('message', this.#handleWorkerMessage)
    worker.addEventListener('error', this.#handleWorkerError)
    const processingReady = new Promise<void>((resolve, reject) => {
      this.#resolveProcessingReady = resolve
      this.#rejectProcessingReady = reject
    })
    worker.postMessage({ type: 'start-processing', config: this.#config })
    worker.postMessage({ type: 'set-rds-targets', targets: this.#rdsTargets })
    worker.postMessage({
      type: 'set-vfos',
      outputSampleRateHz: this.#vfoOutputSampleRateHz,
      vfos: this.#vfos,
    })
    try {
      await processingReady
    } catch (error) {
      this.#fail(error)
      return
    }
    if (this.#intentionalStop) {
      worker.postMessage({ type: 'stop' })
      return
    }

    let device: RtlDevice
    try {
      device = this.#dependencies.openDevice
        ? await this.#dependencies.openDevice(usbDevice)
        : await openRtlSdrDevice(
            usbDevice as unknown as Parameters<typeof openRtlSdrDevice>[0],
          )
    } catch (error) {
      this.#fail(error)
      return
    }
    if (this.#intentionalStop || this.#settled) {
      try {
        await device.enableBiasTee(false)
      } catch {
        // The device may have disconnected while it was opening.
      }
      try {
        await device.close()
      } catch {
        // Closing a disconnected device is best-effort.
      }
      return
    }
    const session = new RtlSdrDeviceSession(device, this.#config, {
      onRawSamples: ({ iq, timestampUs }) => {
        worker.postMessage({ type: 'process-iq', iq, timestampUs }, [iq.buffer as ArrayBuffer])
      },
      onDiscontinuity: () => worker.postMessage({
        type: 'configure-processing',
        config: this.#config,
      }),
      onSamples: (block) => void this.#deliver(block),
    }, usbDevice)
    this.#fallbackSession = session
    try {
      await session.start()
      if (this.#intentionalStop) this.#settle()
      else this.#fail(new Error('RTL-SDR acquisition stopped unexpectedly.'))
    } catch (error) {
      this.#fail(error)
    }
  }

  async #deliver(block: RtlSdrSampleBlock): Promise<void> {
    const sink = this.#sink
    if (!sink || this.#settled) return
    try {
      const released = await sink({
        iq: block.iq,
        sampleRateHz: block.sampleRateHz,
        centerFrequencyHz: block.centerFrequencyHz,
        sequence: block.sourceSequence,
        timestampUs: block.timestampUs,
        formatVersion: 1,
      })
      if (this.#fallbackSession) this.#fallbackSession.returnBuffer(released.buffer)
      else if (this.#worker) {
        this.#worker.postMessage(
          { type: 'return-buffer', buffer: released.buffer },
          [released.buffer],
        )
      }
    } catch (error) {
      this.#fail(error)
    }
  }

  #fail(error: unknown): void {
    if (this.#intentionalStop) {
      this.#settle()
      return
    }
    if (this.#terminalError || this.#settled) return
    this.#terminalError = error instanceof Error ? error : new Error(String(error))
    if (this.#fallbackSession) void this.#stopFallbackAfterError()
    else if (this.#worker) this.#worker.postMessage({ type: 'stop' })
    else this.#settle(this.#terminalError)
  }

  async #stopFallbackAfterError(): Promise<void> {
    try {
      await this.#fallbackSession?.stop()
    } finally {
      if (this.#intentionalStop) this.#settle()
      else this.#settle(this.#terminalError)
    }
  }

  #settle(error?: Error): void {
    if (this.#settled) return
    this.#settled = true
    this.#disposeWorker()
    if (error) this.#rejectCompletion?.(error)
    else this.#resolveCompletion?.()
    this.#resolveCompletion = undefined
    this.#rejectCompletion = undefined
    this.#terminalError = undefined
    this.#rdsSink = undefined
    this.#rejectProcessingReady?.(error ?? new Error('RTL-SDR source stopped.'))
    this.#resolveProcessingReady = undefined
    this.#rejectProcessingReady = undefined
    this.#vfoAudioPort?.close()
    this.#vfoAudioPort = undefined
    for (const pending of this.#pendingRuntimeCommands.values()) {
      pending.reject(error ?? new Error('RTL-SDR source stopped before applying the setting.'))
    }
    this.#pendingRuntimeCommands.clear()
  }

  #disposeWorker(): void {
    this.#worker?.removeEventListener('message', this.#handleWorkerMessage)
    this.#worker?.removeEventListener('error', this.#handleWorkerError)
    this.#worker?.terminate()
    this.#worker = undefined
    this.#workerConfigured = false
  }

  #attachVfoAudioPortToWorker(): void {
    const port = this.#vfoAudioPort
    if (!port || !this.#worker || !this.#workerConfigured) return
    try {
      this.#worker.postMessage({ type: 'attach-vfo-audio-port', port }, [port])
      this.#vfoAudioPort = undefined
    } catch (error) {
      this.#vfoAudioPort = undefined
      port.close()
      this.#fail(error)
    }
  }

  #clearVfoProcessing(): void {
    this.#worker?.postMessage({
      type: 'set-vfos',
      outputSampleRateHz: this.#vfoOutputSampleRateHz,
      vfos: [],
    })
  }
}

function isSupportedRtlSdr(device: UsbDevice): boolean {
  return device.vendorId === RTL_SDR_USB_VENDOR_ID &&
    (RTL_SDR_USB_PRODUCT_IDS as readonly number[]).includes(device.productId)
}