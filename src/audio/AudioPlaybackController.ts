import mixerWorkletUrl from './vfoMixer.worklet.ts?worker&url'
import type {
  VfoMixerCommand,
  VfoMixerControl,
  VfoMixerDiagnostics,
  VfoMixerEvent,
} from '../vfo/types'

export type AudioPlaybackState = 'idle' | 'starting' | 'running' | 'suspended' | 'error'

export type AudioPlaybackSnapshot = {
  state: AudioPlaybackState
  sampleRateHz: number | null
  detail: string
  diagnostics: VfoMixerDiagnostics | null
}

type AudioContextLike = {
  readonly sampleRate: number
  readonly state: AudioContextState
  readonly audioWorklet: { addModule(url: string | URL): Promise<void> }
  readonly destination: unknown
  resume(): Promise<void>
  suspend(): Promise<void>
  close(): Promise<void>
}

type AudioWorkletNodeLike = {
  readonly port: MessagePort
  connect(destination: unknown): void
  disconnect(): void
}

export type AudioPlaybackDependencies = {
  createContext?: () => AudioContextLike
  createNode?: (context: AudioContextLike) => AudioWorkletNodeLike
  createMessageChannel?: () => MessageChannel
  workletUrl?: string
}

const EMPTY_DIAGNOSTICS: VfoMixerDiagnostics = {
  queuedFrames: {},
  underruns: {},
  overruns: {},
  staleBlocks: 0,
  limiterReductionDb: 0,
}

export class AudioPlaybackController {
  readonly #dependencies: AudioPlaybackDependencies
  readonly #listeners = new Set<(snapshot: AudioPlaybackSnapshot) => void>()
  #context: AudioContextLike | undefined
  #node: AudioWorkletNodeLike | undefined
  #startTask: Promise<number> | undefined
  #vfos: VfoMixerControl[] = []
  #masterGainDb = -6
  #masterMuted = false
  #snapshot: AudioPlaybackSnapshot = {
    state: 'idle',
    sampleRateHz: null,
    detail: 'Audio idle',
    diagnostics: null,
  }

  constructor(dependencies: AudioPlaybackDependencies = {}) {
    this.#dependencies = dependencies
  }

  get snapshot(): AudioPlaybackSnapshot {
    return this.#snapshot
  }

  async start(): Promise<number> {
    if (this.#snapshot.state === 'running' && this.#context) return this.#context.sampleRate
    this.#startTask ??= this.#start()
    try {
      return await this.#startTask
    } finally {
      this.#startTask = undefined
    }
  }

  async suspend(): Promise<void> {
    if (!this.#context || !this.#node) return
    this.#node.port.postMessage({ type: 'flush' } satisfies VfoMixerCommand)
    await this.#context.suspend()
    this.#update({ state: 'suspended', detail: 'Audio paused' })
  }

  flush(): void {
    this.#node?.port.postMessage({ type: 'flush' } satisfies VfoMixerCommand)
  }

  configureVfos(vfos: readonly VfoMixerControl[]): void {
    this.#vfos = vfos.map((vfo) => ({ ...vfo }))
    this.#postConfiguration()
  }

  configureMaster(gainDb: number, muted: boolean): void {
    this.#masterGainDb = gainDb
    this.#masterMuted = muted
    this.#postConfiguration()
  }

  createProducerPort(): MessagePort {
    if (!this.#node) throw new Error('Start audio before attaching a sample producer.')
    const channel = this.#dependencies.createMessageChannel?.() ?? new MessageChannel()
    try {
      this.#node.port.postMessage(
        { type: 'attach-audio-port', port: channel.port2 } satisfies VfoMixerCommand,
        [channel.port2],
      )
      return channel.port1
    } catch (error) {
      channel.port1.close()
      channel.port2.close()
      throw error
    }
  }

  subscribe(listener: (snapshot: AudioPlaybackSnapshot) => void): () => void {
    this.#listeners.add(listener)
    listener(this.#snapshot)
    return () => this.#listeners.delete(listener)
  }

  async dispose(): Promise<void> {
    this.#node?.disconnect()
    this.#node?.port.close()
    this.#node = undefined
    if (this.#context) await this.#context.close()
    this.#context = undefined
    this.#update({
      state: 'idle',
      sampleRateHz: null,
      detail: 'Audio idle',
      diagnostics: null,
    })
  }

  async #start(): Promise<number> {
    this.#update({ state: 'starting', detail: 'Starting audio output' })
    try {
      const context = this.#context ?? this.#createContext()
      this.#context = context
      if (!this.#node) {
        await context.audioWorklet.addModule(
          this.#dependencies.workletUrl ?? mixerWorkletUrl,
        )
        const node: AudioWorkletNodeLike = this.#dependencies.createNode?.(context) ??
          new AudioWorkletNode(context as AudioContext, 'rad-io-vfo-mixer', {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2],
          })
        node.port.onmessage = this.#handleNodeMessage
        node.connect(context.destination)
        this.#node = node
        this.#postConfiguration()
      }
      await context.resume()
      this.#update({
        state: 'running',
        sampleRateHz: context.sampleRate,
        detail: `${context.sampleRate.toLocaleString()} Hz audio output`,
      })
      return context.sampleRate
    } catch (error) {
      this.#update({
        state: 'error',
        detail: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  #createContext(): AudioContextLike {
    return this.#dependencies.createContext?.() ?? new AudioContext({ latencyHint: 'interactive' })
  }

  #postConfiguration(): void {
    this.#node?.port.postMessage({
      type: 'configure',
      vfos: this.#vfos,
      masterGainDb: this.#masterGainDb,
      masterMuted: this.#masterMuted,
    } satisfies VfoMixerCommand)
  }

  readonly #handleNodeMessage = (event: MessageEvent<VfoMixerEvent>): void => {
    if (event.data.type !== 'diagnostics') return
    this.#update({ diagnostics: { ...EMPTY_DIAGNOSTICS, ...event.data.diagnostics } })
  }

  #update(update: Partial<AudioPlaybackSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...update }
    for (const listener of this.#listeners) listener(this.#snapshot)
  }
}