import type { AnalyzerSource, RdsSink, SampleSink } from './types'
import { HackRfDeviceSession, type HackRfSampleBlock } from './HackRfDeviceSession'
import {
  HACKRF_ONE_USB_PRODUCT_ID,
  HACKRF_USB_VENDOR_ID,
  validateHackRfConfig,
  type HackRfConfig,
  type HackRfRuntimeCommand,
} from './hackrfProtocol'
import type { HackRfWorkerEvent, HackRfWorkerRequest } from './hackrfWorkerProtocol'
import type { RdsDecodeTarget } from '../workers/protocol'
import type { VfoDspConfig } from '../vfo/types'
import { webUsbFromNavigator, type Usb, type UsbDevice } from './webUsb'
import type { UsbDeviceSelection } from './UsbDeviceRegistry'

type HackRfWorker = {
  postMessage(message: HackRfWorkerRequest, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (event: MessageEvent<HackRfWorkerEvent>) => void): void
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent<HackRfWorkerEvent>) => void): void
  removeEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
  terminate(): void
}

type HackRfSourceDependencies = {
  usb?: Usb
  createWorker?: () => HackRfWorker
  selection?: UsbDeviceSelection
}

export class HackRFSource implements AnalyzerSource {
  readonly id: string
  readonly label: string
  #config: HackRfConfig
  readonly #dependencies: HackRfSourceDependencies
  #sink: SampleSink | undefined
  #selectedDevice: UsbDevice | undefined
  #worker: HackRfWorker | undefined
  #fallbackSession: HackRfDeviceSession | undefined
  #rdsTargets: RdsDecodeTarget[] = []
  #vfos: VfoDspConfig[] = []
  #vfoOutputSampleRateHz = 48_000
  #vfoAudioPort: MessagePort | undefined
  #workerConfigured = false
  #rdsSink: RdsSink | undefined
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
    { resolve: (config: HackRfConfig) => void; reject: (error: Error) => void }
  >()

  constructor(config: HackRfConfig, dependencies: HackRfSourceDependencies = {}) {
    validateHackRfConfig(config)
    if (dependencies.selection && dependencies.selection.kind !== 'hackrf') {
      throw new Error('HackRF source requires a HackRF device selection.')
    }
    this.id = dependencies.selection?.id ?? 'hackrf-one'
    this.label = dependencies.selection?.label ?? 'HackRF One'
    this.#config = { ...config }
    this.#dependencies = dependencies
  }

  start(sink: SampleSink, rdsSink?: RdsSink): Promise<void> {
    if (this.#completion) throw new Error('HackRF source is already active.')
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

  async applyRuntimeCommand(command: HackRfRuntimeCommand): Promise<HackRfConfig> {
    if (this.#intentionalStop || this.#settled || !this.#completion) {
      throw new Error('HackRF source is not active.')
    }
    const previousRdsTargets = command.type === 'set-center-frequency'
      ? [...this.#rdsTargets]
      : null
    if (previousRdsTargets) this.setRdsTargets([])
    if (command.type === 'set-center-frequency') this.#clearVfoProcessing()

    try {
      if (this.#fallbackSession) {
        const config = await this.#fallbackSession.applyRuntimeCommand(command)
        this.#config = { ...config }
        if (command.type === 'set-center-frequency') {
          this.#worker?.postMessage({ type: 'configure-processing', config })
        }
        return { ...config }
      }
      if (!this.#worker) throw new Error('HackRF receiver is not running.')

      const requestId = ++this.#runtimeRequestId
      const result = new Promise<HackRfConfig>((resolve, reject) => {
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
      if (command.type === 'set-center-frequency' && !this.#intentionalStop && !this.#settled) {
        this.setVfos(this.#vfoOutputSampleRateHz, this.#vfos)
      }
    }
  }

  async stop(): Promise<void> {
    this.#intentionalStop = true
    this.#terminalError = undefined
    if (this.#fallbackSession) {
      await this.#fallbackSession.stop()
    } else if (this.#worker) {
      this.#worker.postMessage({ type: 'stop' })
    } else {
      this.#settle()
    }
    await this.#completion
  }

  async #requestAndStart(usb: Usb | undefined): Promise<void> {
    try {
      const selection = this.#dependencies.selection
      let selectedDevice = selection?.device
      if (!selectedDevice) {
        if (!usb) {
          throw new Error('WebUSB is unavailable. Use a secure-context desktop Chromium browser.')
        }
        const authorizedDevices = await usb.getDevices()
        selectedDevice = authorizedDevices.find(
          (device) =>
            device.vendorId === HACKRF_USB_VENDOR_ID &&
            device.productId === HACKRF_ONE_USB_PRODUCT_ID,
        )
      }
      if (!selectedDevice) {
        if (!usb) {
          throw new Error('WebUSB is unavailable. Use a secure-context desktop Chromium browser.')
        }
        if (!usb.requestDevice) {
          throw new Error(
            'WebUSB device selection is unavailable. Use a secure-context desktop Chromium browser.',
          )
        }
        selectedDevice = await usb.requestDevice({
          filters: [{ vendorId: HACKRF_USB_VENDOR_ID, productId: HACKRF_ONE_USB_PRODUCT_ID }],
        })
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

  #createWorker(): HackRfWorker {
    return new Worker(new URL('./hackrf.worker.ts', import.meta.url), {
      type: 'module',
      name: `${this.id}-acquisition`,
    }) as HackRfWorker
  }

  readonly #handleWorkerMessage = (event: MessageEvent<HackRfWorkerEvent>): void => {
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
        (message.code === 'DEVICE_NOT_FOUND' ||
          message.code === 'WEBUSB_UNAVAILABLE') &&
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
          this.#fail(new Error('HackRF processing worker stopped unexpectedly.'))
        }
      } else if (this.#intentionalStop) {
        this.#settle()
      } else {
        this.#settle(this.#terminalError ?? new Error('HackRF acquisition stopped unexpectedly.'))
      }
    }
  }

  readonly #handleWorkerError = (event: ErrorEvent): void => {
    const error = new Error(event.message || 'HackRF acquisition worker failed.')
    if (this.#intentionalStop) this.#settle()
    else this.#settle(error)
  }

  async #startPageFallback(): Promise<void> {
    const device = this.#selectedDevice
    if (!device) {
      this.#fail(new Error('The selected HackRF is unavailable.'))
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
    const session = new HackRfDeviceSession(device, this.#config, {
      onRawSamples: ({ iq, timestampUs }) => {
        worker.postMessage(
          { type: 'process-iq', iq, timestampUs },
          [iq.buffer as ArrayBuffer],
        )
      },
      onDiscontinuity: () => worker.postMessage({ type: 'configure-processing', config: this.#config }),
      onSamples: (block) => void this.#deliver(block),
    })
    this.#fallbackSession = session
    try {
      await session.start()
      if (this.#intentionalStop) this.#settle()
      else this.#fail(new Error('HackRF acquisition stopped unexpectedly.'))
    } catch (error) {
      this.#fail(error)
    }
  }

  async #deliver(block: HackRfSampleBlock): Promise<void> {
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
      if (this.#fallbackSession) {
        this.#fallbackSession.returnBuffer(released.buffer)
      } else if (this.#worker) {
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
    if (this.#fallbackSession) {
      void this.#stopFallbackAfterError()
    } else if (this.#worker) {
      this.#worker.postMessage({ type: 'stop' })
    } else {
      this.#settle(this.#terminalError)
    }
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
    this.#rejectProcessingReady?.(error ?? new Error('HackRF source stopped.'))
    this.#resolveProcessingReady = undefined
    this.#rejectProcessingReady = undefined
    this.#vfoAudioPort?.close()
    this.#vfoAudioPort = undefined
    for (const pending of this.#pendingRuntimeCommands.values()) {
      pending.reject(error ?? new Error('HackRF source stopped before applying the setting.'))
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
