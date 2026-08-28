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
import { isVfoInPassband } from '../vfo/vfoState'
import type { VfoConfig, VfoDspConfig } from '../vfo/types'
import { FrameHub } from './FrameHub'

const RDS_STALE_AFTER_US = 2_000_000n

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
  #rdsTargets: RdsDecodeTarget[] = []
  readonly #rdsByChannelCenterHz = new Map<number, RdsReception>()
  #sourceTimestampUs = 0n
  #sourceCenterFrequencyHz = 0
  #sourceSampleRateHz = 1_000_000
  #vfos: VfoConfig[] = []
  #vfoOutputSampleRateHz = 48_000
  #vfoPlaybackEnabled = false
  #vfoAudioPortFactory: (() => MessagePort) | undefined
  #lastVfoRouteKey = ''
  #resetTask: Promise<void> | undefined
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
    this.#resetExternalRds()
    this.#sourceCenterFrequencyHz = config.centerFrequencyHz
    this.#sourceSampleRateHz = config.sampleRateHz
    this.#client?.configure(config)
    this.#lastVfoRouteKey = ''
    this.#routeVfos()
  }

  configureDetection(config: DetectionConfig): void {
    this.#resetExternalRds()
    this.#client?.configureDetection(config)
  }

  configureVfos(vfos: readonly VfoConfig[]): void {
    this.#vfos = vfos.map((vfo) => ({ ...vfo }))
    this.#routeVfos()
  }

  startVfoAudio(outputSampleRateHz: number, portFactory: () => MessagePort): void {
    this.#vfoOutputSampleRateHz = outputSampleRateHz
    this.#vfoAudioPortFactory = portFactory
    this.#vfoPlaybackEnabled = true
    this.#lastVfoRouteKey = ''
    this.#routeVfos()
    this.#attachVfoAudioPort()
  }

  stopVfoAudio(): void {
    this.#vfoPlaybackEnabled = false
    this.#routeVfos()
  }

  startGenerated(): void {
    if (this.#activeSource) throw new Error('Stop the external source before starting the generator.')
    this.#activeMode = 'generated'
    this.#lastVfoRouteKey = ''
    this.#routeVfos()
    this.#attachVfoAudioPort()
    this.#client?.startGenerated()
  }

  async startExternal(source: AnalyzerSource): Promise<void> {
    if (!this.#client) throw new Error('Analyzer is not initialized.')
    if (this.#activeMode !== 'idle') {
      throw new Error('Stop the active source before connecting HackRF One.')
    }
    this.#client.stop()
    const generation = ++this.#sourceGeneration
    this.#resetExternalRds()
    this.#activeMode = 'external'
    this.#activeSource = source
    this.#lastVfoRouteKey = ''
    this.#routeVfos()
    this.#attachVfoAudioPort()
    this.#update({ state: 'connecting', detail: 'Waiting for HackRF One' })

    let task: Promise<void>
    try {
      task = source.start(async (chunk) => {
        if (generation !== this.#sourceGeneration || this.#activeSource !== source) {
          return { buffer: chunk.iq.buffer as ArrayBuffer, dropped: true }
        }
        if (this.#snapshot.state === 'connecting') {
          this.#update({ state: 'running', detail: 'HackRF One · live IQ' })
        }
        return this.ingest(chunk)
      }, (receptions) => {
        if (generation !== this.#sourceGeneration || this.#activeSource !== source) return
        const activeChannels = new Set(
          this.#rdsTargets.map((target) => target.channelCenterHz),
        )
        for (const reception of receptions) {
          if (activeChannels.has(reception.channelCenterHz)) {
            this.#rdsByChannelCenterHz.set(reception.channelCenterHz, reception)
          }
        }
        this.#update({
          trackedSignals: this.#associateExternalRds(
            this.#snapshot.trackedSignals,
            this.#sourceTimestampUs,
          ),
        })
      })
    } catch (error) {
      try {
        await source.stop()
      } catch {
        // Preserve the startup error; stop is best-effort cleanup.
      }
      this.#activeMode = 'idle'
      this.#activeSource = undefined
      this.#lastVfoRouteKey = ''
      this.#update({
        state: 'error',
        detail: error instanceof Error ? error.message : String(error),
      })
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
      if (generation === this.#sourceGeneration && this.#activeMode === 'external') {
        this.#activeMode = 'idle'
        this.#activeSource = undefined
        this.#sourceTask = undefined
        this.#update({
          state: 'error',
          detail: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  async stop(): Promise<void> {
    const source = this.#activeSource
    const task = this.#sourceTask
    this.#resetExternalRds(source)
    source?.setVfos?.(this.#vfoOutputSampleRateHz, [])
    this.#sourceGeneration += 1
    this.#activeMode = 'idle'
    this.#activeSource = undefined
    this.#sourceTask = undefined
    this.#lastVfoRouteKey = ''
    this.#client?.stop()
    if (source) {
      try {
        await source.stop()
        await task
      } catch {
        // Intentional stop owns the final state even if the device disappeared.
      }
    }
    this.#update({
      state: 'idle',
      detail: 'Analyzer idle',
      trackedSignals: this.#withoutRds(this.#snapshot.trackedSignals),
    })
  }

  async reset(): Promise<void> {
    if (this.#resetTask) return this.#resetTask
    const resumeGenerated = this.#activeMode === 'generated'
    const task = (async () => {
      await this.stop()
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
      if (resumeGenerated) this.startGenerated()
    })()
    this.#resetTask = task
    try {
      await task
    } finally {
      if (this.#resetTask === task) this.#resetTask = undefined
    }
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
    this.#sourceGeneration += 1
    this.#resetExternalRds()
    void this.#activeSource?.stop()
    this.#activeSource = undefined
    this.#sourceTask = undefined
    this.#activeMode = 'idle'
    this.#vfoPlaybackEnabled = false
    this.#vfoAudioPortFactory = undefined
    this.#unsubscribeFrame?.()
    this.#unsubscribeStatus?.()
    this.frames.clear()
    this.#client?.terminate()
    this.#client = undefined
  }

  readonly #handleFrame = (frame: AnalysisFrameEvent): void => {
    const external = this.#activeMode === 'external'
    if (external) {
      this.#sourceTimestampUs = frame.timestampUs
      this.#setRdsTargets(frame.rdsTargets)
    }
    this.#snapshot = {
      ...this.#snapshot,
      sequence: frame.sequence,
      peakFrequencyHz: frame.peakFrequencyHz,
      peakPowerDbfs: frame.peakPowerDbfs,
      centerFrequencyHz: frame.centerFrequencyHz,
      noiseFloorDbfs: frame.noiseFloorDbfs,
      trackedSignals: external
        ? this.#associateExternalRds(frame.trackedSignals, frame.timestampUs)
        : frame.trackedSignals,
      processingTimeMs: frame.processingTimeMs,
    }
    this.#sourceCenterFrequencyHz = frame.centerFrequencyHz
    this.#sourceSampleRateHz = frame.sampleRateHz
    this.#routeVfos()
    this.frames.publish(frame, () => this.#client?.frameConsumed(frame.sequence))
  }

  readonly #handleStatus = (event: WorkerEvent): void => {
    if (event.type === 'status') {
      if (
        this.#activeMode === 'external' ||
        (this.#activeMode === 'idle' && this.#snapshot.state === 'error')
      ) return
      this.#update({
        state: event.state,
        detail: event.state === 'running' ? 'Generated IQ active' : 'Analyzer idle',
      })
    } else if (event.type === 'configured') {
      this.#sourceCenterFrequencyHz = event.config.centerFrequencyHz
      this.#sourceSampleRateHz = event.config.sampleRateHz
      this.#update({
        centerFrequencyHz: event.config.centerFrequencyHz,
        peakFrequencyHz: 0,
        peakPowerDbfs: -120,
        noiseFloorDbfs: -120,
        trackedSignals: [],
        processingTimeMs: 0,
      })
      this.#lastVfoRouteKey = ''
      this.#routeVfos()
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

  #routeVfos(): void {
    if (!this.#vfoPlaybackEnabled && this.#lastVfoRouteKey === '') return
    const dspVfos: VfoDspConfig[] = this.#vfoPlaybackEnabled
      ? this.#vfos
          .filter((vfo) =>
            isVfoInPassband(vfo, {
              centerFrequencyHz: this.#sourceCenterFrequencyHz,
              sampleRateHz: this.#sourceSampleRateHz,
            }),
          )
          .map((vfo) => ({
            id: vfo.id,
            frequencyHz: vfo.frequencyHz,
            mode: vfo.mode,
            bandwidthHz: vfo.bandwidthHz,
            squelchDbfs: vfo.squelchDbfs,
            revision: vfo.revision,
          }))
      : []
    const owner = this.#activeMode === 'external' ? this.#activeSource?.id : 'generated'
    const routeKey = JSON.stringify([
      owner,
      this.#sourceCenterFrequencyHz,
      this.#sourceSampleRateHz,
      this.#vfoOutputSampleRateHz,
      dspVfos,
    ])
    if (routeKey === this.#lastVfoRouteKey) return
    this.#lastVfoRouteKey = routeKey
    if (this.#activeMode === 'external') {
      this.#activeSource?.setVfos?.(this.#vfoOutputSampleRateHz, dspVfos)
    } else {
      this.#client?.configureVfos(this.#vfoOutputSampleRateHz, dspVfos)
    }
  }

  #attachVfoAudioPort(): void {
    if (!this.#vfoPlaybackEnabled || !this.#vfoAudioPortFactory) return
    const port = this.#vfoAudioPortFactory()
    if (this.#activeMode === 'external') this.#activeSource?.attachVfoAudioPort?.(port)
    else this.#client?.attachVfoAudioPort(port)
  }

  #setRdsTargets(targets: readonly RdsDecodeTarget[]): void {
    const unchanged =
      targets.length === this.#rdsTargets.length &&
      targets.every((target, index) => {
        const current = this.#rdsTargets[index]
        return current?.channelCenterHz === target.channelCenterHz &&
          current.frequencyOffsetHz === target.frequencyOffsetHz
      })
    if (unchanged) return

    this.#rdsTargets = [...targets]
    const activeChannels = new Set(targets.map((target) => target.channelCenterHz))
    for (const channelCenterHz of this.#rdsByChannelCenterHz.keys()) {
      if (!activeChannels.has(channelCenterHz)) {
        this.#rdsByChannelCenterHz.delete(channelCenterHz)
      }
    }
    this.#activeSource?.setRdsTargets?.(targets)
  }

  #associateExternalRds(
    signals: readonly TrackedSignal[],
    timestampUs: bigint,
  ): TrackedSignal[] {
    return signals.map((signal) => {
      const channelCenterHz = signal.classification.primary.channelCenterHz
      const reception = channelCenterHz === null
        ? undefined
        : this.#rdsByChannelCenterHz.get(channelCenterHz)
      if (!reception) return signal

      const lastValidGroupAtUs = reception.diagnostics.lastValidGroupAtUs
      if (
        lastValidGroupAtUs !== null &&
        timestampUs > lastValidGroupAtUs &&
        timestampUs - lastValidGroupAtUs > RDS_STALE_AFTER_US
      ) {
        return {
          ...signal,
          rds: {
            ...reception,
            state: 'stale',
            reason: 'No valid RDS groups received for 2 seconds.',
          },
        }
      }
      return { ...signal, rds: reception }
    })
  }

  #resetExternalRds(source: AnalyzerSource | undefined = this.#activeSource): void {
    if (this.#rdsTargets.length > 0) source?.setRdsTargets?.([])
    this.#rdsTargets = []
    this.#rdsByChannelCenterHz.clear()
    this.#sourceTimestampUs = 0n
  }

  #withoutRds(signals: readonly TrackedSignal[]): TrackedSignal[] {
    return signals.map((signal) => {
      const result = { ...signal }
      delete result.rds
      return result
    })
  }
}