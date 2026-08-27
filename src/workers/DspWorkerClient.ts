import {
  PROTOCOL_VERSION,
  type AnalysisFrameEvent,
  type GeneratorConfig,
  type InputReleasedEvent,
  type SampleMetadata,
  type WorkerEvent,
  type WorkerReadyEvent,
} from './protocol'

export class DspWorkerClient {
  readonly #worker: Worker
  readonly #frameListeners = new Set<(frame: AnalysisFrameEvent) => void>()
  readonly #statusListeners = new Set<(event: WorkerEvent) => void>()
  readonly #inputReleaseListeners = new Map<
    number,
    {
      resolve: (event: InputReleasedEvent) => void
      reject: (error: Error) => void
    }
  >()
  #initialization: Promise<WorkerReadyEvent> | undefined
  #resolveInitialization: ((ready: WorkerReadyEvent) => void) | undefined
  #rejectInitialization: ((error: Error) => void) | undefined
  #requestId = 0

  constructor() {
    this.#worker = new Worker(new URL('./dsp.worker.ts', import.meta.url), {
      type: 'module',
      name: 'rad-dsp',
    })
    this.#worker.addEventListener('message', this.#handleMessage)
    this.#worker.addEventListener('error', this.#handleWorkerError)
  }

  initialize(): Promise<WorkerReadyEvent> {
    this.#initialization ??= new Promise((resolve, reject) => {
      this.#resolveInitialization = resolve
      this.#rejectInitialization = reject
      this.#worker.postMessage({
        type: 'init',
        protocolVersion: PROTOCOL_VERSION,
      })
    })
    return this.#initialization
  }

  configure(config: GeneratorConfig): number {
    const requestId = ++this.#requestId
    this.#worker.postMessage({
      type: 'configure',
      protocolVersion: PROTOCOL_VERSION,
      requestId,
      config,
    })
    return requestId
  }

  startGenerated(): void {
    this.#worker.postMessage({
      type: 'start-generated',
      protocolVersion: PROTOCOL_VERSION,
    })
  }

  stop(): void {
    this.#worker.postMessage({ type: 'stop', protocolVersion: PROTOCOL_VERSION })
  }

  reset(): void {
    this.#worker.postMessage({ type: 'reset', protocolVersion: PROTOCOL_VERSION })
  }

  frameConsumed(sequence: number): void {
    this.#worker.postMessage({
      type: 'frame-consumed',
      protocolVersion: PROTOCOL_VERSION,
      sequence,
    })
  }

  processSamples(
    iq: Float32Array,
    metadata: SampleMetadata,
  ): Promise<InputReleasedEvent> {
    const requestId = ++this.#requestId
    const release = new Promise<InputReleasedEvent>((resolve, reject) => {
      this.#inputReleaseListeners.set(requestId, { resolve, reject })
    })
    this.#worker.postMessage(
      {
        type: 'process-samples',
        protocolVersion: PROTOCOL_VERSION,
        requestId,
        iq,
        metadata,
      },
      [iq.buffer],
    )
    return release
  }

  onFrame(listener: (frame: AnalysisFrameEvent) => void): () => void {
    this.#frameListeners.add(listener)
    return () => this.#frameListeners.delete(listener)
  }

  onStatus(listener: (event: WorkerEvent) => void): () => void {
    this.#statusListeners.add(listener)
    return () => this.#statusListeners.delete(listener)
  }

  terminate(): void {
    const error = new Error('DSP worker was terminated.')
    this.#rejectInitialization?.(error)
    this.#resolveInitialization = undefined
    this.#rejectInitialization = undefined
    for (const pending of this.#inputReleaseListeners.values()) {
      pending.reject(error)
    }
    this.#inputReleaseListeners.clear()
    this.#worker.removeEventListener('message', this.#handleMessage)
    this.#worker.removeEventListener('error', this.#handleWorkerError)
    this.#worker.terminate()
  }

  readonly #handleMessage = (event: MessageEvent<WorkerEvent>): void => {
    const message = event.data
    if (message.type === 'ready') {
      this.#resolveInitialization?.(message)
      this.#resolveInitialization = undefined
      this.#rejectInitialization = undefined
    }
    if (message.type === 'error' && this.#rejectInitialization) {
      this.#rejectInitialization?.(
        new Error(`${message.code}: ${message.message}`),
      )
      this.#rejectInitialization = undefined
    }
    if (message.type === 'analysis-frame') {
      for (const listener of this.#frameListeners) listener(message)
    }
    if (message.type === 'input-released') {
      this.#inputReleaseListeners.get(message.requestId)?.resolve(message)
      this.#inputReleaseListeners.delete(message.requestId)
    }
    for (const listener of this.#statusListeners) listener(message)
  }

  readonly #handleWorkerError = (event: ErrorEvent): void => {
    const error = new Error(event.message || 'DSP worker failed.')
    this.#rejectInitialization?.(error)
    for (const pending of this.#inputReleaseListeners.values()) {
      pending.reject(error)
    }
    this.#inputReleaseListeners.clear()
    for (const listener of this.#statusListeners) {
      listener({
        type: 'error',
        protocolVersion: PROTOCOL_VERSION,
        code: 'PROCESSING_FAILED',
        message: error.message,
        recoverable: false,
      })
    }
  }
}