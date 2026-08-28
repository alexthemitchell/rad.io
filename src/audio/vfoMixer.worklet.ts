import type {
  VfoAudioPortMessage,
  VfoMixerCommand,
  VfoMixerEvent,
} from '../vfo/types'
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
  #audioPort: MessagePort | undefined
  #framesUntilDiagnostics = Math.round(sampleRate / 4)

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<VfoMixerCommand>) => {
      const message = event.data
      if (message.type === 'configure') {
        this.#mixer.configure(message.vfos, message.masterGainDb, message.masterMuted)
      } else if (message.type === 'attach-audio-port') {
        this.#audioPort?.close()
        this.#audioPort = message.port
        this.#audioPort.onmessage = this.#handleAudio
        this.#audioPort.start()
        this.#mixer.flush()
      } else {
        this.#mixer.flush()
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

  readonly #handleAudio = (event: MessageEvent<VfoAudioPortMessage>): void => {
    if (event.data.type !== 'vfo-audio') return
    for (const block of event.data.blocks) this.#mixer.push(block)
  }
}

registerProcessor('rad-io-vfo-mixer', VfoMixerProcessor)