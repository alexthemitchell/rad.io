import { DspWorkerClient } from '../workers/DspWorkerClient'
import type { AnalyzerSource, SampleChunk, SampleRelease } from '../sources/types'
import type {
  AnalysisFrameEvent,
  DetectionConfig,
  GeneratorConfig,
  RdsDecodeTarget,
  RdsReception,
  TrackedSignal,
  WorkerEvent,
} from '../workers/protocol'
import { FrameHub } from './FrameHub'

export type AnalyzerState = 'booting' | 'idle' | 'connecting' | 'running' | 'error'

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
  #activeMode: 'idle' | 'generated' | 'external' = 'idle'
  #activeSource: AnalyzerSource | undefined
  #sourceTask: Promise<void> | undefined
  #sourceGeneration = 0
  readonly #rdsByChannel = new Map<number, RdsReception>()
  #rdsTargetKey = ''
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
    this.#clearRdsState()
    this.#client?.configure(config)
  }

  configureDetection(config: DetectionConfig): void {
    this.#clearRdsState()
    this.#client?.configureDetection(config)
  }

  startGenerated(): void {
    if (this.#activeSource) throw new Error('Stop the external source before starting the generator.')
    this.#clearRdsState()
    this.#activeMode = 'generated'
    this.#client?.startGenerated()
  }

  async startExternal(source: AnalyzerSource): Promise<void> {
    if (!this.#client) throw new Error('Analyzer is not initialized.')
    if (this.#activeMode !== 'idle') {
      throw new Error('Stop the active source before connecting HackRF One.')
    }
    this.#client.stop()
    const generation = ++this.#sourceGeneration
    this.#activeMode = 'external'
    this.#activeSource = source
    this.#update({ state: 'connecting', detail: 'Waiting for HackRF One' })

    const sink = async (chunk: SampleChunk): Promise<SampleRelease> => {
      if (generation !== this.#sourceGeneration || this.#activeSource !== source) {
        return { buffer: chunk.iq.buffer as ArrayBuffer, dropped: true }
      }
      if (this.#snapshot.state === 'connecting') {
        this.#update({ state: 'running', detail: 'HackRF One · live IQ' })
      }
      return this.ingest(chunk)
    }
    let task: Promise<void>
    try {
      this.#clearRdsState()
      task = source.start(sink, (receptions) => {
        if (generation === this.#sourceGeneration && this.#activeSource === source) {
          this.#handleRdsUpdate(receptions)
        }
      })
    } catch (error) {
      this.#handleExternalFailure(source, generation, error)
      return
    }
    this.#sourceTask = task
    try {
      await task
      if (generation === this.#sourceGeneration && this.#activeMode === 'external') {
        this.#activeMode = 'idle'
        this.#activeSource = undefined
        this.#sourceTask = undefined
        this.#update({ state: 'idle', detail: 'Analyzer idle' })
      }
    } catch (error) {
      this.#handleExternalFailure(source, generation, error)
    }
  }

  async stop(): Promise<void> {
    const source = this.#activeSource
    const task = this.#sourceTask
    this.#sourceGeneration += 1
    this.#clearRdsState()
    this.#activeMode = 'idle'
    this.#activeSource = undefined
    this.#sourceTask = undefined
    this.#client?.stop()
    if (source) {
      try {
        await source.stop()
        await task
      } catch {
        // Intentional stop owns the final state even if the device disappeared.
      }
    }
    this.#update({ state: 'idle', detail: 'Analyzer idle' })
  }

  async reset(): Promise<void> {
    if (this.#activeMode === 'external') await this.stop()
    this.#client?.reset()
    this.#clearRdsState()
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

  #handleRdsUpdate(receptions: readonly RdsReception[]): void {
    for (const reception of receptions) {
      this.#rdsByChannel.set(reception.channelCenterHz, reception)
    }
    const trackedSignals = this.#mergeRdsReceptions(
      this.#snapshot.trackedSignals,
      latestRdsTimestamp(receptions),
    )
    this.#update({ trackedSignals })
  }

  #updateRdsTargets(targets: readonly RdsDecodeTarget[]): void {
    const key = targets
      .map((target) => `${target.channelCenterHz}:${target.frequencyOffsetHz}`)
      .join('|')
    if (key === this.#rdsTargetKey) return
    this.#rdsTargetKey = key
    this.#activeSource?.setRdsTargets?.(targets)
  }

  #mergeRdsReceptions(
    signals: readonly TrackedSignal[],
    timestampUs: bigint,
  ): TrackedSignal[] {
    return signals.map((signal) => {
      const channelCenterHz = signal.classification.primary.channelCenterHz
      if (channelCenterHz === null) return signal
      const cached = this.#rdsByChannel.get(channelCenterHz)
      if (!cached) return signal
      const lastValidGroupAtUs = cached.diagnostics.lastValidGroupAtUs
      const stale =
        (lastValidGroupAtUs !== null && timestampUs - lastValidGroupAtUs > 2_000_000n)
      return {
        ...signal,
        rds: stale ? { ...cached, state: 'stale' } : cached,
      }
    })
  }

  #clearRdsState(): void {
    this.#rdsByChannel.clear()
    this.#rdsTargetKey = ''
    this.#activeSource?.setRdsTargets?.([])
    this.#snapshot = {
      ...this.#snapshot,
      trackedSignals: this.#snapshot.trackedSignals.map((signal) => {
        const withoutRds = { ...signal }
        delete withoutRds.rds
        return withoutRds
      }),
    }
  }

  subscribeStatus(listener: (snapshot: AnalyzerSnapshot) => void): () => void {
    this.#statusListeners.add(listener)
    listener(this.#snapshot)
    return () => this.#statusListeners.delete(listener)
  }

  dispose(): void {
    this.#sourceGeneration += 1
    this.#clearRdsState()
    void this.#activeSource?.stop()
    this.#activeSource = undefined
    this.#sourceTask = undefined
    this.#activeMode = 'idle'
    this.#unsubscribeFrame?.()
    this.#unsubscribeStatus?.()
    this.frames.clear()
    this.#client?.terminate()
    this.#client = undefined
  }

  readonly #handleFrame = (frame: AnalysisFrameEvent): void => {
    let trackedSignals = frame.trackedSignals
    if (this.#activeMode === 'external') {
      this.#updateRdsTargets(frame.rdsTargets)
      trackedSignals = this.#mergeRdsReceptions(trackedSignals, frame.timestampUs)
      const retainedChannels = new Set(
        trackedSignals.flatMap((signal) => {
          const channelCenterHz = signal.classification.primary.channelCenterHz
          return channelCenterHz === null ? [] : [channelCenterHz]
        }),
      )
      for (const channelCenterHz of this.#rdsByChannel.keys()) {
        if (!retainedChannels.has(channelCenterHz)) {
          this.#rdsByChannel.delete(channelCenterHz)
        }
      }
    }
    const deliveredFrame =
      trackedSignals === frame.trackedSignals ? frame : { ...frame, trackedSignals }
    this.#snapshot = {
      ...this.#snapshot,
      sequence: frame.sequence,
      peakFrequencyHz: frame.peakFrequencyHz,
      peakPowerDbfs: frame.peakPowerDbfs,
      centerFrequencyHz: frame.centerFrequencyHz,
      noiseFloorDbfs: frame.noiseFloorDbfs,
      trackedSignals,
      processingTimeMs: frame.processingTimeMs,
    }
    this.frames.publish(deliveredFrame, () => this.#client?.frameConsumed(frame.sequence))
  }

  readonly #handleStatus = (event: WorkerEvent): void => {
    if (event.type === 'status') {
      if (this.#activeMode === 'external') return
      if (event.state === 'idle' && this.#snapshot.state === 'error') return
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

  #handleExternalFailure(
    source: AnalyzerSource,
    generation: number,
    error: unknown,
  ): void {
    if (
      generation !== this.#sourceGeneration ||
      this.#activeMode !== 'external' ||
      this.#activeSource !== source
    ) {
      return
    }
    this.#clearRdsState()
    this.#activeMode = 'idle'
    this.#activeSource = undefined
    this.#sourceTask = undefined
    this.#update({
      state: 'error',
      detail: error instanceof Error ? error.message : String(error),
    })
  }

  #update(update: Partial<AnalyzerSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...update }
    for (const listener of this.#statusListeners) listener(this.#snapshot)
  }
}

function latestRdsTimestamp(receptions: readonly RdsReception[]): bigint {
  return receptions.reduce((latest, reception) => {
    const timestamp = reception.diagnostics.lastValidGroupAtUs
    return timestamp !== null && timestamp > latest ? timestamp : latest
  }, 0n)
}