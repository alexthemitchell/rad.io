import initWasm, {
  VfoBank as WasmVfoBank,
  type VfoAudioBatch,
} from '../../crates/dsp-wasm/pkg/dsp_wasm.js'
import type { VfoAudioBlock, VfoDspConfig } from './types'

let initialization: Promise<unknown> | undefined

export class VfoWasmProcessor {
  readonly #bank: WasmVfoBank

  private constructor() {
    this.#bank = new WasmVfoBank()
  }

  static async create(): Promise<VfoWasmProcessor> {
    initialization ??= initWasm()
    await initialization
    return new VfoWasmProcessor()
  }

  configure(
    sampleRateHz: number,
    centerFrequencyHz: number,
    outputSampleRateHz: number,
    vfos: readonly VfoDspConfig[],
  ): void {
    this.#bank.set_vfos(
      sampleRateHz,
      centerFrequencyHz,
      outputSampleRateHz,
      vfos.map(coreVfoConfig),
    )
  }

  processI8(iq: Int8Array, timestampUs: bigint): VfoAudioBlock[] {
    if (!this.#bank.process_i8(iq, timestampUs)) return []
    return drainVfoAudioBatch(this.#bank.drain_audio())
  }

  processF32(iq: Float32Array, timestampUs: bigint): VfoAudioBlock[] {
    if (!this.#bank.process_f32(iq, timestampUs)) return []
    return drainVfoAudioBatch(this.#bank.drain_audio())
  }

  reset(): void {
    this.#bank.reset()
  }

  dispose(): void {
    this.#bank.free()
  }
}

export function coreVfoConfig(vfo: VfoDspConfig) {
  return {
    id: vfo.id,
    frequencyHz: vfo.frequencyHz,
    mode: vfo.mode,
    bandwidthHz: vfo.bandwidthHz,
    squelchDbfs: vfo.squelchDbfs,
    revision: vfo.revision,
  }
}

export function drainVfoAudioBatch(batch: VfoAudioBatch): VfoAudioBlock[] {
  try {
    const blockCount = batch.block_count
    if (blockCount === 0) return []
    const ids = batch.ids as string[]
    const revisions = batch.revisions
    const sourceTimestampsUs = batch.source_timestamps_us
    const sampleRatesHz = batch.sample_rates_hz
    const channelCounts = batch.channel_counts
    const signalLevelsDbfs = batch.signal_levels_dbfs
    const squelched = batch.squelched
    const stereoLocks = batch.stereo_locks
    const sampleOffsets = batch.sample_offsets
    const samples = batch.samples
    if (
      ids.length !== blockCount ||
      revisions.length !== blockCount ||
      sourceTimestampsUs.length !== blockCount ||
      sampleRatesHz.length !== blockCount ||
      channelCounts.length !== blockCount ||
      signalLevelsDbfs.length !== blockCount ||
      squelched.length !== blockCount ||
      stereoLocks.length !== blockCount ||
      sampleOffsets.length !== blockCount + 1
    ) {
      throw new Error('VFO WASM audio batch contains misaligned metadata.')
    }
    if (
      sampleOffsets[0] !== 0 ||
      sampleOffsets[blockCount] !== samples.length ||
      sampleOffsets.some((offset, index) =>
        index > 0 && offset < sampleOffsets[index - 1],
      )
    ) {
      throw new Error('VFO WASM audio batch contains invalid sample offsets.')
    }

    return Array.from({ length: blockCount }, (_, index) => {
      const channelCount = channelCounts[index]
      if (channelCount !== 1 && channelCount !== 2) {
        throw new Error(`Unsupported VFO audio channel count ${channelCount}.`)
      }
      const sampleCount = sampleOffsets[index + 1] - sampleOffsets[index]
      if (sampleCount % channelCount !== 0) {
        throw new Error(`VFO ${ids[index]} audio block contains incomplete frames.`)
      }
      return {
        vfoId: ids[index],
        revision: revisions[index],
        sourceTimestampUs: sourceTimestampsUs[index],
        sampleRateHz: sampleRatesHz[index],
        channelCount,
        signalLevelDbfs: signalLevelsDbfs[index],
        squelched: squelched[index] !== 0,
        stereoLocked: stereoLocks[index] !== 0,
        samples: samples.slice(sampleOffsets[index], sampleOffsets[index + 1]),
      }
    })
  } finally {
    batch.free()
  }
}