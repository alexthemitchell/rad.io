import type { AnalyzerSource, SampleSink } from './types'
import { HackRfDeviceSession, type HackRfSampleBlock } from './HackRfDeviceSession'
import {
  HACKRF_ONE_USB_PRODUCT_ID,
  HACKRF_USB_VENDOR_ID,
  validateHackRfConfig,
  type HackRfConfig,
} from './hackrfProtocol'
import type { HackRfWorkerEvent, HackRfWorkerRequest } from './hackrfWorkerProtocol'
import { webUsbFromNavigator, type Usb, type UsbDevice } from './webUsb'

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
}

export class HackRFSource implements AnalyzerSource {
  readonly id = 'hackrf-one'
  readonly #config: HackRfConfig
  readonly #dependencies: HackRfSourceDependencies
  #sink: SampleSink | undefined
  #selectedDevice: UsbDevice | undefined
  #worker: HackRfWorker | undefined
  #fallbackSession: HackRfDeviceSession | undefined
  #completion: Promise<void> | undefined
  #resolveCompletion: (() => void) | undefined
  #rejectCompletion: ((error: Error) => void) | undefined
  #intentionalStop = false
  #settled = false
  #fallbackStarted = false
  #terminalError: Error | undefined

  constructor(config: HackRfConfig, dependencies: HackRfSourceDependencies = {}) {
    validateHackRfConfig(config)
    this.#config = config
    this.#dependencies = dependencies
  }

  start(sink: SampleSink): Promise<void> {
    if (this.#completion) throw new Error('HackRF source is already active.')
    const usb = this.#dependencies.usb ?? webUsbFromNavigator(navigator)
    if (!usb) {
      throw new Error('WebUSB is unavailable. Use a secure-context desktop Chromium browser.')
    }

    this.#sink = sink
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

  async #requestAndStart(usb: Usb): Promise<void> {
    try {
      const authorizedDevices = await usb.getDevices()
      let selectedDevice = authorizedDevices.find(
        (device) =>
          device.vendorId === HACKRF_USB_VENDOR_ID &&
          device.productId === HACKRF_ONE_USB_PRODUCT_ID,
      )
      if (!selectedDevice) {
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
      const worker = this.#dependencies.createWorker?.() ?? this.#createWorker()
      this.#worker = worker
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
    } catch (error) {
      this.#fail(error)
    }
  }

  #createWorker(): HackRfWorker {
    return new Worker(new URL('./hackrf.worker.ts', import.meta.url), {
      type: 'module',
      name: 'hackrf-acquisition',
    }) as HackRfWorker
  }

  readonly #handleWorkerMessage = (event: MessageEvent<HackRfWorkerEvent>): void => {
    const message = event.data
    if (message.type === 'samples') {
      void this.#deliver({
        iq: message.iq,
        sourceSequence: message.sourceSequence,
        timestampUs: message.timestampUs,
      })
    } else if (message.type === 'error') {
      if (
        (message.code === 'DEVICE_NOT_FOUND' ||
          message.code === 'WEBUSB_UNAVAILABLE') &&
        !this.#fallbackStarted
      ) {
        void this.#startPageFallback()
      } else {
        this.#fail(new Error(message.message))
      }
    } else if (message.type === 'stopped' && !this.#fallbackStarted) {
      if (this.#intentionalStop) {
        this.#settle()
      } else {
        this.#settle(
          this.#terminalError ?? new Error('HackRF acquisition stopped unexpectedly.'),
        )
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
    const session = new HackRfDeviceSession(device, this.#config, {
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
        sampleRateHz: this.#config.sampleRateHz,
        centerFrequencyHz: this.#config.centerFrequencyHz,
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
  }

  #disposeWorker(): void {
    this.#worker?.removeEventListener('message', this.#handleWorkerMessage)
    this.#worker?.removeEventListener('error', this.#handleWorkerError)
    this.#worker?.terminate()
    this.#worker = undefined
  }
}
