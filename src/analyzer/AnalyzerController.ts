import { DspWorkerClient } from '../workers/DspWorkerClient'
import type { SampleChunk, SampleRelease } from '../sources/types'
import type {
  AnalysisFrameEvent,
  DetectionConfig,
  GeneratorConfig,
  TrackedSignal,
  WorkerEvent,
} from '../workers/protocol'
import { FrameHub } from './FrameHub'

export type AnalyzerState = 'booting' | 'idle' | 'running' | 'error'

export type AnalyzerSnapshot = {
  state: AnalyzerState
  detail: string
  sequence: number
  peakFrequencyHz: number
  peakPowerDbfs: number
  centerFrequencyHz: number
  noiseFloorDbfs: number
  trackedSignals: TrackedSignal[]
  processingTimeMs: number
}

export class AnalyzerController {
  readonly frames = new FrameHub()
  readonly #statusListeners = new Set<(snapshot: AnalyzerSnapshot) => void>()
  #client: DspWorkerClient | undefined
  #unsubscribeFrame: (() => void) | undefined
  #unsubscribeStatus: (() => void) | undefined
  #snapshot: AnalyzerSnapshot = {
    state: 'booting',
    detail: 'Loading Rust DSP module',
    sequence: 0,
    peakFrequencyHz: 0,
    peakPowerDbfs: -120,
    centerFrequencyHz: 0,
    noiseFloorDbfs: -120,
    trackedSignals: [],
    processingTimeMs: 0,
  }

  get snapshot(): AnalyzerSnapshot {
    return this.#snapshot
  }

  async initialize(): Promise<void> {
    if (this.#client) return
    const client = new DspWorkerClient()
    this.#client = client
    this.#unsubscribeFrame = client.onFrame(this.#handleFrame)
    this.#unsubscribeStatus = client.onStatus(this.#handleStatus)
    const ready = await client.initialize()
    this.#update({
      state: 'idle',
      detail: `Protocol ${ready.protocolVersion} · Rust/WASM ready`,
    })
  }

  configure(config: GeneratorConfig): void {
    this.#client?.configure(config)
  }

  configureDetection(config: DetectionConfig): void {
    this.#client?.configureDetection(config)
  }

  start(): void {
    this.#client?.startGenerated()
  }

  stop(): void {
    this.#client?.stop()
  }

  reset(): void {
    this.#client?.reset()
    this.frames.clear()
    this.#update({
      sequence: 0,
      peakFrequencyHz: 0,
      peakPowerDbfs: -120,
      centerFrequencyHz: 0,
      noiseFloorDbfs: -120,
      trackedSignals: [],
      processingTimeMs: 0,
    })
  }

  async ingest(chunk: SampleChunk): Promise<SampleRelease> {
    if (!this.#client) throw new Error('Analyzer is not initialized.')
    if (chunk.formatVersion !== 1) {
      throw new Error(`Unsupported IQ format version ${chunk.formatVersion}.`)
    }
    const released = await this.#client.processSamples(
      chunk.iq,
      {
        sampleRateHz: chunk.sampleRateHz,
        centerFrequencyHz: chunk.centerFrequencyHz,
        sourceSequence: chunk.sequence,
        timestampUs: chunk.timestampUs,
        formatVersion: chunk.formatVersion,
      },
    )
    return { buffer: released.buffer, dropped: released.dropped }
  }

  subscribeStatus(listener: (snapshot: AnalyzerSnapshot) => void): () => void {
    this.#statusListeners.add(listener)
    listener(this.#snapshot)
    return () => this.#statusListeners.delete(listener)
  }

  dispose(): void {
    this.#unsubscribeFrame?.()
    this.#unsubscribeStatus?.()
    this.frames.clear()
    this.#client?.terminate()
    this.#client = undefined
  }

  readonly #handleFrame = (frame: AnalysisFrameEvent): void => {
    this.#snapshot = {
      ...this.#snapshot,
      sequence: frame.sequence,
      peakFrequencyHz: frame.peakFrequencyHz,
      peakPowerDbfs: frame.peakPowerDbfs,
      centerFrequencyHz: frame.centerFrequencyHz,
      noiseFloorDbfs: frame.noiseFloorDbfs,
      trackedSignals: frame.trackedSignals,
      processingTimeMs: frame.processingTimeMs,
    }
    this.frames.publish(frame, () => this.#client?.frameConsumed(frame.sequence))
  }

  readonly #handleStatus = (event: WorkerEvent): void => {
    if (event.type === 'status') {
      this.#update({
        state: event.state,
        detail: event.state === 'running' ? 'Generated IQ active' : 'Analyzer idle',
      })
    } else if (event.type === 'configured') {
      this.#update({
        centerFrequencyHz: event.config.centerFrequencyHz,
        peakFrequencyHz: 0,
        peakPowerDbfs: -120,
        noiseFloorDbfs: -120,
        trackedSignals: [],
        processingTimeMs: 0,
      })
    } else if (event.type === 'detection-configured') {
      this.#update({ trackedSignals: [] })
    } else if (event.type === 'error') {
      this.#update({ state: 'error', detail: event.message })
    }
  }

  #update(update: Partial<AnalyzerSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...update }
    for (const listener of this.#statusListeners) listener(this.#snapshot)
  }
}