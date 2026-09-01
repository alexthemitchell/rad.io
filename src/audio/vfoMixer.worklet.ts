import type {
  VfoAudioPortMessage,
  VfoMixerCommand,
  VfoMixerEvent,
} from '../vfo/types'
import type { SourceSessionId } from '../sources/types'
import { VfoMixerCore } from './VfoMixerCore'

declare const sampleRate: number
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean
}
declare function registerProcessor(
  name: string,
  processor: new () => AudioWorkletProcessor,
): void

class VfoMixerProcessor extends AudioWorkletProcessor {
  readonly #mixer = new VfoMixerCore({ sampleRateHz: sampleRate })
  readonly #audioPorts = new Map<SourceSessionId, MessagePort>()
  #framesUntilDiagnostics = Math.round(sampleRate / 4)

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<VfoMixerCommand>) => {
      const message = event.data
      if (message.type === 'configure') {
        this.#mixer.configure(message.vfos, message.masterGainDb, message.masterMuted)
      } else if (message.type === 'attach-audio-port') {
        this.#audioPorts.get(message.sourceSessionId)?.close()
        const port = message.port
        this.#audioPorts.set(message.sourceSessionId, port)
        port.onmessage = (event: MessageEvent<VfoAudioPortMessage>) => {
          if (this.#audioPorts.get(message.sourceSessionId) !== port) return
          this.#handleAudio(message.sourceSessionId, event)
        }
        port.start()
        this.#mixer.flushSource(message.sourceSessionId)
      } else if (message.type === 'detach-audio-port') {
        this.#audioPorts.get(message.sourceSessionId)?.close()
        this.#audioPorts.delete(message.sourceSessionId)
        this.#mixer.flushSource(message.sourceSessionId)
      } else {
        if (message.sourceSessionId) this.#mixer.flushSource(message.sourceSessionId)
        else this.#mixer.flush()
      }
    }
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
  ): boolean {
    const output = outputs[0]
    const left = output?.[0]
    const right = output?.[1]
    if (!left || !right) return true
    this.#mixer.render(left, right)
    this.#framesUntilDiagnostics -= left.length
    if (this.#framesUntilDiagnostics <= 0) {
      this.#framesUntilDiagnostics += Math.round(sampleRate / 4)
      this.port.postMessage({
        type: 'diagnostics',
        diagnostics: this.#mixer.diagnostics(),
      } satisfies VfoMixerEvent)
    }
    return true
  }

  #handleAudio(
    sourceSessionId: SourceSessionId,
    event: MessageEvent<VfoAudioPortMessage>,
  ): void {
    if (event.data.type !== 'vfo-audio') return
    for (const block of event.data.blocks) this.#mixer.push(sourceSessionId, block)
  }
}

registerProcessor('rad-io-vfo-mixer', VfoMixerProcessor)