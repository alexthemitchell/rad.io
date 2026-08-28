import initWasm, {
  RdsDecoderBank,
} from '../../crates/dsp-wasm/pkg/dsp_wasm.js'
import type { RdsDecodeTarget, RdsReception } from '../workers/protocol'
import {
  mapRdsReception,
  type WasmRdsChannelSnapshot,
} from './rdsSnapshots'

let initialization: ReturnType<typeof initWasm> | undefined

export class RdsWasmDecoder {
  readonly #bank: RdsDecoderBank
  readonly #sampleRateHz: number
  #targets: RdsDecodeTarget[] = []

  private constructor(sampleRateHz: number) {
    this.#bank = new RdsDecoderBank()
    this.#sampleRateHz = sampleRateHz
  }

  static async create(sampleRateHz: number): Promise<RdsWasmDecoder> {
    initialization ??= initWasm()
    await initialization
    return new RdsWasmDecoder(sampleRateHz)
  }

  setTargets(targets: readonly RdsDecodeTarget[]): void {
    this.#targets = [...targets]
    this.#bank.set_targets(
      this.#sampleRateHz,
      Float64Array.from(targets, (target) => target.channelCenterHz),
      Float32Array.from(targets, (target) => target.frequencyOffsetHz),
    )
  }

  process(iq: Int8Array, timestampUs: bigint): RdsReception[] | null {
    if (!this.#bank.process_i8(iq, timestampUs)) return null
    return (this.#bank.snapshots() as WasmRdsChannelSnapshot[]).map(mapRdsReception)
  }

  reset(): void {
    this.#bank.reset()
    this.setTargets(this.#targets)
  }

  dispose(): void {
    this.#bank.free()
  }
}