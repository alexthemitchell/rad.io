import { RdsWasmDecoder } from '../rds/RdsWasmDecoder'
import { VfoWasmProcessor } from '../vfo/VfoWasmProcessor'
import type { VfoAudioPortMessage, VfoDspConfig } from '../vfo/types'
import type { RdsDecodeTarget, RdsReception } from '../workers/protocol'

export type ExternalIqProcessorConfig = {
  sampleRateHz: number
  centerFrequencyHz: number
}

type ExternalIqProcessorCallbacks = {
  onRdsUpdate(receptions: readonly RdsReception[]): void
}

export class ExternalIqProcessor {
  readonly #rdsDecoder: RdsWasmDecoder
  readonly #vfoProcessor: VfoWasmProcessor
  readonly #callbacks: ExternalIqProcessorCallbacks
  #config: ExternalIqProcessorConfig
  #vfoOutputSampleRateHz = 48_000
  #vfos: VfoDspConfig[] = []
  #vfoAudioPort: MessagePort | undefined
  #lastRdsEmissionUs: bigint | undefined

  private constructor(
    rdsDecoder: RdsWasmDecoder,
    vfoProcessor: VfoWasmProcessor,
    config: ExternalIqProcessorConfig,
    callbacks: ExternalIqProcessorCallbacks,
  ) {
    this.#rdsDecoder = rdsDecoder
    this.#vfoProcessor = vfoProcessor
    this.#config = { ...config }
    this.#callbacks = callbacks
  }

  static async create(
    config: ExternalIqProcessorConfig,
    callbacks: ExternalIqProcessorCallbacks,
  ): Promise<ExternalIqProcessor> {
    const rdsDecoder = await RdsWasmDecoder.create(config.sampleRateHz)
    try {
      const vfoProcessor = await VfoWasmProcessor.create()
      return new ExternalIqProcessor(rdsDecoder, vfoProcessor, config, callbacks)
    } catch (error) {
      rdsDecoder.dispose()
      throw error
    }
  }

  configure(config: ExternalIqProcessorConfig): void {
    if (config.sampleRateHz !== this.#config.sampleRateHz) {
      throw new Error('Changing the external IQ sample rate requires restarting its processor.')
    }
    this.#config = { ...config }
    this.reset()
    this.#configureVfos()
  }

  setRdsTargets(targets: readonly RdsDecodeTarget[]): void {
    this.#rdsDecoder.setTargets(targets)
  }

  setVfos(outputSampleRateHz: number, vfos: readonly VfoDspConfig[]): void {
    this.#vfoOutputSampleRateHz = outputSampleRateHz
    this.#vfos = [...vfos]
    this.#configureVfos()
  }

  attachVfoAudioPort(port: MessagePort): void {
    this.#vfoAudioPort?.close()
    this.#vfoAudioPort = port
    port.start()
  }

  process(iq: Int8Array, timestampUs: bigint): void {
    const blocks = this.#vfoProcessor.processI8(iq, timestampUs)
    if (blocks.length > 0 && this.#vfoAudioPort) {
      this.#vfoAudioPort.postMessage(
        { type: 'vfo-audio', blocks } satisfies VfoAudioPortMessage,
        blocks.map((block) => block.samples.buffer as ArrayBuffer),
      )
    }

    const receptions = this.#rdsDecoder.process(iq, timestampUs)
    const previousRdsEmissionUs = this.#lastRdsEmissionUs
    if (
      receptions !== null &&
      (previousRdsEmissionUs === undefined ||
        timestampUs - previousRdsEmissionUs >= 250_000n)
    ) {
      this.#lastRdsEmissionUs = timestampUs
      this.#callbacks.onRdsUpdate(receptions)
    }
  }

  reset(): void {
    this.#rdsDecoder.reset()
    this.#vfoProcessor.reset()
    this.#lastRdsEmissionUs = undefined
  }

  dispose(): void {
    this.#rdsDecoder.dispose()
    this.#vfoProcessor.dispose()
    this.#vfoAudioPort?.close()
    this.#vfoAudioPort = undefined
    this.#lastRdsEmissionUs = undefined
  }

  #configureVfos(): void {
    this.#vfoProcessor.configure(
      this.#config.sampleRateHz,
      this.#config.centerFrequencyHz,
      this.#vfoOutputSampleRateHz,
      this.#vfos,
    )
  }
}