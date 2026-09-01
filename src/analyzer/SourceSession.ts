import { AnalyzerController, type AnalyzerSnapshot } from './AnalyzerController'
import type { FrameHub } from './FrameHub'
import { HackRFSource } from '../sources/HackRFSource'
import { RtlSdrSource } from '../sources/RtlSdrSource'
import {
  DEFAULT_HACKRF_CONFIG,
  validateHackRfConfig,
  type HackRfConfig,
  type HackRfRuntimeCommand,
} from '../sources/hackrfProtocol'
import {
  DEFAULT_RTL_SDR_CONFIG,
  validateRtlSdrConfig,
  type RtlSdrConfig,
  type RtlSdrRuntimeCommand,
} from '../sources/rtlSdrProtocol'
import type { AnalyzerSource, HardwareSourceKind, SourceSessionId } from '../sources/types'
import type { UsbDeviceSelection } from '../sources/UsbDeviceRegistry'
import type { DetectionConfig, GeneratorConfig } from '../workers/protocol'
import { DEFAULT_DETECTION_CONFIG, DEFAULT_GENERATOR_CONFIG } from '../workers/protocol'
import type { VfoConfig } from '../vfo/types'
import {
  HackRfAutoOptimizer,
  type HackRfAutoOptimizeStatus,
} from '../sources/HackRfAutoOptimizer'
import {
  RtlSdrAutoOptimizer,
  type RtlSdrAutoOptimizeStatus,
} from '../sources/RtlSdrAutoOptimizer'

export type HardwareSessionConfig = HackRfConfig | RtlSdrConfig
export type HardwareRuntimeCommand = HackRfRuntimeCommand | RtlSdrRuntimeCommand

export type SourceSessionSnapshot = {
  id: SourceSessionId
  kind: HardwareSourceKind
  label: string
  serialNumber: string | null
  deviceConnected: boolean
  config: HardwareSessionConfig
  detectionConfig: DetectionConfig
  analyzer: AnalyzerSnapshot
  runtimePending: boolean
  runtimeError: string | null
  discontinuityRevision: number
  autoOptimize: {
    enabled: boolean
    status: HackRfAutoOptimizeStatus | RtlSdrAutoOptimizeStatus
    targetFrequencyHz: number | null
    detail: string
  }
}

export type SourceSessionController = {
  readonly frames: FrameHub
  readonly snapshot: AnalyzerSnapshot
  initialize(): Promise<void>
  configure(config: GeneratorConfig): void
  configureDetection(config: DetectionConfig): void
  configureVfos(vfos: readonly VfoConfig[]): void
  startExternal(source: AnalyzerSource): Promise<void>
  startVfoAudio(
    outputSampleRateHz: number,
    portFactory: (sourceSessionId: SourceSessionId) => MessagePort,
  ): void
  stopVfoAudio(): void
  stop(): Promise<void>
  reset(): Promise<void>
  subscribeStatus(listener: (snapshot: AnalyzerSnapshot) => void): () => void
  dispose(): void
}

type SourceSessionDependencies = {
  controller?: SourceSessionController
  createHackRfSource?: (config: HackRfConfig, selection: UsbDeviceSelection) => HackRFSource
  createRtlSdrSource?: (config: RtlSdrConfig, selection: UsbDeviceSelection) => RtlSdrSource
}

export class SourceSession {
  readonly controller: SourceSessionController
  readonly #listeners = new Set<(snapshot: SourceSessionSnapshot) => void>()
  readonly #dependencies: SourceSessionDependencies
  #selection: UsbDeviceSelection
  #config: HardwareSessionConfig
  #detectionConfig: DetectionConfig
  #source: HackRFSource | RtlSdrSource | undefined
  #runTask: Promise<void> | undefined
  #runGeneration = 0
  #runtimePending = false
  #runtimeError: string | null = null
  #discontinuityRevision = 0
  readonly #hackRfOptimizer: HackRfAutoOptimizer | undefined
  readonly #rtlSdrOptimizer: RtlSdrAutoOptimizer | undefined
  #autoOptimizeEnabled = false
  #autoOptimizeTargetFrequencyHz: number | null = null
  #autoOptimizeResult: SourceSessionSnapshot['autoOptimize'] = {
    enabled: false,
    status: 'off',
    targetFrequencyHz: null,
    detail: 'Automatic optimization is off.',
  }
  #unsubscribeStatus: (() => void) | undefined
  #initialized = false
  #disposed = false

  constructor(
    selection: UsbDeviceSelection,
    dependencies: SourceSessionDependencies = {},
  ) {
    this.#selection = selection
    this.#dependencies = dependencies
    this.controller = dependencies.controller ?? new AnalyzerController()
    this.#config = selection.kind === 'hackrf'
      ? { ...DEFAULT_HACKRF_CONFIG }
      : { ...DEFAULT_RTL_SDR_CONFIG }
    this.#detectionConfig = selection.kind === 'hackrf'
      ? { ...DEFAULT_DETECTION_CONFIG, minimumSnrDb: 25 }
      : { ...DEFAULT_DETECTION_CONFIG }
    this.#hackRfOptimizer = selection.kind === 'hackrf' ? new HackRfAutoOptimizer() : undefined
    this.#rtlSdrOptimizer = selection.kind === 'rtl-sdr' ? new RtlSdrAutoOptimizer() : undefined
  }

  get id(): SourceSessionId {
    return this.#selection.id
  }

  get kind(): HardwareSourceKind {
    return this.#selection.kind
  }

  get snapshot(): SourceSessionSnapshot {
    return {
      id: this.id,
      kind: this.kind,
      label: this.#selection.label,
      serialNumber: this.#selection.serialNumber,
      deviceConnected: this.#selection.connected,
      config: { ...this.#config },
      detectionConfig: { ...this.#detectionConfig },
      analyzer: { ...this.controller.snapshot },
      runtimePending: this.#runtimePending,
      runtimeError: this.#runtimeError,
      discontinuityRevision: this.#discontinuityRevision,
      autoOptimize: { ...this.#autoOptimizeResult, enabled: this.#autoOptimizeEnabled },
    }
  }

  async initialize(): Promise<void> {
    if (this.#initialized || this.#disposed) return
    this.#unsubscribeStatus = this.controller.subscribeStatus(() => this.#emit())
    await this.controller.initialize()
    if (this.#disposed) return
    this.controller.configure(analyzerConfig(this.#config))
    this.controller.configureDetection(this.#detectionConfig)
    this.#initialized = true
    this.#emit()
  }

  updateSelection(selection: UsbDeviceSelection): void {
    if (selection.id !== this.id || selection.kind !== this.kind) {
      throw new Error('Cannot replace a source session with a different device identity.')
    }
    this.#selection = selection
    this.#emit()
  }

  setConfig(config: HardwareSessionConfig): void {
    if (this.controller.snapshot.state === 'running' || this.controller.snapshot.state === 'connecting') {
      throw new Error('Stop the source before changing restart-only configuration.')
    }
    this.#validateConfig(config)
    this.setAutoOptimizeEnabled(false)
    this.#config = { ...config }
    this.#runtimeError = null
    this.controller.configure(analyzerConfig(this.#config))
    this.#emit()
  }

  setDetectionConfig(config: DetectionConfig): void {
    this.#detectionConfig = { ...config }
    this.controller.configureDetection(config)
    this.#emit()
  }

  configureVfos(vfos: readonly VfoConfig[]): void {
    this.controller.configureVfos(vfos.filter((vfo) => vfo.sourceSessionId === this.id))
  }

  startVfoAudio(
    outputSampleRateHz: number,
    portFactory: (sourceSessionId: SourceSessionId) => MessagePort,
  ): void {
    this.controller.startVfoAudio(outputSampleRateHz, portFactory)
  }

  stopVfoAudio(): void {
    this.controller.stopVfoAudio()
  }

  connect(): void {
    if (!this.#initialized) throw new Error('Source session is not initialized.')
    if (!this.#selection.connected) throw new Error(`${this.#selection.label} is disconnected.`)
    if (this.#source) throw new Error(`${this.#selection.label} is already active.`)
    this.#runtimeError = null
    this.controller.configure(analyzerConfig(this.#config))
    this.controller.configureDetection(this.#detectionConfig)
    const source = this.#createSource()
    const generation = ++this.#runGeneration
    this.#source = source
    const runTask = this.controller.startExternal(source)
    this.#runTask = runTask
    void runTask.then(
      () => this.#finishRun(generation, source),
      () => this.#finishRun(generation, source),
    )
    this.#emit()
  }

  async stop(): Promise<void> {
    const runTask = this.#runTask
    this.#runGeneration += 1
    this.#runtimePending = false
    await this.controller.stop()
    if (runTask) {
      try {
        await runTask
      } catch {
        // AnalyzerController owns source error reporting.
      }
    }
    this.#source = undefined
    this.#runTask = undefined
    this.tickAutoOptimize(performance.now())
  }

  async reset(): Promise<void> {
    await this.controller.reset()
    this.#emit()
  }

  async applyHackRfRuntimeCommand(command: HackRfRuntimeCommand): Promise<HackRfConfig> {
    if (this.kind !== 'hackrf' || !(this.#source instanceof HackRFSource)) {
      throw new Error('HackRF session is not running.')
    }
    this.setAutoOptimizeEnabled(false)
    return this.#applyRuntimeCommand(command, this.#source)
  }

  async applyRtlSdrRuntimeCommand(command: RtlSdrRuntimeCommand): Promise<RtlSdrConfig> {
    if (this.kind !== 'rtl-sdr' || !(this.#source instanceof RtlSdrSource)) {
      throw new Error('RTL-SDR session is not running.')
    }
    this.setAutoOptimizeEnabled(false)
    return this.#applyRuntimeCommand(command, this.#source)
  }

  setAutoOptimizeEnabled(enabled: boolean): void {
    this.#autoOptimizeEnabled = enabled
    if (!enabled) {
      this.#hackRfOptimizer?.reset()
      this.#rtlSdrOptimizer?.reset()
      this.#autoOptimizeResult = {
        enabled: false,
        status: 'off',
        targetFrequencyHz: null,
        detail: 'Automatic optimization is off.',
      }
    }
    this.#emit()
  }

  setAutoOptimizeTarget(frequencyHz: number | null): void {
    this.#autoOptimizeTargetFrequencyHz = frequencyHz
    this.#emit()
  }

  tickAutoOptimize(nowMs: number): void {
    if (this.#runtimePending) return
    const running = this.controller.snapshot.state === 'running' && this.#source !== undefined
    if (this.kind === 'hackrf') {
      const optimizer = this.#hackRfOptimizer!
      const result = optimizer.update({
        enabled: this.#autoOptimizeEnabled,
        running,
        nowMs,
        config: this.#config as HackRfConfig,
        signals: this.controller.snapshot.trackedSignals,
        selectedTargetFrequencyHz: this.#autoOptimizeTargetFrequencyHz,
        peakPowerDbfs: this.controller.snapshot.peakPowerDbfs,
      })
      this.#setAutoOptimizeResult(result)
      if (result.command && this.#source instanceof HackRFSource) {
        this.#runAutomaticHackRfCommand(result.command, this.#source, optimizer, nowMs)
      }
      return
    }

    const optimizer = this.#rtlSdrOptimizer!
    const result = optimizer.update({
      enabled: this.#autoOptimizeEnabled,
      running,
      nowMs,
      config: this.#config as RtlSdrConfig,
      signals: this.controller.snapshot.trackedSignals,
      selectedTargetFrequencyHz: this.#autoOptimizeTargetFrequencyHz,
      peakPowerDbfs: this.controller.snapshot.peakPowerDbfs,
    })
    this.#setAutoOptimizeResult(result)
    if (result.command && this.#source instanceof RtlSdrSource) {
      this.#runAutomaticRtlSdrCommand(result.command, this.#source, optimizer, nowMs)
    }
  }

  subscribe(listener: (snapshot: SourceSessionSnapshot) => void): () => void {
    this.#listeners.add(listener)
    listener(this.snapshot)
    return () => this.#listeners.delete(listener)
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#runGeneration += 1
    this.#unsubscribeStatus?.()
    this.#unsubscribeStatus = undefined
    this.#listeners.clear()
    this.controller.dispose()
    this.#source = undefined
    this.#runTask = undefined
  }

  #createSource(): HackRFSource | RtlSdrSource {
    if (this.kind === 'hackrf') {
      const config = this.#config as HackRfConfig
      return this.#dependencies.createHackRfSource?.(config, this.#selection) ??
        new HackRFSource(config, { selection: this.#selection })
    }
    const config = this.#config as RtlSdrConfig
    return this.#dependencies.createRtlSdrSource?.(config, this.#selection) ??
      new RtlSdrSource(config, { selection: this.#selection })
  }

  async #applyRuntimeCommand<C extends HardwareSessionConfig>(
    command: HardwareRuntimeCommand,
    source: HackRFSource | RtlSdrSource,
  ): Promise<C> {
    if (this.#runtimePending) throw new Error('A receiver setting is already being applied.')
    const generation = this.#runGeneration
    this.#runtimePending = true
    this.#runtimeError = null
    this.#emit()
    try {
      const applied = source instanceof HackRFSource
        ? await source.applyRuntimeCommand(command as HackRfRuntimeCommand)
        : await source.applyRuntimeCommand(command as RtlSdrRuntimeCommand)
      if (generation !== this.#runGeneration || source !== this.#source) {
        throw new Error('The source changed before the receiver setting was applied.')
      }
      this.#config = { ...applied }
      if (commandResetsAnalyzer(command)) {
        this.controller.configure(analyzerConfig(applied))
        this.#discontinuityRevision += 1
      }
      return { ...applied } as C
    } catch (error) {
      this.#runtimeError = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      if (generation === this.#runGeneration) this.#runtimePending = false
      this.#emit()
    }
  }

  #validateConfig(config: HardwareSessionConfig): void {
    if (this.kind === 'hackrf') validateHackRfConfig(config as HackRfConfig)
    else validateRtlSdrConfig(config as RtlSdrConfig)
  }

  #finishRun(generation: number, source: HackRFSource | RtlSdrSource): void {
    if (generation !== this.#runGeneration || source !== this.#source) return
    this.#source = undefined
    this.#runTask = undefined
    this.#runtimePending = false
    this.#emit()
  }

  #setAutoOptimizeResult(result: {
    status: HackRfAutoOptimizeStatus | RtlSdrAutoOptimizeStatus
    targetFrequencyHz: number | null
    detail: string
  }): void {
    this.#autoOptimizeResult = {
      enabled: this.#autoOptimizeEnabled,
      status: result.status,
      targetFrequencyHz: result.targetFrequencyHz,
      detail: result.detail,
    }
    this.#emit()
  }

  #runAutomaticHackRfCommand(
    command: HackRfRuntimeCommand,
    source: HackRFSource,
    optimizer: HackRfAutoOptimizer,
    issuedAtMs: number,
  ): void {
    const generation = this.#runGeneration
    void this.#applyRuntimeCommand<HackRfConfig>(command, source).then(
      () => this.#automaticCommandApplied(generation, command, optimizer, issuedAtMs),
      (error: unknown) => this.#automaticCommandFailed(generation, optimizer, error),
    )
  }

  #runAutomaticRtlSdrCommand(
    command: RtlSdrRuntimeCommand,
    source: RtlSdrSource,
    optimizer: RtlSdrAutoOptimizer,
    issuedAtMs: number,
  ): void {
    const generation = this.#runGeneration
    void this.#applyRuntimeCommand<RtlSdrConfig>(command, source).then(
      () => this.#automaticCommandApplied(generation, command, optimizer, issuedAtMs),
      (error: unknown) => this.#automaticCommandFailed(generation, optimizer, error),
    )
  }

  #automaticCommandApplied<C extends HardwareRuntimeCommand>(
    generation: number,
    command: C,
    optimizer: { commandApplied(command: C, nowMs: number): void },
    issuedAtMs: number,
  ): void {
    if (generation !== this.#runGeneration || !this.#autoOptimizeEnabled) return
    optimizer.commandApplied(command, Math.max(issuedAtMs, performance.now()))
    this.#autoOptimizeResult = {
      enabled: true,
      status: 'settling',
      targetFrequencyHz: this.#autoOptimizeResult.targetFrequencyHz,
      detail: 'Waiting for fresh measurements.',
    }
    this.#emit()
  }

  #automaticCommandFailed(
    generation: number,
    optimizer: { commandFailed(message: string): void },
    error: unknown,
  ): void {
    if (generation !== this.#runGeneration) return
    const message = error instanceof Error ? error.message : String(error)
    optimizer.commandFailed(message)
    this.#autoOptimizeEnabled = false
    this.#autoOptimizeResult = {
      enabled: false,
      status: 'error',
      targetFrequencyHz: this.#autoOptimizeResult.targetFrequencyHz,
      detail: message,
    }
    this.#emit()
  }

  #emit(): void {
    const snapshot = this.snapshot
    for (const listener of this.#listeners) listener(snapshot)
  }
}

function analyzerConfig(config: HardwareSessionConfig): GeneratorConfig {
  return {
    ...DEFAULT_GENERATOR_CONFIG,
    sampleRateHz: config.sampleRateHz,
    centerFrequencyHz: config.centerFrequencyHz,
    fftSize: config.fftSize,
    frameRate: config.frameRate,
  }
}

function commandResetsAnalyzer(command: HardwareRuntimeCommand): boolean {
  return command.type === 'set-center-frequency' ||
    command.type === 'set-frequency-correction' ||
    command.type === 'set-direct-sampling'
}